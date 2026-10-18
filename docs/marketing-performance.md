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

## Cloudflare setup (manual, required for the TTFB win)

Cloudflare does not cache HTML by default (`cf-cache-status: DYNAMIC` today), so the
origin headers alone change nothing at the edge. Add a **Cache Rule**:

- **Bypass first (put this rule above the next one):** when `http.cookie contains "sgtm_session="`, set Cache eligibility to **Bypass cache**.
  `/` serves the landing page to visitors who are not logged in and the dashboard to
  users who are. Without this bypass, a logged-in user could get the cached landing
  page at `/`. Their `/login` would then redirect back to `/`, and they would be stuck.
- **Then cache:** when the hostname is `tagioo.com` and the URI path is one of
  `/`, `/features`, `/pricing`, `/compare`, `/how-it-works`, `/docs`, `/terms`,
  `/privacy`, `/refunds`, `/website-tracking-checker`, or starts with `/blog`:
  set eligibility to **Eligible for cache** and Edge TTL to **Use cache-control header if present**.
- Optional: turn off Scrape Shield → Email Obfuscation. The footer email is now a plain
  `mailto:` link. When obfuscation is on, Cloudflare injects `email-decode.min.js`,
  which rewrites the page's HTML in the browser after it loads.
- After a content deploy, purge the marketing URLs, or wait up to 1 hour plus the
  stale-while-revalidate window.

## Front-end changes

- The Google Fonts CSS now loads without blocking render (`preload` + `onload`, with a
  `<noscript>` fallback) and keeps `display=swap`. Self-hosting Inter is a follow-up
  (it needs the woff2 files downloaded).
- Logos and the favicon were PNGs of 394–788 KB each, base64-wrapped in SVG. They are
  replaced with 2x-sized AVIF files plus PNG fallbacks (`tagioo-logo-284`,
  `tagioo-logo-light-284`, `tagioo-icon-64`), each 2–21 KB. The old SVGs remain for
  the app and emails.
- AVIF versions added for the Features screenshot and the Docs screenshots. The Docs
  images now have explicit width/height. Footer logos load lazily.
- Removed the dead Cloudflare `email-decode.min.js` script. `home-hero-motion.js` and
  `blog.js` are now `defer`. GTM is unchanged: it was already async, and Meta Pixel,
  GA4 and CAPI all load through it.
- WebP was not generated because there is no WebP encoder on the dev machine. AVIF
  with a PNG fallback covers every current browser.
