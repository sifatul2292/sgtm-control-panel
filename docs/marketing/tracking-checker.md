# Tagioo website tracking checker

Public route: `/website-tracking-checker`. API: `POST /api/public/tracking-checker`, JSON `{ "url": "https://example.com" }`.

The first version inspects public HTML and up to three same-origin scripts. It finds recognizable tracker references/IDs (GTM, GA4, Ads, Meta, TikTok, Clarity, Microsoft Advertising, Hotjar, LinkedIn and PostHog), platform clues, consent/data-layer references, first-party routing hints and Set-Cookie attributes. Findings distinguish observed evidence from not-observed clues. Reports can be downloaded as JSON or printed.

This is source inspection, not a headless-browser audit. It does not execute JavaScript, consent to tracking, trigger purchases, read private containers, or prove server-to-server delivery. Multiple IDs are a review prompt rather than proof of duplicate events. It does not estimate ad-spend losses, conversions, browser cookie lifetime or page speed. No invented quality score.

## Boundaries

- Standard Node modules only; no package changes. Shared marketing chrome, original report UI, no competitor code or artwork copied.
- HTTP/HTTPS public targets only. All DNS answers validated; selected public address pinned to the socket. Every redirect revalidated; HTTPS downgrade rejected. Linked scripts cannot redirect outside the page origin.
- Private, loopback, link-local, reserved, mapped/transition addresses, credentials and non-default ports rejected.
- 15-second total deadline, at most three redirects per resource, 2 MB per response including decompression, three concurrent scans per process, eight API requests per IP per ten minutes.
- Up to 50 reports cached in process memory for five minutes, then deleted. Reports never persist to account/database storage. Cookies contain names/attributes only, no values; raw source never returned.
- Some sites block automated requests or return challenge HTML. Results describe the response observed, not all pages or logged-in/consented visitor behavior.
- URL policy intentionally errs toward rejecting unusual IPv6 deployment ranges. DNS/private network fixtures must remain blocked; don't disable the guard for previews.

## Validation

`npm run check`, `node --check public/assets/tracking-checker.js`, `node --test test/tracking-checker.test.js`.

Use a separate empty-data local server for end-to-end checks; avoid starting preview against production history/customer state. Successful public scans of example.com and stape.io verified. tagioo.com timed out from this machine using both the checker and curl; this was not silently treated as a missing-tracker report.

For runtime tracking/network/cookie analysis in a future version, use a separately isolated browser worker with outbound network enforcement for every page/subresource request, queue limits and a documented consent scenario. A browser loaded directly into the main monolith would bypass the current safety boundary and introduce a deployment dependency.
