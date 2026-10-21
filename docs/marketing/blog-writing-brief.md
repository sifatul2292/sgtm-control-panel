# Tagioo blog writing brief

Source of truth for anyone (human or AI) writing a Tagioo blog post. Posts live as Markdown in
`docs/marketing/blog/<slug>.md` and are built to `public/blog/<slug>.html` by
`node scripts/build-blog.mjs`, which also rebuilds the blog index and `public/sitemap.xml`.

## File format

```markdown
---
title: What Is Server-Side Tracking? A Plain-English Guide for 2026
seoTitle: What Is Server-Side Tracking? Complete Guide (2026)   # optional, <= 60 chars, " | Tagioo" is NOT added automatically when seoTitle is set
description: 140-160 char meta description containing the primary keyword.
category: Getting started   # one of: Getting started, Ecommerce, Meta, Google, TikTok, Privacy, Comparisons, Troubleshooting, Lead generation
keyword: server side tracking
published: 2026-10-20
updated: 2026-10-20
summary: One-sentence card teaser for the blog index (<= 140 chars).
related: slug-one, slug-two, slug-three
featured: false
---
# H1 (same as or close to title; contains the primary keyword)

Opening paragraph...
```

Supported Markdown: `##` (becomes table of contents), `###`, paragraphs, `-` and `1.` lists,
pipe tables with a header row, `> ` callouts, fenced code blocks, `**bold**`, `*italic*`,
`` `code` ``, `[text](url)`. No raw HTML.

Media (each on its own line):

- Image: `![Alt text describing the image](/assets/blog/file.svg "Caption shown under it")`.
  Local files go in `public/assets/blog/`; width/height are read automatically. Prefer SVG
  diagrams (light background, Inter/system font, text >= 13px at 1200px wide).
- YouTube: `@[youtube](VIDEO_ID "Title (Channel)" YYYY-MM-DD)`. Date optional; when given,
  VideoObject schema is emitted. Verify the ID first:
  `curl "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=VIDEO_ID&format=json"`.
  Embeds load from youtube-nocookie only after a click.

A final section titled exactly `## Frequently asked questions` with `### Question?` headings and
1-3 paragraph answers is turned into FAQPage structured data. Every post must have one (4-6 Qs).

## Voice and structure (owner's house style, from their 2021 articles)

- **Open with the reader's situation and questions.** 2-4 one-line paragraphs, conversational
  ("So where did the other 29 go?"). A light touch like "Ahh, so many questions." is fine once.
- **Then a bold direct answer** that repeats the question: `**What is X?** X is ...` (40-60 words).
- **Key takeaways callout** (`> **Key takeaways**` + `> - ...` lines) near the top.
- **"In this guide you'll find…" + "So, why the wait? Let's begin."** before the first H2.
- **Short paragraphs: 1-3 sentences.** Never three long paragraphs in a row. Lots of white space.
- **Question-style H2s** where natural ("Is X necessary?", "How do you…?").
- **Numbered steps and lists with bold labels:** `1. **Fake an ad click.** Visit…`.
- **Tables** for comparisons, step overviews, timelines and "what you see → what it means".
- **Recommended article boxes:** `> **Recommended article:** [Title](/blog/slug)` (hidden
  automatically until the linked post is live).
- Friendly first person plural ("we see this pattern…"); occasional "honestly", "trust us".
- **Visuals:** aim for 3-5 diagrams/charts/illustrations + 2-4 verified videos per long guide.
- **Sources and further reading** list before the FAQ (the FAQ must be the last section).
- **FAQ heading:** `## Related questions` (or "Frequently asked questions"), with `###` questions.

## SEO rules

- Primary keyword in: H1, first 100 words, one H2, meta description, slug.
- Open with a 40-60 word direct answer/definition right after the H1 (featured-snippet bait),
  then the hook.
- Setup guides: numbered steps. Comparisons: a table.
- 4+ internal links to other Tagioo posts/pages (`/blog/<slug>`, `/pricing`, `/woocommerce`,
  `/shopify`, `/how-it-works`, `/docs`, `/compare`, `/website-tracking-checker`, `/signup`).
  Only link to slugs that exist (see list below).
- 2-4 outbound links to authoritative primary sources (Google developers docs, Meta developer
  docs, TikTok business docs, WebKit blog, W3C/MDN). Only URLs you have verified load.
- US English. Audience: US/international ecommerce owners, marketers and agencies.

