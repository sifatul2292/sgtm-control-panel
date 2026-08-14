#!/usr/bin/env node
// Static-fetch tracking audit for outreach leads.
// Usage: node scripts/audit-scan.js <url> [--json]

const url = process.argv[2];
const asJson = process.argv.includes('--json');

if (!url) {
  console.error('Usage: node scripts/audit-scan.js <url> [--json]');
  process.exit(1);
}

function normalizeUrl(input) {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

async function fetchHtml(target) {
  const res = await fetch(target, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function detectPlatform(html) {
  if (/cdn\.shopify\.com|Shopify\.shop|shopify-checkout/i.test(html)) return 'Shopify';
  if (/wp-content|wp-json|woocommerce/i.test(html)) return 'WooCommerce';
  return 'Unknown';
}

function detectGtm(html) {
  const gtmMatch = html.match(/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)/i);
  const gtagMatch = html.match(/googletagmanager\.com\/gtag\/js\?id=([A-Z0-9-]+)/i);
  const configMatch = html.match(/gtag\(\s*['"]config['"]\s*,\s*['"]([A-Z0-9-]+)['"]/i);
  const bareLoad = /(?:^|["'(=\s])(?:https?:)?\/\/www\.googletagmanager\.com\//i.test(html);
  return {
    found: Boolean(gtmMatch || gtagMatch || configMatch),
    containerId: gtmMatch?.[1] || gtagMatch?.[1] || configMatch?.[1] || null,
    bareLoad,
  };
}

function detectMetaPixel(html) {
  const initMatch = html.match(/fbq\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/i);
  const bareLoad = /connect\.facebook\.net\/[^"'\s]*fbevents\.js/i.test(html);
  return {
    found: Boolean(initMatch) || /fbq\(function|fbevents\.js/i.test(html),
    pixelId: initMatch?.[1] || null,
    bareLoad,
  };
}

function detectFirstPartyProxy(html) {
  // Custom loader / self-hosted gtm.js path, e.g. /tagioo-loader, /gtm.js served same-origin
  return /src=["'](?:\/|https?:\/\/[^"']*\/)(?:gtm|tag|track|analytics)[-_./][^"']*\.js["']/i.test(html)
    && !/googletagmanager\.com/i.test(html.match(/src=["'][^"']*(?:gtm|tag|track|analytics)[-_./][^"']*\.js["']/i)?.[0] || '');
}

function computeRisk(signals) {
  const flags = [];
  let score = 0;

  if (signals.gtm.found && signals.gtm.bareLoad) {
    flags.push('GTM loads from bare googletagmanager.com — blocked by Brave and most adblockers by domain match.');
    score += 30;
  }
  if (signals.meta.found && signals.meta.bareLoad) {
    flags.push('Meta Pixel loads from bare connect.facebook.net — blocked by adblockers, iOS ATT further degrades browser-only signal.');
    score += 30;
  }
  if (signals.meta.found && !signals.firstPartyProxy) {
    flags.push('No visible server-side/first-party proxy for Meta — conversions likely browser-only, CAPI status unconfirmed from outside (high probability missing).');
    score += 25;
  }
  if (signals.gtm.found && !signals.firstPartyProxy) {
    flags.push('No first-party tag-serving proxy detected — full exposure to browser tracking prevention (ITP, Brave, Firefox ETP).');
    score += 15;
  }
  if (!signals.gtm.found && !signals.meta.found) {
    flags.push('No GTM/GA4 or Meta Pixel detected at all — either not running ads tracking, or tags load dynamically (not visible to static scan).');
  }

  return { score: Math.min(score, 100), flags };
}

function renderScoreCard(target, platform, signals, risk) {
  const lines = [];
  lines.push(`Tracking Audit — ${target}`);
  lines.push('='.repeat(40));
  lines.push(`Platform: ${platform}`);
  lines.push(`GTM/GA4: ${signals.gtm.found ? `found (${signals.gtm.containerId || 'id not parsed'})` : 'not detected'}`);
  lines.push(`Meta Pixel: ${signals.meta.found ? `found (${signals.meta.pixelId || 'id not parsed'})` : 'not detected'}`);
  lines.push(`First-party proxy: ${signals.firstPartyProxy ? 'yes' : 'no'}`);
  lines.push('');
  lines.push(`Signal-loss risk score: ${risk.score}/100`);
  if (risk.flags.length) {
    lines.push('');
    lines.push('Flags:');
    for (const f of risk.flags) lines.push(`  - ${f}`);
  }
  return lines.join('\n');
}

async function main() {
  const target = normalizeUrl(url);
  const html = await fetchHtml(target);

  const platform = detectPlatform(html);
  const gtm = detectGtm(html);
  const meta = detectMetaPixel(html);
  const firstPartyProxy = detectFirstPartyProxy(html);
  const signals = { gtm, meta, firstPartyProxy };
  const risk = computeRisk(signals);

  if (asJson) {
    console.log(JSON.stringify({ url: target, platform, signals, risk }, null, 2));
  } else {
    console.log(renderScoreCard(target, platform, signals, risk));
  }
}

main().catch((err) => {
  console.error(`Scan failed for ${url}:`, err.message);
  process.exit(1);
});
