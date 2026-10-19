# Marketing site performance (tagioo.com)

Goal: LCP < 2.5s for US mobile visitors while the origin stays in Singapore.

## What the origin does (server.js)

- Marketing pages (`/`, `/features`, `/pricing`, `/compare`, `/how-it-works`, `/docs`,
  `/terms`, `/privacy`, `/refunds`, `/website-tracking-checker`, `/blog/*`) are static
  HTML files from `public/`. `servePublicPage()` inlines their local stylesheets
  (`/assets/*.css`, `/landing.css`) into `<style>` blocks at serve time, then caches
  the result with pre-built Brotli and gzip copies. It rebuilds when the HTML file or
  any of its CSS files changes. There is no build step.
- Headers:
  - Marketing HTML: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`, plus an ETag
  - Versioned assets (`?v=`): `public, max-age=31536000, immutable`
  - Login, app shell, API, redirects and form responses: `private, no-store`
- Marketing HTML never sets cookies. Currency/geo changes happen client-side via
  `/api/geo` (which is `private, no-store`), so one cached copy is correct for everyone.

## Cloudflare setup (live since 2026-10-19)

Cloudflare does not cache HTML by default. One Cache Rule, "Cache marketing pages
(skip logged-in)", makes it do so:

```
(http.host eq "tagioo.com" and (http.request.uri.path in {"/" "/features" "/pricing"
 "/compare" "/how-it-works" "/docs" "/terms" "/privacy" "/refunds"
 "/website-tracking-checker" "/blog" "/blog/" "/shopify" "/woocommerce" "/case-studies"}
 (`/case-studies` is currently removed from the site; the path in the rule is harmless.)
 or http.request.uri.path wildcard "/blog/*")
 and not http.cookie contains "sgtm_session=")
```

- Eligible for cache; Edge TTL follows the origin's `s-maxage`.
- `/` is special: it is the homepage when logged out and the dashboard when logged
  in. The origin sends browsers `Cache-Control: no-cache` for it and gives
  Cloudflare `Cloudflare-CDN-Cache-Control: max-age=3600, stale-while-revalidate=86400`.
  Before this, Cloudflare's Browser Cache TTL (default 4 hours) added
  `max-age=14400`, so browsers kept showing the cached homepage after signup/login.
- Caching → Configuration → **Browser Cache TTL: Respect Existing Headers**, so
  Cloudflare never adds a browser max-age the origin didn't ask for.
- Cache key: **ignore query string**, so ad-click URLs (`?fbclid=`, `?utm_*`) are
  served from the same cached copy. Pages are identical server-side whatever the
  query string, and GTM still reads the full URL in the browser.
- The logged-in exclusion lives inside this rule on purpose. In Cloudflare, when
  several Cache Rules match a request, the later rule wins, so a separate "bypass"
  rule placed first would be overridden. `/` serves the dashboard to logged-in
  users; without this exclusion they could get the cached landing page and be
  stuck in a loop between `/` and `/login`.
- Scrape Shield → Email Address Obfuscation is **off**, so Cloudflare no longer
  injects `email-decode.min.js`. The footer email is a plain `mailto:` link.
- "Challenge signup" (Managed Challenge on `/signup`) is an intentional anti-bot
  custom rule. It stays in place.
- After a content deploy, purge the marketing URLs (Caching → Configuration →
  Purge), or wait up to 1 hour plus the stale-while-revalidate window.

## Front-end changes

- Inter is self-hosted: `public/assets/fonts/inter-latin-var.woff2` (31 KB, variable
  weights 400–800, Latin subset, built from the OFL Inter variable font with fontTools).
  `@font-face` with `font-display: swap` lives in `assets/site-base.css`, inlined into
  every marketing page, and the font is preloaded. No requests to Google Fonts remain
  on marketing pages. (Server-rendered login/signup pages still use Google Fonts.)
- `site-base.css` also holds the region rules: `[data-bd-only]` content (BDT, bKash,
  Nagad, WhatsApp, +880) is hidden unless `/assets/geo.js` adds `html.geo-bd` from
  `/api/geo` (Cloudflare CF-IPCountry, or the `/bd` / `/global` manual switch).
- Case studies and setup videos are rendered server-side from `content/marketing.json`
  into `<!-- tagioo:... -->` markers before caching (see `marketing-content.js`).
  YouTube is click-to-load (thumbnail only until play).
- Logos and the favicon were PNGs of 394–788 KB each, base64-wrapped in SVG. They are
  replaced with 2x-sized AVIF files plus PNG fallbacks (`tagioo-logo-284`,
  `tagioo-logo-light-284`, `tagioo-icon-64`), each 2–21 KB. The old SVGs remain for
  the app and emails.
- AVIF versions added for the Features screenshot and the Docs screenshots. The Docs
  images now have explicit width/height. Footer logos load lazily.
- Removed the dead Cloudflare `email-decode.min.js` script. `home-hero-motion.js` and
  `blog.js` are now `defer`. GTM is unchanged: it was already async, and Meta Pixel,
  GA4 and CAPI all load through it.
- WebP versions of the logos, icon, Features screenshot and Docs screenshots sit
  between the AVIF and PNG `<source>`s.
