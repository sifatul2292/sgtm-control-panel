# Tagioo keyword research — Google autocomplete (2026-10-20)

How this list was made: Google's public autocomplete (US, English). For each of 9 seeds
(server side tracking, server side tagging, server side gtm, sgtm, conversions api, meta capi,
facebook capi, first party tracking, stape) we queried the seed alone, `seed a…z/0…9`,
`a…z seed`, and question/modifier words (how, what, why, is, does, can, vs, best, free, for,
without, with, cost, setup, not working, example). That gave 2,072 raw suggestions. After
removing noise (the Moroccan SGTM company, Marine Corps "SgtMaj", the stapes ear bone,
"meta capital", currency-conversion APIs and similar) **771 relevant queries** remain. They're
in `google-autocomplete-2026-10-20.csv`.

Autocomplete shows what people type. It doesn't show search volume. Use Search Console
impressions, once they arrive, to rank these.

Status key: **LIVE** = published · **QUEUED** = written and scheduled (date shown) · blank = not written yet.

## Already covered

| Article | Queries it targets | Status |
|---|---|---|
| server-side-tracking-explained | what is server side tracking, meaning, definition, explained, how does it work, vs client side, benefits/advantages, is it worth it, why use, diagram, example | LIVE |
| stape-alternative | stape alternative, stape pricing, stape cost, what is stape io | QUEUED 10-21 |
| woocommerce-server-side-tracking | woocommerce server side tracking, server side tracking wordpress/plugin | QUEUED 10-22 |
| server-side-gtm-setup | server side gtm setup/implementation/container, how to set up server side tagging, in gtm, via gtm | QUEUED 10-23 |
| meta-conversions-api | conversions api meta, setup, vs pixel, deduplication, event id, emq, parameters, payload, how it works | QUEUED 10-24 |
| meta-capi-woocommerce | conversion api woocommerce, woocommerce facebook capi | QUEUED 10-25 |
| shopify-server-side-tracking | server side tracking shopify, best server side tracking shopify, conversions api shopify | QUEUED 10-26 |
| ga4-server-side-tracking | server side tracking ga4, ga4 gtm server side tracking | QUEUED 10-27 |
| server-side-tagging-cost | server side tracking cost/price/pricing, gtm server side pricing, google server side tagging cost | QUEUED 10-28 |
| ad-blocker-tracking-loss | ad blockers vs tracking | QUEUED 10-29 |
| first-party-tracking | first party tracking, first party domain tracking, first party server side tracking, first vs third party | QUEUED 10-30 |
| tiktok-events-api | server side tracking tiktok, conversions api tiktok | QUEUED 10-31 |
| safari-itp-ios-tracking | ITP / iOS | QUEUED 11-01 |
| google-ads-server-side-tracking | server side tracking google ads, google ads server side tracking, server side conversion tracking google ads, google tag gateway vs server side, google ads conversion tracking setup / in GTM / extension, is it necessary, is it legal, $20/day | QUEUED 10-21 |

## New article candidates (pick which to write)

### A. Google Ads (big gap, high commercial intent)
1. **Google Ads server-side tracking**: server side tracking google ads, google ads server side tracking, server side conversion tracking google ads, google ads conversion tracking server side, what is server side tracking google ads
2. **Google Ads + Meta deduplication when tracking server-side**: google ads server side tracking deduplication
3. **Google tag gateway vs server-side tagging**: google tag gateway vs server side tracking/tagging/gtm. Google launched this recently, so few pages compete yet.

### B. Tools and comparisons (commercial)
4. **Best server-side tracking tools/software (listicle)**: server side tracking tools, software, platform, solutions, service, best server side tracking
5. **Stape vs Elevar**: stape vs elevar, elevar server side tracking
6. **TAGGRS review / Tagioo vs TAGGRS**: taggrs server side tracking reviews, server side tracking taggrs
7. **JENTIS, Tealium and other enterprise options**: jentis/tealium/bloomreach server side tracking
8. **Server-side tracking vs server-side tagging**: server side tracking vs server side tagging, and tagging vs tracking