## Honesty rules (non-negotiable)

- No invented statistics, case studies, customer names, quotes, reviews or results.
- Third-party numbers must be attributed in the sentence ("Stape's pricing page lists...",
  "according to ...") and linked. If you cannot verify a number, leave it out.
- Never promise more sales, a specific % recovery, perfect accuracy or "100% of events".
  Use conditional language: "can recover events that ad blockers would otherwise drop".
- Server-side tracking does NOT bypass consent. Say so where relevant. Never describe
  "evading" blockers or privacy tools as the goal; frame first-party serving as
  reliability on your own domain, subject to the user's consent choices.
- Competitor facts (pricing, features) must come from their own current public page,
  with "as of October 2026" and a link. Be fair; say what they do well.

## Tagioo product facts (only claim these)

- Managed server-side Google Tag Manager (sGTM) hosting. Each customer gets a dedicated,
  isolated sGTM container (not a shared proxy) with preview/debug mode.
- Custom first-party tracking subdomain (e.g. `track.yourstore.com`) with DNS guidance and
  automatic SSL.
- Setup Assistant generates ready-to-import Web and Server GTM container files: GA4,
  Meta Conversions API, TikTok Events API, Google Ads conversions (Conversion Linker, purchase,
  dynamic remarketing). No GTM expertise required; you import, preview, publish.
- Meta CAPI: server events with hashed match keys, fbp/fbc, and event_id deduplication against
  the browser Pixel (purchase event_id = order ID). Full funnel (ViewContent, AddToCart,
  InitiateCheckout, Purchase) is sent server-side from the first-party endpoint.
- Tagioo for WooCommerce plugin: injects GTM, pushes GA4 ecommerce dataLayer with user data,
  fires a server-side purchase hit to sGTM so purchases are recorded even if the thank-you
  page tag never fires; dedup on transaction_id. Optional Custom Loader serves gtm.js/gtag.js
  from your own domain so browsers/extensions that block googletagmanager.com (e.g. Brave)
  still load your tags.
- Plugin 2.6.0+: "Cookie consent" setting, OFF by default (consent not required, same as 2.5.x).
  Options: built-in Tagioo banner (Accept/Reject, Google Consent Mode v2 default denied, Meta
  cookies only after Accept, [tagioo_cookie_settings] reopen link) or "use my own banner plugin"
  (WP Consent API, CookieYes, Complianz, Cookiebot, OneTrust, US Privacy). With consent on, the
  choice is sent with the backend purchase as `consent_marketing`; Tagioo's Meta/TikTok server
  tags skip "denied". Optional "GTM loading: wait for consent". Late-paid orders (>7 days) are
  sent to Meta with the payment-confirmation time. Backend purchase recovery is a paid-plan feature.
- Setup Assistant business types: Ecommerce, Lead generation (generate_lead / contact / schedule →
  GA4, Meta Lead/Contact/Schedule, TikTok SubmitForm/Contact, Google Ads lead conversion),
  SaaS / Subscription, General.
- Shopify: guided setup using a Shopify Custom Pixel; purchases to Meta and GA4 from your own
  tracking domain.
- Dashboard: real-time event counts, Event Logs, Purchase Inspector, "Run tracking test"
  (checks the GA4 server container is published and Meta CAPI credentials work).
- Offline conversion upload; optional first-party cookie lifetime extension.
- Free Website Tracking Checker at `/website-tracking-checker` (scans a public site for tags,
  IDs, consent setup and first-party routing).
- Pricing (USD/month): Free $0 with 15,000 events per 30 days, no card; Starter $30; Pro $50;
  Enterprise $100. Paid plans have a 3-day free trial. Link to `/pricing` for limits.
- Support: hello@tagioo.com.

## Existing slugs (safe to link)

server-side-tracking-explained, tagioo-server-side-tracking-setup,
woocommerce-purchase-tracking-checklist, meta-capi-deduplication-checklist,
conversion-tracking-discrepancies, server-side-tracking-lead-generation,
server-side-gtm-setup, stape-alternative, woocommerce-server-side-tracking,
meta-capi-woocommerce, meta-conversions-api, ad-blocker-tracking-loss,
server-side-tagging-cost, first-party-tracking, safari-itp-ios-tracking,
tiktok-events-api, ga4-server-side-tracking, shopify-server-side-tracking,
google-ads-server-side-tracking
