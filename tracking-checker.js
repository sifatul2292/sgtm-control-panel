import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { gunzipSync, brotliDecompressSync, inflateSync } from "node:zlib";

const MAX_BYTES = 2 * 1024 * 1024;
const cache = new Map();
let running = 0;

function scanError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function normalizeScanUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) throw scanError("Enter a public website URL.");
  let url;
  try { url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); }
  catch { throw scanError("Enter a valid website URL, such as https://example.com."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw scanError("Use HTTP or HTTPS without credentials or a custom port.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(".") && !isIP(host)) throw scanError("Use a public website domain.");
  if (host === "localhost" || /\.(localhost|local|internal|test|invalid|onion)\.?$/i.test(host)) throw scanError("Private and local websites cannot be scanned.");
  if (isIP(host) && !isPublicAddress(host)) throw scanError("Private and local websites cannot be scanned.");
  url.hash = "";
  return url;
}

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6) return false;
  // Only global unicast; exclude transition, protocol-assignment and documentation ranges.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const parts = canonical.split(":");
  const first = parseInt(parts[0], 16);
  const second = parseInt(parts[1] || "0", 16);
  return first >= 0x2000 && first < 0x4000 && first !== 0x2002 && first !== 0x3fff &&
    !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
}

export async function resolveScanAddress(hostname, resolver = lookup) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolver(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw scanError("This website resolves to a private or restricted network.");
  }
  return addresses.find(({ family }) => family === 4) || addresses[0];
}

async function requestPage(url, signal) {
  let address;
  let abort;
  try {
    address = await Promise.race([
      resolveScanAddress(url.hostname),
      new Promise((_, reject) => {
        abort = () => reject(scanError("The scan timed out. Try again.", 504));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      })
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      signal,
      agent: false,
      // Pin the validated DNS result to this connection, including redirects.
      lookup: (_host, options, callback) => options.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { "user-agent": "Mozilla/5.0 (compatible; TagiooTrackingChecker/2.0; +https://tagioo.com/website-tracking-checker)", accept: "text/html,application/javascript,text/javascript;q=0.9", "accept-encoding": "identity" }
    }, response => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        if (!location) return reject(scanError("The website returned an invalid redirect.", 422));
        return resolve({ location });
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        return reject(scanError(`The website returned HTTP ${status}. It may block automated checks.`, 422));
      }
      let bytes = 0;
      const chunks = [];
      response.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) response.destroy(scanError("The page is too large to scan (2 MB limit).", 422));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          let body = Buffer.concat(chunks);
          const encoding = response.headers["content-encoding"];
          const decoders = { gzip: gunzipSync, br: brotliDecompressSync, deflate: inflateSync };
          if (encoding && encoding !== "identity") {
            if (!Object.hasOwn(decoders, encoding)) throw scanError("The website returned an unsupported content encoding.", 422);
            body = decoders[encoding](body, { maxOutputLength: MAX_BYTES });
          }
          resolve({ text: body.toString("utf8"), headers: response.headers, bytes: body.length });
        } catch { reject(scanError("The website response could not be decoded within the scan limit.", 422)); }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

export async function fetchScanPage(value, signal, request = requestPage, allowedOrigin = "") {
  let url = normalizeScanUrl(value);
  for (let hop = 0; hop < 4; hop++) {
    if (allowedOrigin && url.origin !== allowedOrigin) throw scanError("Script redirects outside the scanned website are not followed.", 422);
    const result = await request(url, signal);
    if (!result.location) return { ...result, url: url.href };
    const next = normalizeScanUrl(new URL(result.location, url).href);
    if (url.protocol === "https:" && next.protocol === "http:") throw scanError("The website redirects to insecure HTTP.", 422);
    url = next;
  }
  throw scanError("The website has too many redirects.", 422);
}

export function scriptUrls(html, pageUrl) {
  const urls = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), pageUrl);
      if (url.origin === new URL(pageUrl).origin && !urls.includes(url.href)) urls.push(url.href);
    } catch { /* Invalid resource URLs are not scan targets. */ }
  }
  return urls.slice(0, 3);
}

// ── Knowledge base ──────────────────────────────────────────────────────────

