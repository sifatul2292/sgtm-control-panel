#!/usr/bin/env node
// Renders a 1200x630 cover image for every blog post (also used as its social share image):
//   docs/marketing/blog/<slug>.md  ->  public/assets/blog/covers/<slug>.jpg
// Uses the locally installed Google Chrome in headless mode. Covers are cached by a hash of
// title + category + template version; pass --force to re-render everything.
// Run it before `npm run build:blog` whenever a post is added or retitled.
import { readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMPLATE_VERSION = 1;
const root = new URL("../", import.meta.url);
const srcDir = new URL("docs/marketing/blog/", root);
const outDir = new URL("public/assets/blog/covers/", root);
const assets = new URL("public/assets/", root).pathname;
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const force = process.argv.includes("--force");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const icon = (name) => `file://${assets}${name}`;

// Per-category accent and the three "event path" rows drawn on the right-hand side.
const THEMES = {
  "Getting started": { accent: "#8E86FF", rows: [["Your website", "page_view · purchase"], ["track.yourstore.com", "server container"], ["Ad platforms", "Google · Meta · TikTok"]] },
  Google: { accent: "#7FB2FF", icon: "blog-google-ads.svg", rows: [["Ad click", "?gclid=…"], ["Server Conversion Linker", "FPGCLAW · 90 days"], ["Google Ads", "conversion recorded"]] },
  Meta: { accent: "#6EA8FF", icon: "blog-meta.svg", rows: [["Browser Pixel", "event_id: 1042"], ["Conversions API", "event_id: 1042"], ["Meta Events Manager", "deduplicated · 1 purchase"]] },
  TikTok: { accent: "#5EEAD4", icon: "blog-tiktok.svg", rows: [["TikTok Pixel", "event_id: 1042"], ["Events API", "server-side"], ["TikTok Ads", "deduplicated"]] },
  Ecommerce: { accent: "#C5EB8C", rows: [["Checkout complete", "order #1042 · $89.00"], ["Server purchase hit", "transaction_id: 1042"], ["GA4 · Meta · Google Ads", "one order, counted once"]] },
  Privacy: { accent: "#FBBF77", rows: [["Consent banner", "ad_storage: granted"], ["First-party domain", "track.yourstore.com"], ["Server-set cookie", "respects consent"]] },
  Comparisons: { accent: "#F9A8D4", rows: [["Pricing unit", "requests vs events"], ["Setup help", "templates · plugins"], ["Monitoring", "logs · inspector"]] },
  Troubleshooting: { accent: "#FCA5A5", rows: [["Store orders", "100"], ["GA4 purchases", "86"], ["Ad conversions", "71 · find the gap"]] },
  "Lead generation": { accent: "#A5B4FC", rows: [["Form submitted", "lead_id: L-2051"], ["Lead accepted", "CRM status: qualified"], ["Offline conversion", "sent with click ID"]] },
};

function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  for (const line of (m ? m[1] : "").split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*?)(?:\s+#.*)?\s*$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return meta;
}

function coverHtml(meta) {
  const theme = THEMES[meta.category] || THEMES["Getting started"];
  // Shorter titles get bigger type; the title area is ~600px wide and 4 lines tall at most.
  const len = meta.title.length;
  const size = len < 40 ? 64 : len < 58 ? 56 : len < 74 ? 50 : 44;
  const rows = theme.rows.map(([label, value], i) => `
    <div class="row${i === 1 ? " mid" : ""}"><span class="n">0${i + 1}</span><div><b>${esc(label)}</b><code>${esc(value)}</code></div></div>
    ${i < theme.rows.length - 1 ? '<div class="arrow">↓</div>' : ""}`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(${icon("fonts/inter-latin-var.woff2")}) format("woff2");font-weight:100 900}
*{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#fff;background:#0A0C12;position:relative;display:grid;grid-template-columns:660px 1fr}
body::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse at 30% 20%,#000 20%,transparent 80%)}
body::after{content:"";position:absolute;width:820px;height:620px;left:-160px;top:-300px;background:radial-gradient(ellipse,rgba(79,70,229,.42),transparent 65%)}
.l{position:relative;z-index:1;padding:58px 0 50px 64px;display:flex;flex-direction:column}
.cat{align-self:flex-start;font-size:17px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${theme.accent};border:1px solid ${theme.accent}55;background:${theme.accent}14;padding:8px 14px;border-radius:999px}
h1{margin-top:30px;font-size:${size}px;line-height:1.06;letter-spacing:-.035em;font-weight:750;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.foot{margin-top:auto;display:flex;align-items:center;gap:14px;font-size:18px;color:#9CA2B3}
.foot img{height:40px;width:136px;object-fit:contain;background:#fff;border-radius:8px;padding:5px}
.r{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;padding:0 56px 0 24px}
.panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:26px 24px}
.head{display:flex;align-items:center;gap:12px;margin-bottom:18px;font-size:14px;letter-spacing:.1em;color:#9CA2B3;font-weight:700}
.head img{height:26px;width:auto;background:#fff;border-radius:7px;padding:4px 5px}
.row{display:flex;gap:14px;align-items:center;background:#fff;color:#0E1015;border-radius:14px;padding:14px 18px}
.row.mid{background:${theme.accent};color:#0E1015}
.row .n{font:600 14px ui-monospace,Menlo,monospace;opacity:.5}
.row b{display:block;font-size:19px;letter-spacing:-.01em}
.row code{display:block;font:15px ui-monospace,Menlo,monospace;opacity:.7;margin-top:3px}
.arrow{text-align:center;color:${theme.accent};font-size:22px;line-height:1;margin:7px 0}
</style></head><body>
<div class="l"><span class="cat">${esc(meta.category)}</span><h1>${esc(meta.title)}</h1>
<div class="foot"><img src="${icon("tagioo-logo-284.png")}" alt=""><span>tagioo.com/blog</span></div></div>
<div class="r"><div class="panel"><div class="head">${theme.icon ? `<img src="${icon(theme.icon)}" alt="">` : ""}<span>THE EVENT PATH</span></div>${rows}</div></div>
</body></html>`;
}

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH to render covers.`);
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const manifestUrl = new URL("manifest.json", outDir);
const manifest = existsSync(manifestUrl) ? JSON.parse(await readFile(manifestUrl, "utf8")) : {};
const work = join(tmpdir(), `tagioo-covers-${process.pid}`);
await mkdir(work, { recursive: true });

const files = (await readdir(srcDir)).filter((f) => f.endsWith(".md")).sort();
let rendered = 0;
for (const file of files) {
  const slug = file.slice(0, -3);
  const meta = parse(await readFile(new URL(file, srcDir), "utf8"));
  if (!meta.title || !meta.category) continue;
  const hash = createHash("sha1").update(`${TEMPLATE_VERSION}|${meta.title}|${meta.category}`).digest("hex").slice(0, 12);
  const out = new URL(`${slug}.jpg`, outDir);
  if (!force && manifest[slug] === hash && existsSync(out)) continue;
  const html = join(work, `${slug}.html`);
  await writeFile(html, coverHtml(meta));
  const png = join(work, `${slug}.png`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--force-device-scale-factor=1", "--window-size=1200,630", `--screenshot=${png}`, `file://${html}`], { stdio: "ignore" });
  // JPEG keeps covers ~4x smaller than PNG for the card grid. sips ships with macOS.
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", out.pathname], { stdio: "ignore" });
  manifest[slug] = hash;
  rendered++;
  console.log(`cover  ${slug}`);
}
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + "\n");
await rm(work, { recursive: true, force: true });
console.log(`${rendered} cover(s) rendered, ${files.length - rendered} up to date.`);
