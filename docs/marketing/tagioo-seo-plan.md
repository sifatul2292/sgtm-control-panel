# Tagioo SEO launch package

Prepared 12 October 2026. International-first, English-language acquisition. This package implements the local foundation and six original launch guides; publishing, Search Console access, live indexing and ongoing authority building remain separate work.

## Positioning and conversion goal

Own the practical workflow between “my store or form recorded a conversion” and “my marketing platforms accepted the event.” Lead with managed server-side GTM hosting, guided implementation and inspectable events. Avoid positioning the service as a guarantee of more sales, perfect accuracy, consent bypass or universal integration support.

Primary outcome: paying customers acquired through organic search. Supporting outcomes: qualified organic visitors, completed signup, verified first event and free-to-paid conversion. Traffic without activation is not the success metric.

## Audit evidence and implemented fixes

The public homepage was readable through web search retrieval. Direct HTTP fetches to eight live URLs returned 403 on 12 October; this may be a request-specific Cloudflare rule and does not establish that Googlebot is blocked. Neither live robots.txt nor sitemap.xml could be verified. See `tagioo-seo-live-audit.json` for exact paths and responses. No Search Console, crawl statistics, keyword-volume account or real-user performance data was available.

Local source had no dedicated sitemap/robots route and no canonical tags on the principal marketing pages. Implemented:

- Public robots.txt and a 15-URL XML sitemap, reachable before authentication.
- Canonical URLs on eight marketing/legal pages, six articles and the blog index. Query variants canonicalize to the clean marketing URL; the actual app shell remains excluded.
- Search-oriented titles and descriptions on six main marketing pages; aligned Open Graph URLs/types and a summary social card.
- Organization and WebSite JSON-LD on the homepage; BlogPosting and BreadcrumbList on articles, with no fabricated ratings, reviews or author credentials.
- A crawlable blog index, six original articles, related-article links and signup/documentation links.
- Blog links in existing marketing navigation without replacing the uncommitted local design work.
- Noindex response headers for the app subdomain and direct app-shell URL. App-host robots excludes that whole hostname; robots is not a security control.

The separate approved homepage preview was not merged into `public/landing.html`. Its hero and later copy revisions still need an intentional production integration. Metadata improvements apply to the existing local marketing files and can travel with either design once consolidated.

## Keyword-to-page map

These are intent-based targets, not measured search volumes or promised rankings.

| Page | Primary intent | Supporting queries | Conversion |
|---|---|---|---|
| `/` | server-side GTM hosting | managed sGTM hosting, server-side tracking hosting | Start free |
| `/features` | server-side tracking tools | event inspection, purchase monitoring | Explore setup |
| `/pricing` | server-side GTM hosting pricing | free sGTM hosting, hosting cost | Select plan |
| `/how-it-works` | server-side tracking setup | GTM server container setup | Start setup |
| `/compare` | managed vs self-hosted sGTM | server-side GTM infrastructure cost | Compare plans |
| `/docs` | Tagioo documentation | Tagioo domain setup, tracking troubleshooting | Verify first event |
| `/blog/server-side-tracking-explained` | what is server-side tracking | browser vs server tracking | Setup guide |
| `/blog/tagioo-server-side-tracking-setup` | Tagioo tracking setup | sGTM launch checklist | Start free |
| `/blog/woocommerce-purchase-tracking-checklist` | WooCommerce purchase tracking | missing purchases, order tracking verification | Supported integration |
| `/blog/meta-capi-deduplication-checklist` | Meta CAPI deduplication | duplicate purchase events, event IDs | Documentation |
| `/blog/conversion-tracking-discrepancies` | conversion tracking discrepancies | orders vs ad conversions, missing events | Diagnose then start |
| `/blog/server-side-tracking-lead-generation` | server-side lead tracking | form conversion tracking, accepted enquiry event | Assess supported source |

Keep commercial and informational pages distinct. The homepage sells hosting; the explainer answers how tracking works. Do not generate many near-identical platform pages before there is a verified implementation and unique walkthrough for each.

## Competitor research and editorial direction

Reviewed Stape's public blog listing, not its complete article archive. Its visible coverage spans implementations, monitoring, attribution, privacy and case studies. This establishes topic categories, not a content template to reproduce. No Stape article body or customer result was scraped, rewritten or attributed to Tagioo.

Tagioo's original advantage should be reproducible evidence: a known order or accepted lead, request inspection, the relevant tag behavior and destination confirmation. Capture those examples on throwaway tenants with test data. Do not borrow competitor performance results or manufacture a case study.

The six launch guides contain 3,376 words in total, written from Tagioo's documented behavior and independently structured diagnostic workflows. Editable sources live in `docs/marketing/blog/`; generated static pages live in `public/blog/`. After an editorial change, update the matching HTML and modified date/schema together. There is no build requirement or CMS dependency.

