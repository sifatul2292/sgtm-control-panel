---
name: tagioo-tracking-check
description: Check a website's analytics and ad tracking (GA4, Google Ads, Meta Pixel and Conversions API, TikTok, Pinterest and more) with Tagioo's free tracking checker, explain the issues found and how to fix them, and set up server-side tracking with Tagioo when the user wants it.
---

# Check a website's tracking with Tagioo

Use this skill when a user asks whether their site's tracking works, whether they have
server-side tracking or Meta Conversions API, why ad platforms report fewer conversions than
their store, or how to set up server-side tracking.

## 1. Run a free check

Pick one:

- **Browser:** open `https://tagioo.com/website-tracking-checker?url=<domain>` (for example
  `?url=example.com`). The scan starts by itself and takes 5 to 20 seconds. The page then moves
  to a shareable report link (`/website-tracking-checker/r/<id>`, valid for 90 days).
- **HTTP:** `POST https://tagioo.com/api/public/tracking-checker` with the JSON body
  `{"url": "example.com"}`. The response is the report as JSON. It is limited to 8 scans per
  10 minutes per IP address, so run one scan per site and reuse the result.

Only scan public sites the user owns or asks about. The checker reads the page, its scripts,
the published Google Tag Manager container, Shopify app pixels, the Meta pixel's public
configuration and the server container's health check. It does not click, accept cookies or
place orders.

## 2. Read the report

| Field | Meaning |
|---|---|
| `score`, `grade` | 0–100 and A–F. `null` / `?` means the site couldn't be read (a JavaScript app or tags waiting for consent). |
| `summary` | One-sentence result to quote to the user. |
| `areas[]` | Scores for Analytics, Advertising, Server-side, and Consent & cookies. |
| `destinations[]` | Each platform found, where it's installed (`via`) and its `server.status`: `confirmed`, `configured`, `possible` or `not-detected` (browser-only). |
| `issues[]` | Problems sorted by impact: `severity`, `title`, `detail`, `fix[]` (steps) and `points` (score gained by fixing it). |
| `emq` | Estimated Meta Event Match Quality (0–10). An estimate: the real score is in Meta Events Manager. |
| `adImpact` | Prediction based on Meta's and Google's published averages, with sources. Never present it as a promise. |
| `shareId` | Report link: `https://tagioo.com/website-tracking-checker/r/<shareId>`. |

When you explain results:

- Start with the highest-severity issues and give the `fix` steps in order.
- `possible` means a server path exists but can't be seen from outside. Ask the user to check
  the platform (for Meta: Events Manager → the pixel → Overview → events with the "Server"
  connection method).
- Server-side tracking does not bypass consent. Visitors' consent choices still apply.

## 3. Set up server-side tracking with Tagioo (optional)

If the user wants the issues fixed with Tagioo:

1. Sign up at `https://tagioo.com/signup`. The free plan includes 15,000 events per 30 days
   with no card. Paid plans are listed at `https://tagioo.com/pricing`.
2. Add a tracking subdomain such as `track.example.com` and create the DNS record the
   dashboard shows. SSL is issued automatically.
3. Run the Setup Assistant. It generates ready-to-import Web and Server GTM containers for
   GA4, Meta Conversions API, TikTok Events API and Google Ads.
4. WooCommerce: install the Tagioo for WooCommerce plugin. Shopify: follow the guided
   Custom Pixel setup at `https://tagioo.com/shopify`.
5. Import, preview and publish the containers, then use "Run tracking test" in the dashboard
   and re-run the checker.

More: `https://tagioo.com/llms.txt`, `https://tagioo.com/docs`. Support: hello@tagioo.com.
