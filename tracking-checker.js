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
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
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
      headers: { "user-agent": "TagiooTrackingChecker/1.0 (+https://tagioo.com/website-tracking-checker)", accept: "text/html,application/javascript,text/javascript;q=0.9", "accept-encoding": "identity" }
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

export function analyzeTracking({ url, sources, headers = {}, bytes = 0, durationMs = 0, warnings = [] }) {
  const trackers = [];
  const signals = [];
  const collect = (pattern, field = 0) => {
    const values = new Set();
    for (const source of sources) {
      for (const match of source.text.matchAll(pattern)) {
        values.add(match[field]);
        if (values.size >= 20) return [...values];
      }
    }
    return [...values];
  };
  const detection = (name, pattern, idPattern, idField = 0) => {
    const evidence = sources.filter(source => pattern.test(source.text));
    if (evidence.length) trackers.push({ name, ids: idPattern ? collect(idPattern, idField) : [], sources: evidence.map(source => source.url) });
  };
  detection("Google Tag Manager", /googletagmanager\.com\/(?:gtm|ns)\b|\bGTM-[A-Z0-9]{4,}\b/i, /\bGTM-[A-Z0-9]{4,}\b/g);
  detection("Google Analytics 4", /google-analytics\.com\/g\/collect|\bG-[A-Z0-9]{5,}\b/i, /\bG-[A-Z0-9]{5,}\b/g);
  detection("Google Ads", /\bAW-\d{5,}\b|googleadservices\.com|googleads\.g\.doubleclick\.net/i, /\bAW-\d{5,}\b/g);
  detection("Meta Pixel", /connect\.facebook\.net\/.+fbevents|facebook\.com\/tr\?|fbq\s*\(/i, /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/g, 1);
  detection("TikTok Pixel", /analytics\.tiktok\.com|ttq\.(?:load|track)\s*\(/i, /ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/gi, 1);
  detection("Microsoft Clarity", /clarity\.ms\/tag\//i);
  detection("Microsoft Advertising", /bat\.bing\.com|uetq\.push/i);
  detection("Hotjar", /static\.hotjar\.com|hjid\s*:/i);
  detection("LinkedIn Insight", /snap\.licdn\.com|_linkedin_partner_id/i);
  detection("PostHog", /posthog\.init|posthog\.com|posthog-js/i);
  const platformRules = [
    ["WooCommerce", /woocommerce|wc-cart-fragments|wc_add_to_cart_params/i],
    ["WordPress", /wp-content\/|wp-includes\//i],
    ["Shopify", /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i],
    ["Wix", /wixstatic\.com|wix-warmup-data/i],
    ["BigCommerce", /cdn\d+\.bigcommerce\.com|stencil-utils/i],
    ["Next.js", /__NEXT_DATA__|\/_next\/static\//i]
  ];
  const platforms = platformRules.filter(([, pattern]) => sources.some(source => pattern.test(source.text))).map(([name]) => name);
  const consent = sources.filter(source => /gtag\s*\(\s*['"]consent['"]|ad_storage\s*["']?\s*:|Cookiebot|OneTrust|cookieyes|iubenda|__tcfapi/i.test(source.text));
  const dataLayer = sources.filter(source => /dataLayer\s*(?:\.|\[|=)|['"]dataLayer['"]/.test(source.text));
  const endpointCandidates = collect(/(?:https?:)?\/\/[a-z0-9.-]+(?::\d+)?\/(?:g\/collect|gtm\.js|gtag\/js|tagioo-loader)[^\s"'<>\\)]*/gi);
  const firstParty = endpointCandidates.filter(value => {
    try {
      const endpoint = new URL(value, url);
      const pageHost = new URL(url).hostname.replace(/^www\./, "");
      return (endpoint.hostname === pageHost || endpoint.hostname.endsWith(`.${pageHost}`)) && /\/(?:g\/collect|gtm\.js|gtag\/js|tagioo-loader)(?:[/?]|$)/i.test(endpoint.pathname);
    } catch { return false; }
  }).map(value => { const parsed = new URL(value, url); return parsed.origin + parsed.pathname; });
  const relativeLoader = sources.some(source => /['"]\/(?:tagioo-loader|gtm\.js)(?:[?'"/])/i.test(source.text));
  const transport = sources.some(source => /(?:server_container_url|transport_url)\s*['"]?\s*:/i.test(source.text));
  const serverHint = firstParty.length > 0 || relativeLoader || transport;
  const add = (name, found, detail, next) => signals.push({ name, status: found ? "observed" : "not-observed", detail, next });
  add("HTTPS", new URL(url).protocol === "https:", "Protocol of the final page response.", "Serve the website and tracking endpoints over HTTPS.");
  add("Analytics / tag manager", trackers.some(t => ["Google Tag Manager", "Google Analytics 4"].includes(t.name)), "Recognizable Google analytics or container configuration in the inspected source.", "Check your published container and validate a page_view in GA4 DebugView.");
  add("Advertising tags", trackers.some(t => ["Google Ads", "Meta Pixel", "TikTok Pixel", "Microsoft Advertising", "LinkedIn Insight"].includes(t.name)), "Recognizable advertising tags in the inspected source.", "Verify the destinations you use in GTM Preview and each platform’s test-event tools.");
  add("Consent configuration", consent.length > 0, "Consent API or consent-provider clues; this does not establish compliant consent behavior.", "Test default consent and consent updates before and after visitor choices.");
  add("Data layer", dataLayer.length > 0, "A dataLayer reference; ecommerce event payloads need a runtime test.", "Preview one purchase and inspect transaction_id, currency, value and items.");
  add("First-party / server routing clues", serverHint, "Loader URLs or transport configuration are clues, not proof of server-side delivery.", "Inspect a real collect request, Server GTM Preview and destination acceptance for the same event.");
  const duplicateIds = trackers.filter(tracker => tracker.ids.length > 1).map(tracker => ({ name: tracker.name, ids: tracker.ids }));
  const setCookies = headers["set-cookie"] || [];
  const cookies = (Array.isArray(setCookies) ? setCookies : [setCookies]).slice(0, 20).map(cookie => {
    const parts = cookie.split(";").map(part => part.trim());
    return { name: parts[0].split("=")[0], secure: parts.some(p => /^secure$/i.test(p)), httpOnly: parts.some(p => /^httponly$/i.test(p)), sameSite: parts.find(p => /^samesite=/i.test(p))?.split("=")[1] || "Not specified", maxAge: parts.find(p => /^max-age=/i.test(p))?.split("=")[1] || null };
  });
  return {
    url, scannedAt: new Date().toISOString(), mode: "source-inspection", trackers, platforms, signals,
    firstPartyEndpoints: [...new Set(firstParty)], multipleIds: duplicateIds, cookies,
    observedChecks: signals.filter(signal => signal.status === "observed").length,
    totalChecks: signals.length, inspectedSources: sources.map(source => source.url), bytes, durationMs, warnings,
    limitations: "This scan reads the public HTML and up to three same-origin JavaScript files without executing them or accepting consent. Not observed does not mean missing. It cannot verify live events, server-to-server delivery, browser cookie lifetime, deduplication, page speed, lost visits or ad-spend impact."
  };
}

export async function scanWebsite(value) {
  const normalized = normalizeScanUrl(value).href;
  const previous = cache.get(normalized);
  if (previous && Date.now() - previous.at < 5 * 60 * 1000) return { ...previous.report, cached: true };
  if (running >= 3) throw scanError("All scan slots are busy. Please try again shortly.", 503);
  running++;
  const started = Date.now();
  const signal = AbortSignal.timeout(15000);
  try {
    const page = await fetchScanPage(normalized, signal);
    if (!/text\/html|application\/xhtml\+xml/i.test(page.headers["content-type"] || "")) throw scanError("This URL does not return an HTML web page.", 422);
    const sources = [{ url: page.url, text: page.text.replace(/<!--[\s\S]*?-->/g, "") }];
    const warnings = [];
    let bytes = page.bytes;
    for (const url of scriptUrls(page.text, page.url)) {
      try {
        const script = await fetchScanPage(url, signal, requestPage, new URL(page.url).origin);
        if (new URL(script.url).origin !== new URL(page.url).origin || !/(?:javascript|ecmascript)/i.test(script.headers["content-type"] || "")) {
          warnings.push("A script redirected outside the website or did not return JavaScript; it was not analyzed.");
          continue;
        }
        sources.push({ url: script.url, text: script.text });
        bytes += script.bytes;
      } catch { warnings.push("A linked script could not be inspected within the scan limits."); }
    }
    const report = analyzeTracking({ ...page, sources, bytes, durationMs: Date.now() - started, warnings });
    if (cache.size >= 50) cache.delete(cache.keys().next().value);
    cache.set(normalized, { report, at: Date.now() });
    setTimeout(() => { if (cache.get(normalized)?.report === report) cache.delete(normalized); }, 5 * 60 * 1000).unref();
    return report;
  } catch (error) {
    if (error.status) throw error;
    throw scanError(signal.aborted ? "The scan timed out. Try again." : "The website could not be reached. Check the URL or try another page.", signal.aborted ? 504 : 422);
  } finally { running--; }
}