## Editorial review before publication

1. Run each Tagioo-specific workflow on an isolated test tenant and attach anonymized original screenshots.
2. Confirm current plugin fields and destination requirements. Meta's primary deduplication page could not be fetched because of rate limiting; recheck it before publishing that technical walkthrough.
3. Have the product owner review integration coverage and supported lead sources. The recent six additional platform badges are copy, not verification that Setup Assistant generates those integrations.
4. Check setup timing with a new user. The owner-requested 10-minute/Instagram homepage sentence is unmeasured and should be validated before public use.
5. Review performance language. Missing measurement does not prove lost sales; additional recorded conversions do not prove incremental revenue. Prefer evidence and conditional benefits over guaranteed outcomes.
6. Credit any real author/reviewer only after that person actually reviews the material. Do not add a fictional expert biography.

Avoid bulk rewritten posts: Google's guidance favors useful original material, and its spam policy addresses scaled content made primarily to manipulate rankings. Six well-tested guides are a stronger launch asset than hundreds of renamed competitor articles.

## 90-day editorial schedule

Week 1: deploy the foundation after content and route review; publish the explainer and setup checklist. Week 2: publish WooCommerce purchase checks and the verified Meta deduplication guide. Week 3: publish discrepancies and lead generation. Publishing dates must reflect actual publication; update structured dates if deployment happens later.

Weeks 4–6: add an original annotated event-inspection walkthrough, a verified tracking-domain troubleshooting guide and a practical free-tier capacity worksheet. Derive each from support questions or actual activation friction.

Weeks 7–9: publish one real customer implementation with permission and one agency handover checklist. Document limitations and measured results. No unsolicited outreach or spending is authorized by this package.

Weeks 10–12: refresh pages receiving relevant impressions but few clicks, expand sections that fail to answer reader questions and merge overlapping pages where they compete for the same intent. Prioritize activated customers over a fixed posting quota.

## Launch and indexing checklist

- Keep public marketing at the preferred HTTPS hostname; verify HTTP and www redirects externally without changing Nginx tracking config blindly.
- Consolidate the approved homepage preview with production files before deployment; retain canonical and schema additions.
- Verify 200 responses and correct MIME types for robots, sitemap, blog and each article; confirm a genuinely unknown article returns 404.
- Check Cloudflare crawler access using Search Console URL Inspection and server evidence. A 403 from this research client is not a crawler diagnosis.
- Verify the domain property in Google Search Console using the owner's chosen method. Submit `/sitemap.xml`; inspect homepage, pricing, blog and one article after deployment.
- Confirm canonical selection and rendered content. Keep the localhost review preview noindexed and out of the sitemap.
- Verify app/auth pages are excluded from indexing without treating that as a replacement for authentication.
- Review geo-dependent prices from the crawler's likely default view. Keep canonical pricing understandable; do not add locale hreflang for mere currency switches.
- Run PageSpeed Insights on deployed desktop/mobile URLs. Investigate actual LCP, INP and CLS findings; no Core Web Vitals score is claimed here.
- Confirm signup links, email-prefill behavior, mobile navigation and internal article links.

## Measurement and budget

Use Search Console for query impressions, clicks, position and indexing. Use existing analytics and product data for signup and activation. Track source through signup only with an agreed, privacy-reviewed implementation; do not pretend this package added that attribution pipeline.

Monthly scorecard: non-brand organic clicks; organic verified accounts; accounts completing first-event verification; organic paying customers; paid conversion rate; revenue and retention. Segment stores, leads and agencies where data supports it.

Keep the international launch's $1,000–$3,000 budget concentrated on implementation proof and distribution. A reasonable allocation is 40% for original demonstrations/editorial review, 30% for assisted activation, 20% for targeted promotion of the best guide and 10% for tools or contingency. These are planning allocations, not spend authorization. Avoid purchased backlinks or mass guest-post packages.

Get links by releasing useful test checklists, answering relevant questions with complete explanations and working with real implementation partners. Contacting others and publishing external posts require separate explicit instructions. Ranking improvements usually require ongoing work; no ranking or customer acquisition guarantee is made.

## Sources

- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Google sGTM introduction: https://developers.google.com/tag-platform/tag-manager/server-side/intro
- Google sGTM debugging: https://developers.google.com/tag-platform/tag-manager/server-side/debug
- GA4 ecommerce: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Google Ads attribution reports: https://support.google.com/google-ads/answer/1722023
- Stape blog listing, topic research only: https://stape.io/blog
- Repository product evidence: PROJECT_CONTEXT.md, CURRENT_WORK.md, server.js and tagioo-woocommerce.php.