### C. Meta CAPI deep dives
9. **Conversions API Gateway vs CAPI via server GTM**: conversions api gateway, what is CAPI gateway, gateway cost, conversions api vs conversions api gateway
10. **How to get a Meta Conversions API access token / system user**: conversions api access token, system user, how to get token, remove/delete system user. These are frequent "how do I" queries.
11. **Meta CAPI with Google Tag Manager**: meta capi gtm, conversions api google tag manager, facebook capi gtm server side
12. **Conversions API for CRM / offline events (lead gen)**: conversions api for crm, offline events, hubspot/zoho/gohighlevel/kommo CAPI
13. **Meta CAPI test events and troubleshooting**: meta capi test, capi status, not working
14. **Is the Conversions API free?**: is conversions api free, does conversions api cost money
15. **Meta CAPI for WordPress (non-Woo)**: conversions api wordpress, wordpress plugin
16. **CAPI via Zapier / n8n**: conversions api zapier, n8n facebook capi

### D. Other ad platforms' CAPIs
17. **Pinterest Conversions API**: conversions api pinterest, pinterest setup
18. **Snapchat Conversions API**
19. **Microsoft (Bing) Ads server-side tracking**: bing ads server side tracking, bing conversions api
20. **X (Twitter) Ads Conversion API**
21. **Amazon Ads Conversions API**: conversions api amazon (ads)
22. **Affiliate networks (Awin, Taboola, Criteo) server-side**

### E. Privacy and consent
23. **Is server-side tracking GDPR compliant?**: gdpr, dsgvo, privacy
24. **Server-side tracking and cookie consent / Consent Mode**: cookie consent, consent, consent mode advanced, cookiebot, usercentrics
25. **Does server-side tracking use cookies? (vs cookies)**: server side tracking vs cookies, does it use cookies, cookies

### F. Hosting and technical setup
26. **Self-hosted / open-source / Docker sGTM**: self hosted, open source, docker, github
27. **sGTM on Google Cloud (Cloud Run) step by step**: google cloud, gcp, run.app
28. **sGTM on AWS / Azure**
29. **Cloudflare and server-side tracking (Zaraz, workers)**
30. **sGTM preview and debugging**: gtm server side preview
31. **Measurement Protocol in server GTM**: gtm server side measurement protocol
32. **How to check if a website uses server-side tracking**: server side tracking checker. Use it to promote the free `/website-tracking-checker`.
33. **Server-side tracking and attribution**

### G. Analytics and product tools
34. PostHog server-side tracking
35. Mixpanel / Amplitude server-side tracking
36. Matomo / Umami (privacy analytics) server-side
37. Klaviyo server-side tracking
38. HubSpot server-side tracking
39. Adobe Analytics server-side

### H. Other platforms
40. Magento 2 server-side tracking
41. Webflow server-side tracking
42. Next.js server-side tracking (also conversion api nextjs)
43. Mobile apps (server side gtm for apps)

### I. Service/hiring intent (landing page, not blog)
44. **Server-side tracking agency / consultant / expert / specialist / Fiverr / Upwork**: a "Done-for-you setup" or agency/partner page converts better here than a blog post.
45. **Server-side tracking course / tutorial**: a long free tutorial hub.

### Non-English demand seen (later, not for US launch)
German (einrichten, kosten, vorteile, dsgvo), Dutch (wat is, voordelen, instellen), Portuguese
(o que é), Spanish (que es), French (c'est quoi), Turkish (nedir), Vietnamese (là gì), and
**Bangla ("server side tracking bangla")**, which is relevant to Tagioo's BD customers.

## Publishing cadence

The generator holds back posts until their `published:` date. On each publish day:
`npm run build:blog`, deploy, then request indexing in Search Console. Google doesn't penalize
publishing several good posts at once. Steady publishing still helps with crawl rhythm,
gives each post time to pick up internal links, and lets us learn from Search Console as we go.