// Ad and analytics destinations we report on, with the browser-side signatures that reveal them.
export const DESTINATIONS = [
  { key: "ga4", name: "Google Analytics 4", kind: "analytics", pattern: /google-analytics\.com\/g\/collect|gtag\/js\?id=(?:G|GT)-|['"]config['"]\s*,\s*['"](?:G|GT)-[A-Z0-9]{6,12}['"]/i, ids: [/\b(?:G|GT)-[A-Z0-9]{6,12}\b/g, 0] },
  { key: "googleAds", name: "Google Ads", kind: "ads", pattern: /\bAW-\d{6,}\b|googleadservices\.com\/pagead\/conversion|googleads\.g\.doubleclick\.net/i, ids: [/\bAW-\d{6,}\b/g, 0] },
  { key: "meta", name: "Meta (Facebook) Pixel", kind: "ads", pattern: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\s*\(\s*['"]init['"]|facebook\.com\/tr\?id=/i, ids: [/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]|facebook\.com\/tr\?id=(\d{8,20})|"pixel_id"\s*:\s*"(\d{8,20})"/g, -1] },
  { key: "tiktok", name: "TikTok Pixel", kind: "ads", pattern: /analytics\.tiktok\.com|ttq\.load\s*\(/i, ids: [/ttq\.load\s*\(\s*['"]([A-Z0-9]{12,30})['"]|"pixelCode"\s*:\s*"([A-Z0-9]{12,30})"/gi, -1] },
  { key: "pinterest", name: "Pinterest Tag", kind: "ads", pattern: /s\.pinimg\.com\/ct\/core\.js|pintrk\s*\(/i, ids: [/pintrk\s*\(\s*['"]load['"]\s*,\s*['"](\d{8,20})['"]/g, 1] },
  { key: "snapchat", name: "Snap Pixel", kind: "ads", pattern: /sc-static\.net\/scevent|snaptr\s*\(/i, ids: [/snaptr\s*\(\s*['"]init['"]\s*,\s*['"]([a-f0-9-]{20,})['"]/gi, 1] },
  { key: "microsoft", name: "Microsoft Ads (UET)", kind: "ads", pattern: /bat\.bing\.com\/bat\.js|uetq/i, ids: [/\bti\s*:\s*['"](\d{5,12})['"]/g, 1] },
  { key: "linkedin", name: "LinkedIn Insight Tag", kind: "ads", pattern: /snap\.licdn\.com|_linkedin_partner_id/i, ids: [/_linkedin_partner_id\s*=\s*['"](\d{3,12})['"]/g, 1] },
  { key: "reddit", name: "Reddit Pixel", kind: "ads", pattern: /redditstatic\.com\/ads\/pixel|rdt\s*\(\s*['"]init['"]|"redditPixelId"/i, ids: [/(?:rdt\s*\(\s*['"]init['"]\s*,\s*['"]|"redditPixelId"\s*:\s*")(t2_[a-z0-9]+|a2_[a-z0-9]+)/gi, 1] },
  { key: "x", name: "X (Twitter) Pixel", kind: "ads", pattern: /static\.ads-twitter\.com\/uwt\.js|twq\s*\(/i, ids: [/twq\s*\(\s*['"]config['"]\s*,\s*['"]([a-z0-9]{4,10})['"]/gi, 1] }
];

const ANALYTICS_TOOLS = [
  ["Microsoft Clarity", /clarity\.ms\/tag\//i], ["Hotjar", /static\.hotjar\.com|hjid\s*:/i], ["PostHog", /posthog\.init|i\.posthog\.com|posthog-js/i],
  ["Klaviyo", /static\.klaviyo\.com|klaviyo\.js/i], ["Segment", /cdn\.segment\.com\/analytics/i], ["Mixpanel", /cdn\.mxpnl\.com|mixpanel\.init/i]
];

const CMPS = [
  ["OneTrust", /cdn\.cookielaw\.org|optanon/i], ["Cookiebot", /consent\.cookiebot\.com|Cookiebot/], ["CookieYes", /cdn-cookieyes\.com|cookieyes/i],
  ["Complianz", /complianz|cmplz_/i], ["Usercentrics", /usercentrics\.eu|app\.usercentrics/i], ["iubenda", /iubenda\.com/i], ["Termly", /app\.termly\.io/i],
  ["Osano", /cmp\.osano\.com/i], ["Didomi", /sdk\.privacy-center\.org|didomi/i], ["Axeptio", /axeptio/i], ["Borlabs Cookie", /borlabs-cookie/i],
  ["CookieFirst", /cookiefirst\.com/i], ["Tagioo consent banner", /id="tagioo-consent"/], ["Shopify privacy banner", /privacy-banner|customerPrivacy|shopify-pc__banner/i]
];

// Server-side tracking providers recognisable from what they leave in the page or container.
const SERVER_VENDORS = [
  ["Tagioo", /tagioo-loader|tagioo/i], ["Stape", /\bstape\.(?:io|net|live)\b|stapecdn/i], ["Elevar", /getelevar\.com/i], ["Littledata", /littledata/i],
  ["TAGGRS", /taggrs\.io/i], ["Addingwell", /addingwell/i], ["Analyzify", /analyzify/i], ["JENTIS", /jentis/i],
  ["Cloudflare Zaraz", /\/cdn-cgi\/zaraz\//i], ["Trackify", /trackifyapp|trackify-x/i], ["Converge", /converge(?:\.io|hq)/i], ["Blotout", /blotout/i]
];

const PLATFORMS = [
  ["Shopify", /cdn\.shopify\.com|Shopify\.theme|\.myshopify\.com/], ["WooCommerce", /wp-content\/plugins\/woocommerce|wc-cart-fragments|wc_add_to_cart_params|woocommerce-(?:page|cart|checkout|no-js|js)\b|\bwc-block-/],
  ["WordPress", /wp-content\/(?:themes|plugins)\/|wp-includes\//], ["BigCommerce", /cdn\d+\.bigcommerce\.com|stencil-utils/i], ["Magento", /Magento_|mage\/cookies|requirejs-config\.js/i],
  ["Wix", /wixstatic\.com|wix-warmup-data/i], ["Squarespace", /static1\.squarespace\.com|Squarespace\.Constants/i], ["Webflow", /webflow\.js|data-wf-site/i],
  ["Next.js", /__NEXT_DATA__|\/_next\/static\//i]
];
const ECOMMERCE = new Set(["Shopify", "WooCommerce", "BigCommerce", "Magento"]);

const WOO_TRACKING_PLUGINS = [
  ["GTM4WP", /gtm4wp|duracelltomi/], ["PixelYourSite", /plugins\/pixelyoursite|\bpys(?:Options|_)/], ["Meta for WooCommerce", /plugins\/facebook-for-woocommerce|wc_facebook_pixel|wc-facebook/],
  ["Tagioo for WooCommerce", /<!-- Tagioo GTM/], ["Site Kit by Google", /plugins\/google-site-kit|googlesitekit/], ["MonsterInsights", /plugins\/google-analytics-for-wordpress|monsterinsights/]
];

// ── Google Tag Manager container parsing ────────────────────────────────────

// gtm.js embeds its published configuration as `var data = {...}` (valid JSON).
export function extractGtmData(js) {
  const at = js.indexOf("var data = {");
  if (at < 0) return null;
  const start = js.indexOf("{", at);
  let depth = 0, quote = "", escaped = false;
  for (let i = start; i < js.length; i++) {
    const c = js[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(js.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

// Resolve GTM's encoded values: ["macro", n] to constant variables, ["template", ...] to text.
function resolveValue(value, macros, depth = 0) {
  if (depth > 6) return "";
  if (!Array.isArray(value)) return value;
  const [type, ...rest] = value;
  if (type === "macro") {
    const macro = macros[rest[0]];
    if (!macro) return "";
    if (macro.function === "__c") return resolveValue(macro.vtp_value, macros, depth + 1);
    if (macro.function === "__v") return `{{dataLayer:${macro.vtp_name || ""}}}`;
    return `{{${macro.function}}}`;
  }
  if (type === "template") return rest.map((part) => String(resolveValue(part, macros, depth + 1) ?? "")).join("");
  if (type === "escape") return resolveValue(rest[0], macros, depth + 1);
  if (type === "list") return rest.map((part) => resolveValue(part, macros, depth + 1));
  if (type === "map") {
    const out = {};
    for (let i = 0; i + 1 < rest.length; i += 2) out[rest[i]] = resolveValue(rest[i + 1], macros, depth + 1);
    return out;
  }
  return "";
}

export function analyzeGtmContainer(data) {
  const resource = data?.resource || {};
  const macros = resource.macros || [];
  const permissions = data?.permissions || {};
  const tags = [];
  const serverUrls = new Set();
  const textParts = [];
  const settingRows = (table) => (Array.isArray(table) ? table : []).filter((row) => row && typeof row === "object");
  for (const raw of resource.tags || []) {
    const fn = raw.function || "";
    const params = {};
    for (const [key, value] of Object.entries(raw)) if (key.startsWith("vtp_")) params[key.slice(4)] = resolveValue(value, macros);
    const tag = { fn, params };
    if (fn === "__googtag") {
      tag.type = String(params.tagId || "").startsWith("AW-") ? "googleAds" : "ga4";
      tag.id = params.tagId;
      for (const row of settingRows(params.configSettingsTable)) {
        if (/^(server_container_url|transport_url)$/.test(row.parameter) && /^https?:\/\//.test(String(row.parameterValue))) serverUrls.add(String(row.parameterValue));
      }
    } else if (fn === "__gaawc") {
      tag.type = "ga4"; tag.id = params.measurementId;
      if (/^https?:\/\//.test(String(params.serverContainerUrl || ""))) serverUrls.add(String(params.serverContainerUrl));
      for (const row of settingRows(params.fieldsToSet)) if (/^(server_container_url|transport_url)$/.test(row.fieldName) && /^https?:\/\//.test(String(row.value))) serverUrls.add(String(row.value));
    } else if (fn === "__gaawe") {
      tag.type = "ga4-event"; tag.id = params.measurementIdOverride; tag.event = params.eventName;
      tag.ecommerce = params.sendEcommerceData === true || params.sendEcommerceData === "true";
    } else if (fn === "__awct") {
      tag.type = "ads-conversion"; tag.id = params.conversionId ? `AW-${String(params.conversionId).replace(/^AW-/, "")}` : "";
      tag.enhanced = Boolean(params.enableEnhancedConversion) || Boolean(params.cssProvidedEnhancedConversionValue);
    } else if (fn === "__sp") {
      tag.type = "ads-remarketing"; tag.id = params.conversionId ? `AW-${String(params.conversionId).replace(/^AW-/, "")}` : "";
    } else if (fn === "__gclidw") {
      tag.type = "conversion-linker";
    } else if (fn === "__html") {
      tag.type = "html"; tag.html = String(params.html || "");
      textParts.push(tag.html);
    } else if (fn.startsWith("__cvt_")) {
      tag.type = "template";
      const urls = permissions[fn]?.inject_script?.urls || [];
      tag.scripts = urls;
      tag.consentWrite = Boolean(permissions[fn]?.access_consent?.consentTypes?.some?.((c) => c.write));
      textParts.push(urls.join(" "), JSON.stringify(params));
    } else {
      tag.type = "other";
      textParts.push(JSON.stringify(params));
    }
    if (tag.id) textParts.push(String(tag.id));
    tags.push(tag);
  }
  const customEvents = new Set();
  for (const predicate of resource.predicates || []) {
    if (predicate.function === "_eq" && Array.isArray(predicate.arg0) && predicate.arg0[0] === "macro") {
      const macro = macros[predicate.arg0[1]];
      if (macro?.function === "__e" && typeof predicate.arg1 === "string" && !predicate.arg1.startsWith("gtm.")) customEvents.add(predicate.arg1);
    }
  }
  for (const tag of tags) if (tag.event) customEvents.add(tag.event);
  for (const macro of macros) if (macro.function === "__c" && typeof macro.vtp_value === "string") textParts.push(macro.vtp_value);
  // Consent Mode: a consent template that writes consent state, or tags carrying consent settings.
  const consentMode = tags.some((tag) => tag.consentWrite) || (resource.tags || []).some((t) => Array.isArray(t.consent) && t.consent.length > 1) ||
    /gtag\s*\(\s*['"]consent['"]|['"]consent['"]\s*,\s*['"](default|update)['"]/.test(textParts.join("\n"));
  return { tags, serverUrls: [...serverUrls], customEvents: [...customEvents], consentMode, text: textParts.join("\n"), version: resource.version || "" };
}

// ── Shopify app pixels (Customer events) ────────────────────────────────────

export function parseShopifyPixels(html) {
  const at = html.indexOf("webPixelsConfigList");
  if (at < 0) return [];
  const start = html.indexOf("[", at);
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i > 0 && i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "[") depth++;
    else if (c === "]" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)).map((pixel) => ({ type: pixel.type, apiClientId: pixel.apiClientId, configuration: String(pixel.configuration || "") }));
      } catch { return []; }
    }
  }
  return [];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Only markup that loads or configures code: scripts, links, root/body tags, tracking images and
// iframes. Visible text is ignored, so a page that merely *mentions* "WooCommerce" or "Stape"
// isn't mistaken for using it.
export function codeOnly(html) {
  const parts = html.match(/<script\b[\s\S]*?<\/script>|<link\b[^>]*>|<(?:html|body)\b[^>]*>|<img\b[^>]*>|<iframe\b[^>]*>|<meta\s+name=["']generator["'][^>]*>|<!-- Tagioo GTM/gi);
  return parts ? parts.join("\n") : "";
}

function registrableDomain(host) {
  const parts = host.replace(/^www\./, "").split(".");
  if (parts.length > 2 && parts.at(-1).length === 2 && /^(co|com|org|net|ac|gov|edu)$/.test(parts.at(-2))) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function idsFor(destination, text) {
  const [pattern, group] = destination.ids;
  const found = new Set();
  for (const match of text.matchAll(pattern)) {
    const value = group === -1 ? match.slice(1).find(Boolean) : match[group];
    if (value) found.add(value);
    if (found.size >= 10) break;
  }
  return [...found];
}

const SEVERITY_WEIGHT = { critical: 25, high: 14, medium: 7, low: 3 };

// ── Report ──────────────────────────────────────────────────────────────────

export function buildReport({ url, pageText, scriptSources = [], containers = [], shopifyPixels = [], endpoints = [], productPage = null, headers = {}, durationMs = 0, warnings = [] }) {
  const pageHost = new URL(url).hostname;
  const siteDomain = registrableDomain(pageHost);
  const pageCode = codeOnly(pageText);
  const pageAll = [pageCode, ...scriptSources.map((s) => s.text)].join("\n");
  const gtmText = containers.filter((c) => c.analysis).map((c) => c.analysis.text).join("\n");
  const shopifyText = shopifyPixels.map((p) => p.configuration).join("\n");
  const everything = `${pageAll}\n${gtmText}\n${shopifyText}`;

  const platforms = PLATFORMS.filter(([, re]) => re.test(pageAll)).map(([name]) => name);
  const isEcommerce = platforms.some((p) => ECOMMERCE.has(p));
  const cmps = CMPS.filter(([, re]) => re.test(pageAll) || re.test(gtmText)).map(([name]) => name);
  const consentModePage = /gtag\s*\(\s*['"]consent['"]\s*,\s*['"]default['"]|['"]consent['"]\s*,\s*['"]default['"]/.test(pageAll);
  const consentMode = consentModePage || containers.some((c) => c.analysis?.consentMode) || /Shopify\.customerPrivacy|privacy-banner/.test(pageAll) && cmps.includes("Shopify privacy banner");
  const analyticsTools = ANALYTICS_TOOLS.filter(([, re]) => re.test(everything)).map(([name]) => name);
  const wooPlugins = WOO_TRACKING_PLUGINS.filter(([, re]) => re.test(pageAll)).map(([name]) => name);
  const vendors = SERVER_VENDORS.filter(([, re]) => re.test(everything)).map(([name]) => name);

  // Where each destination loads: hard-coded in the page, inside GTM, or as a Shopify app pixel.
  const destinations = DESTINATIONS.map((d) => {
    const via = [];
    if (d.pattern.test(pageCode)) via.push("page");
    else if (scriptSources.some((src) => d.pattern.test(src.text))) via.push("site-script");
    const gtmTypes = { ga4: ["ga4", "ga4-event"], googleAds: ["googleAds", "ads-conversion", "ads-remarketing"] }[d.key] || [];
    if (d.pattern.test(gtmText) || containers.some((c) => c.analysis?.tags.some((t) => gtmTypes.includes(t.type)))) via.push("gtm");
    if (d.pattern.test(shopifyText) || (d.key === "meta" && /"pixel_id"/.test(shopifyText)) || (d.key === "googleAds" && /\bAW-\d+/.test(shopifyText)) || (d.key === "ga4" && /\bG-[A-Z0-9]{6,12}\b/.test(shopifyText))) via.push("shopify-app");
    const ids = idsFor(d, everything).filter((id) => !(d.key === "ga4" && id === "G-XXXXXXXXXX"));
    return { key: d.key, name: d.name, kind: d.kind, found: via.length > 0, via, ids, server: { status: "not-detected", detail: "" } };
  });
  const dest = Object.fromEntries(destinations.map((d) => [d.key, d]));

  // Server-side evidence.
  const liveEndpoints = endpoints.filter((e) => e.healthy);
  const ga4Routed = containers.some((c) => c.analysis?.serverUrls.length) || /(?:server_container_url|transport_url)\s*['"]?\s*:\s*['"]https?:/i.test(pageAll);
  const firstPartyLoader = /<script[^>]+src=["'][^"']*\/(?:gtm\.js|gtag\/js)\?id=/i.test(pageText) && !/<script[^>]+src=["']https?:\/\/(?:www\.)?googletagmanager\.com\/(?:gtm\.js|gtag\/js)/i.test(pageText)
    || /tagioo-loader/i.test(pageText);
  const serverVendor = vendors.find((v) => v !== "Cloudflare Zaraz") || "";
  const shopifyMeta = /"pixel_id"/.test(shopifyText);
  for (const d of destinations) {
    if (!d.found) continue;
    if (d.key === "ga4" && ga4Routed) {
      d.server = liveEndpoints.length
        ? { status: "confirmed", detail: `GA4 is routed to a live server container (${liveEndpoints[0].host}).` }
        : { status: "configured", detail: "GA4 is configured to send to a server container, but we couldn't confirm the container is live." };
    } else if (liveEndpoints.length || ga4Routed || serverVendor) {
      d.server = { status: "possible", detail: liveEndpoints.length
        ? `A live server container was found (${liveEndpoints[0].host}). Server containers are private, so check ${d.key === "meta" ? "Meta Events Manager for “Server” events" : `${d.name} for server events`}.`
        : serverVendor ? `${serverVendor} is installed, which can send ${d.name} events from a server.` : "A server-side setup is configured; check the platform for server events." };
    } else if (d.key === "meta" && shopifyMeta) {
      d.server = { status: "possible", detail: "Shopify's Facebook & Instagram app can send Conversions API events when data sharing is set to Maximum. Check it in the app." };
    }
  }

  // GTM container findings.
  const gtmIds = [...new Set((pageAll.match(/\bGTM-[A-Z0-9]{4,10}\b/g) || []))];
  const gtmTags = containers.flatMap((c) => c.analysis?.tags || []);
  const gtmEvents = new Set(containers.flatMap((c) => c.analysis?.customEvents || []));
  const adsConversions = gtmTags.filter((t) => t.type === "ads-conversion");
  // The Google tag (gtag.js / GTM "Google tag") runs the conversion linker itself.
  const hasLinker = gtmTags.some((t) => t.type === "conversion-linker" || t.fn === "__googtag") || /gtag\/js\?id=(?:G|AW)-/.test(pageAll);
  const metaGtmTags = gtmTags.filter((t) => t.type === "html" && /fbq\s*\(/.test(t.html));
  const metaTracksEvents = metaGtmTags.some((t) => /fbq\s*\(\s*['"]track(?:Custom)?['"]/.test(t.html));
  const metaUsesEventId = metaGtmTags.some((t) => /eventID/.test(t.html)) || /fbq\s*\([^)]*eventID/.test(pageAll);
  const purchaseEvent = /purchase|checkout_completed|order_complete|transaction/i;
  const purchaseSignals = [...gtmEvents].some((e) => purchaseEvent.test(e)) || adsConversions.length > 0 ||
    metaGtmTags.some((t) => /['"]Purchase['"]/.test(t.html)) || /['"]?event['"]?\s*:\s*['"]purchase['"]/.test(pageAll) ||
    shopifyPixels.length > 0 || wooPlugins.some((p) => p !== "Site Kit by Google");

  const issues = [];
  const passed = [];
  const issue = (id, severity, title, detail, fix, tagioo = "") => issues.push({ id, severity, title, detail, fix, tagioo });
  const pass = (title, detail) => passed.push({ title, detail });
  const anyTracking = destinations.some((d) => d.found) || gtmIds.length > 0;

  if (new URL(url).protocol !== "https:") issue("no-https", "critical", "The site isn't served over HTTPS", "Browsers restrict cookies and tracking on insecure pages, and visitors see a “Not secure” warning.", ["Install an SSL certificate (most hosts offer it free).", "Redirect all HTTP traffic to HTTPS."]);
  else pass("HTTPS", "The site loads securely over HTTPS.");

  // Single-page apps and consent-gated sites can load every tag from JavaScript we can't read.
  const jsApp = /__NEXT_DATA__|\/_next\/static\/|__NUXT__|ng-version=|data-reactroot|id=["'](?:root|app|__next)["']/i.test(pageCode);
  const inconclusive = !anyTracking && (jsApp || cmps.length > 0);
  if (!anyTracking && !inconclusive) {
    issue("no-tracking", "critical", "No analytics or ad tracking found", "We couldn't find Google Tag Manager, GA4 or any ad pixel on this page. Without them you can't measure visitors, sales or ad results.", ["Install Google Tag Manager on every page.", "Add GA4 and the ad platforms you use (Meta, Google Ads, TikTok) through GTM.", "Test one conversion in GTM Preview."], "Tagioo's Setup Assistant generates a ready GTM setup for GA4, Meta, Google Ads and TikTok.");
  }

  for (const c of containers) {
    if (c.status === "not-found") issue(`gtm-missing-${c.id}`, "critical", `GTM container ${c.id} isn't published`, `The page loads ${c.id}, but Google returns no published version, so none of its tags run.`, ["Open Google Tag Manager → this container.", "Click Submit → Publish.", "Reload the site and check GTM Preview."]);
  }
  if (gtmIds.length > 1) issue("multiple-gtm", "medium", `${gtmIds.length} GTM containers on one page`, `This page loads ${gtmIds.join(", ")}. Two containers often fire the same tags twice and are hard to maintain.`, ["Check whether each container is still needed (agency, app or old setup).", "Move the tags you need into one container and remove the other."]);
  if (gtmIds.length === 1 && containers.some((c) => c.status === "ok")) pass("Google Tag Manager", `${gtmIds[0]} is published (${gtmTags.length} tags).`);

  // Duplicates.
  for (const d of destinations) {
    const hardcoded = d.via.includes("page") ? "the page's HTML" : d.via.includes("site-script") ? "your site's own JavaScript" : "";
    if (hardcoded && d.via.includes("gtm") && ["meta", "ga4", "tiktok"].includes(d.key)) {
      issue(`duplicate-${d.key}`, "high", `${d.name} loads twice (site code and GTM)`, `${d.name} is installed in ${hardcoded} and again inside GTM. Every page view and purchase can be counted twice, which inflates your reports and confuses ad algorithms.`, [`Pick one place to manage ${d.name} — GTM is easiest.`, "Remove the other installation (theme code, plugin or app).", "Check the platform's diagnostics for duplicate events after the change."], "Tagioo's setup installs each pixel once and sends a matching server event with deduplication.");
    } else if (d.via.includes("shopify-app") && (d.via.includes("gtm") || hardcoded) && ["meta", "ga4", "tiktok", "googleAds"].includes(d.key)) {
      issue(`duplicate-${d.key}-shopify`, "high", `${d.name} is installed by a Shopify app and again by GTM or theme code`, "Running the Shopify sales-channel app and your own pixel can count the same purchase twice.", ["Decide which one owns this platform's tracking.", "Turn off data sharing in the app, or remove your own pixel — not both.", "Place a test order and confirm it is counted once."]);
    }
    if (d.ids.length > 1 && ["meta", "ga4", "tiktok"].includes(d.key)) {
      issue(`multiple-ids-${d.key}`, "medium", `${d.ids.length} different ${d.name} IDs`, `Found ${d.ids.join(", ")}. Sometimes this is intentional (agency or brand accounts), but often it's a leftover that sends data to the wrong account.`, ["Confirm every ID belongs to an account you use.", "Remove IDs you don't recognise."]);
    }
  }

  // Server-side coverage.
  const adDestinations = destinations.filter((d) => d.found && d.kind === "ads");
  for (const d of destinations.filter((x) => x.found && ["meta", "tiktok", "googleAds", "ga4"].includes(x.key))) {
    if (d.server.status === "not-detected") {
      const sev = d.key === "meta" ? "high" : d.key === "ga4" ? "medium" : "medium";
      const what = { meta: "Meta Conversions API (CAPI)", tiktok: "TikTok Events API", googleAds: "server-side Google Ads conversions with enhanced conversions", ga4: "server-side GA4 through a server GTM container" }[d.key];
      issue(`browser-only-${d.key}`, sev, `${d.name} is browser-only — no server-side tracking found`, `${d.name} relies only on the browser. Ad blockers, Safari's tracking limits and closed tabs can stop events from arriving, so the platform sees fewer conversions than really happen.`, [`Add ${what}.`, "Send the same event from the browser and the server with a shared event ID so it's counted once.", "Serve tracking from your own subdomain (e.g. track.yourstore.com)."], `Tagioo hosts the server container on your domain and generates the ${d.key === "meta" ? "Conversions API" : "server"} setup for you.`);
    } else if (d.server.status === "confirmed") {
      pass(`${d.name} server-side`, d.server.detail);
    } else if (d.server.status === "configured") {
      issue(`unconfirmed-server-${d.key}`, "medium", `${d.name} server routing couldn't be confirmed`, `${d.name} is set to send data to a server container, but we couldn't reach a live container to confirm it. If the container is down or misconfigured, these events are lost.`, ["Open your server container's hosting dashboard and check it's running.", "Run GTM Server Preview and send a test page view.", "Check DebugView in GA4 for the test event."]);
    } else if (d.server.status === "possible") {
      const where = { meta: "Meta Events Manager → Data sources → your Pixel → Overview, and check events show the “Server” connection method", tiktok: "TikTok Events Manager → your Pixel and check events received through the Events API", googleAds: "Google Ads → Goals → Conversions and check each action's source and status" }[d.key];
      if (where) issue(`unconfirmed-server-${d.key}`, d.key === "meta" ? "medium" : "low", d.key === "meta" ? "Meta Conversions API (CAPI) can't be confirmed" : `${d.name} server-side events can't be confirmed`, `${d.server.detail} Server-to-server events can't be seen from outside, so we can't give full marks until you confirm them.`, [`Open ${where}.`, "If there are no server events, set up the server-side connection and send events with a shared event ID.", "Re-run this check after any change."], "Tagioo customers see server-side delivery for every event in the dashboard, so there's no guessing.");
    }
  }
  for (const e of endpoints) {
    if (!e.healthy) issue(`sgtm-down-${e.host}`, "critical", "Server container isn't responding", `Your tags send data to ${e.host}, but its health check failed${e.error ? ` (${e.error})` : ""}. Events sent there may be lost.`, ["Open your server-side hosting dashboard and check the container is running.", "Check the DNS record for this subdomain.", "Run GTM Server Preview and send a test event."]);
    else if (!e.firstParty) issue(`sgtm-third-party-${e.host}`, "medium", "Server container is on a third-party domain", `${e.host} isn't on ${siteDomain}. Cookies it sets are third-party, so Safari and other browsers limit them and some blockers block the domain.`, [`Map a subdomain like track.${siteDomain} to the server container.`, "Update server_container_url in your Google tag."], "Tagioo connects your own subdomain with automatic SSL.");
    else pass("Server container is live on your domain", `${e.host} answered its health check.`);
  }
  if (gtmIds.length && !firstPartyLoader && !vendors.includes("Cloudflare Zaraz")) {
    issue("third-party-loader", "low", "GTM loads from googletagmanager.com", "Many ad blockers and privacy browsers (Brave, uBlock) block googletagmanager.com, so for those visitors no tags load at all.", ["Load gtm.js through your own domain (a custom loader or Google tag gateway).", "Keep the visitor's consent choices in control."], "Tagioo's Custom Loader serves GTM from your tracking subdomain.");
  } else if (firstPartyLoader) pass("First-party tag loading", "GTM or the Google tag loads from your own domain, so fewer blockers stop it.");

  // Google Ads specifics.
  if (adsConversions.length && !hasLinker) issue("ads-no-linker", "high", "Google Ads conversions without a Conversion Linker", "GTM has Google Ads conversion tags but no Conversion Linker, so ad click IDs aren't stored and many conversions can't be matched to clicks.", ["In GTM, add a Conversion Linker tag.", "Trigger it on All Pages.", "Publish and test with ?gclid=test in the URL."]);
  if (adsConversions.length && !adsConversions.some((t) => t.enhanced)) issue("ads-no-enhanced", "medium", "Google Ads enhanced conversions not enabled", "Enhanced conversions send a hashed email or phone with each conversion, helping Google match more of them.", ["Turn on enhanced conversions in your Google Ads conversion settings.", "Add user-provided data to the conversion tag in GTM."]);

  // Meta specifics.
  if (dest.meta.found && metaTracksEvents && !metaUsesEventId && dest.meta.server.status !== "not-detected") {
    issue("meta-no-event-id", "high", "Meta events have no event ID for deduplication", "Your Pixel tags in GTM don't pass an eventID. If the Conversions API also sends these events, Meta can't match the pair and may count each one twice.", ["Add a unique eventID to each fbq('track') call.", "Send the same ID as event_id from the server."]);
  }
  if (dest.meta.found && dest.meta.server.status === "confirmed") pass("Meta has a server-side path", dest.meta.server.detail);

  // Meta advanced matching: customer data passed to fbq('init', id, {...}) or user_data sent with events.
  const metaAdvancedMatching = /fbq\s*\(\s*['"]init['"]\s*,\s*[^,)]+,\s*\{/.test(`${pageAll}\n${gtmText}`) || /autoConfig|"em"\s*:|['"]em['"]\s*:/.test(metaGtmTags.map((t) => t.html).join("\n"));
  if (dest.meta.found && metaGtmTags.length && !metaAdvancedMatching && dest.meta.server.status === "not-detected") {
    issue("meta-no-advanced-matching", "medium", "Meta Pixel sends no customer data (advanced matching)", "Without hashed email or phone, Meta matches fewer conversions to the people who clicked your ads.", ["Turn on Automatic Advanced Matching in Events Manager → Settings.", "Or pass hashed email/phone to fbq('init') and with server events."]);
  }

  // Product page: ecommerce events where they matter most.
  if (productPage) {
    const pCode = codeOnly(productPage.text);
    const productEvents = /view_item|ViewContent|['"]ecommerce['"]\s*:|"product"\s*:\s*\{|ShopifyAnalytics\.meta\.product|gtm4wp_product|wc_single_product/i.test(pCode);
    if (productEvents) pass("Product page data", `Product data or ecommerce events were found on ${new URL(productPage.url).pathname}.`);
    else if (isEcommerce && !shopifyPixels.length) issue("no-product-events", "medium", "No product data on product pages", `We checked ${new URL(productPage.url).pathname} and found no view_item / ViewContent event or product data layer. Ad platforms can't build product audiences or dynamic ads.`, ["Push a view_item event with item_id, price and currency on product pages.", "Map it to Meta ViewContent and TikTok ViewContent."], "Tagioo's WooCommerce plugin pushes full GA4 ecommerce events on every step.");
  }

  // Ecommerce.
  if (isEcommerce && anyTracking && !purchaseSignals) issue("no-purchase-tracking", platforms.includes("Shopify") ? "medium" : "high", "Purchase tracking couldn't be confirmed", platforms.includes("Shopify") ? "This is an online store, but we found no purchase event in GTM and no Shopify app pixels. Shopify purchases are tracked on checkout pages we can't load, so check Settings → Customer events to confirm a pixel sends purchases." : "This looks like an online store, but we found no purchase event in GTM and no tracking plugin. Your ads may not be learning from sales.", ["Track the purchase event with order ID, value and currency.", "Send it to GA4 and every ad platform you use.", "Place a test order and confirm it in each platform."], "Tagioo's WooCommerce plugin and Shopify setup track purchases with a server-side backup.");
  else if (isEcommerce && purchaseSignals) pass("Purchase tracking", "We found purchase tracking for this store.");
  if (dest.ga4.found && isEcommerce && containers.length && !gtmTags.some((t) => t.type === "ga4-event" && t.ecommerce) && !gtmEvents.has("purchase") && !shopifyPixels.length) {
    issue("ga4-no-ecommerce", "medium", "GA4 isn't receiving ecommerce events", "GA4 is installed, but GTM has no ecommerce events (view_item, add_to_cart, purchase). Revenue and product reports stay empty.", ["Push GA4 ecommerce events to the data layer.", "Add GA4 event tags with “Send ecommerce data” turned on."]);
  }
  if (wooPlugins.filter((p) => p !== "Tagioo for WooCommerce").length > 1) {
    issue("woo-plugin-overlap", "medium", `${wooPlugins.length} tracking plugins installed`, `Found ${wooPlugins.join(", ")}. Several plugins sending the same events is a common cause of duplicate purchases.`, ["Choose one plugin to own each platform.", "Turn off overlapping features in the others."]);
  }

  // Consent.
  if (cmps.length && !consentMode) issue("consent-no-mode", "medium", "Cookie banner found, but no Google Consent Mode", `We found ${cmps.join(", ")}, but no Consent Mode signals. Google tags then can't adjust to the visitor's choice, and Google may limit ads features for EEA visitors.`, ["Enable Google Consent Mode v2 in your cookie banner's settings.", "Check in GTM Preview that consent defaults run before tags fire."]);
  else if (cmps.length && consentMode) pass("Consent management", `${cmps.join(", ")} with Google Consent Mode.`);
  else if (!cmps.length && adDestinations.length) issue("no-cmp", "low", "No cookie consent banner detected", "No consent banner was found. Whether you need one depends on where your customers are (for example, the EU, UK and some US states).", ["Check your legal requirements with your privacy notice and advisor.", "If needed, add a consent banner with Google Consent Mode v2."], "The Tagioo WooCommerce plugin includes an optional consent banner.");

  // Score.
  const penalty = issues.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity], 0);
  const score = inconclusive ? null : anyTracking ? Math.max(5, Math.min(100, 100 - penalty)) : 0;
  const grade = score === null ? "?" : score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  const counts = Object.fromEntries(["critical", "high", "medium", "low"].map((s) => [s, issues.filter((i) => i.severity === s).length]));
  const serverStatus = liveEndpoints.length ? "confirmed" : ga4Routed ? "configured" : serverVendor || shopifyMeta ? "likely" : "none";
  const summary = inconclusive ? `We couldn't see this site's tracking. ${jsApp ? "It's a JavaScript app that loads its tags after the page starts" : "Its tags appear to wait for cookie consent"}, which this scan can't run. Try a specific product or landing page, or ask us for a manual review.`
    : !anyTracking ? "No tracking was found on this page."
    : issues.length === 0 ? "Your tracking setup looks healthy. Keep testing one real conversion each month."
    : `${issues.length} issue${issues.length === 1 ? "" : "s"} found${counts.critical ? `, including ${counts.critical} critical` : counts.high ? `, including ${counts.high} high-impact` : ""}. ${serverStatus === "none" ? "Your tracking is browser-only, so blocked or interrupted events are lost." : serverStatus === "confirmed" ? "A live server-side setup was found." : "Server-side tracking appears to be set up but couldn't be fully confirmed."}`;

  const setCookies = headers["set-cookie"] || [];
  const cookies = (Array.isArray(setCookies) ? setCookies : [setCookies]).slice(0, 20).map((cookie) => {
    const parts = cookie.split(";").map((part) => part.trim());
    return { name: parts[0].split("=")[0], secure: parts.some((p) => /^secure$/i.test(p)), httpOnly: parts.some((p) => /^httponly$/i.test(p)), sameSite: parts.find((p) => /^samesite=/i.test(p))?.split("=")[1] || "Not specified", maxAge: parts.find((p) => /^max-age=/i.test(p))?.split("=")[1] || null };
  });

  return {
    url, scannedAt: new Date().toISOString(), mode: "deep-inspection", durationMs, score, grade, summary, counts, inconclusive,
    platform: platforms[0] || "Unknown", platforms, isEcommerce,
    stack: {
      tagManagers: containers.map((c) => ({ id: c.id, status: c.status, tags: c.analysis?.tags.length || 0, version: c.analysis?.version || "" })),
      gtmIds, cmps, consentMode, analyticsTools, wooPlugins, vendors,
      serverSide: { status: serverStatus, vendor: serverVendor, endpoints: endpoints.map(({ host, firstParty, healthy }) => ({ host, firstParty, healthy })) },
      loader: firstPartyLoader ? "first-party" : gtmIds.length ? "googletagmanager.com" : "none",
      shopifyAppPixels: shopifyPixels.filter((p) => p.type === "APP").length,
      gtmEvents: [...gtmEvents].slice(0, 30)
    },
    destinations: destinations.filter((d) => d.found).map(({ key, name, kind, via, ids, server }) => ({ key, name, kind, via, ids, server })),
    issues, passed, cookies, warnings,
    inspected: { page: url, productPage: productPage?.url || "", scripts: scriptSources.map((s) => s.url), containers: containers.map((c) => c.id) },
    limitations: "We read the page, its scripts, the published GTM container, Shopify app pixels and your server container's health check. We don't click, accept cookies or place orders, so tags that only run after consent or on checkout pages may not appear. Server containers are private: we can confirm one is live, not which tags it runs."
  };
}

// ── Scan orchestration ─────────────────────────────────────────────────────

const GTM_ORIGIN = "https://www.googletagmanager.com";

async function fetchGtmContainer(id, signal) {
  try {
    const result = await fetchScanPage(`${GTM_ORIGIN}/gtm.js?id=${encodeURIComponent(id)}`, signal, requestPage, GTM_ORIGIN);
    const data = extractGtmData(result.text);
    if (!data) return { id, status: "unreadable" };
    return { id, status: "ok", analysis: analyzeGtmContainer(data), bytes: result.bytes };
  } catch (error) {
    return { id, status: /HTTP 404/.test(error.message || "") ? "not-found" : "unreachable" };
  }
}

async function checkEndpoint(rawUrl, siteDomain, signal) {
  let url;
  try { url = normalizeScanUrl(rawUrl); } catch { return null; }
  const host = url.hostname;
  const firstParty = registrableDomain(host) === siteDomain;
  try {
    const result = await fetchScanPage(`${url.origin}/healthy`, signal, requestPage, url.origin);
    return { host, origin: url.origin, firstParty, healthy: /^\s*ok\s*$/i.test(result.text.slice(0, 20)) };
  } catch (error) {
    return { host, origin: url.origin, firstParty, healthy: false, error: (error.message || "").replace(/\.$/, "").slice(0, 80) };
  }
}

export async function scanWebsite(value) {
  const normalized = normalizeScanUrl(value).href;
  const previous = cache.get(normalized);
  if (previous && Date.now() - previous.at < 5 * 60 * 1000) return { ...previous.report, cached: true };
  if (running >= 3) throw scanError("All scan slots are busy. Please try again shortly.", 503);
  running++;
  const started = Date.now();
  const signal = AbortSignal.timeout(25000);
  try {
    const page = await fetchScanPage(normalized, signal);
    if (!/text\/html|application\/xhtml\+xml/i.test(page.headers["content-type"] || "")) throw scanError("This URL does not return an HTML web page.", 422);
    const pageText = page.text.replace(/<!--(?! Tagioo GTM)[\s\S]*?-->/g, "");
    const warnings = [];
    const scriptSources = [];
    const pageOrigin = new URL(page.url).origin;
    await Promise.all(scriptUrls(page.text, page.url).map(async (scriptUrl) => {
      try {
        const script = await fetchScanPage(scriptUrl, signal, requestPage, pageOrigin);
        if (new URL(script.url).origin === pageOrigin && /(?:javascript|ecmascript)/i.test(script.headers["content-type"] || "")) scriptSources.push({ url: script.url, text: script.text });
      } catch { warnings.push("A linked script could not be inspected within the scan limits."); }
    }));
    const pageAll = [codeOnly(pageText), ...scriptSources.map((s) => s.text)].join("\n");
    const gtmIds = [...new Set(pageAll.match(/\bGTM-[A-Z0-9]{4,10}\b/g) || [])].slice(0, 2);
    const containers = await Promise.all(gtmIds.map((id) => fetchGtmContainer(id, signal)));
    const shopifyPixels = parseShopifyPixels(page.text);
    // One product page for stores, where view_item / ViewContent should fire.
    let productPage = null;
    const productHref = [...page.text.matchAll(/href=["']([^"'#?]*\/(?:products?|shop)\/[a-z0-9][^"'#?]*)["']/gi)].map((m) => { try { return new URL(m[1], page.url); } catch { return null; } })
      .find((u) => u && u.origin === pageOrigin && u.pathname !== new URL(page.url).pathname && !/\/(?:collections|category|categories|tag)\/?$/.test(u.pathname));
    if (productHref) {
      try { const p = await fetchScanPage(productHref.href, signal, requestPage, pageOrigin); if (/text\/html/i.test(p.headers["content-type"] || "")) productPage = { url: p.url, text: p.text }; }
      catch { warnings.push("A product page could not be inspected."); }
    }
    const siteDomain = registrableDomain(new URL(page.url).hostname);
    const candidateUrls = new Set(containers.flatMap((c) => c.analysis?.serverUrls || []));
    for (const m of pageAll.matchAll(/(?:server_container_url|transport_url)\s*['"]?\s*:\s*['"](https?:\/\/[^'"]+)['"]/gi)) candidateUrls.add(m[1]);
    for (const m of page.text.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)\/(?:gtm\.js|gtag\/js)\?id=/gi)) if (!/googletagmanager\.com/i.test(m[1])) candidateUrls.add(m[1]);
    const origins = [...new Set([...candidateUrls].map((u) => { try { return new URL(u).origin; } catch { return ""; } }).filter(Boolean))].slice(0, 2);
    const endpoints = (await Promise.all(origins.map((origin) => checkEndpoint(origin, siteDomain, signal)))).filter(Boolean);
    const report = buildReport({ url: page.url, pageText, scriptSources, containers, shopifyPixels, endpoints, productPage, headers: page.headers, durationMs: Date.now() - started, warnings: [...new Set(warnings)] });
    if (cache.size >= 50) cache.delete(cache.keys().next().value);
    cache.set(normalized, { report, at: Date.now() });
    setTimeout(() => { if (cache.get(normalized)?.report === report) cache.delete(normalized); }, 5 * 60 * 1000).unref();
    return report;
  } catch (error) {
    if (error.status) throw error;
    throw scanError(signal.aborted ? "The scan timed out. Try again." : "The website could not be reached. Check the URL or try another page.", signal.aborted ? 504 : 422);
  } finally { running--; }
}
