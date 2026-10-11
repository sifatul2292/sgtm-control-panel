# Tagioo: brand, launch and first 100 paying customers

Prepared 11 October 2026 (Asia/Dhaka). Strategy: international first. Total 90-day cash budget: $1,000–$3,000, excluding existing infrastructure and founder compensation. Owner: Sifatul. This is an execution plan, not a revenue forecast or authorization to spend, publish, contact prospects, or change billing.

## 1. The recommendation

Launch Tagioo as **managed server-side tracking for ecommerce teams that want setup help and clear purchase-event visibility**.

Start with English-speaking WooCommerce merchants and small performance-marketing agencies serving them. Concentrate outreach on the UK, then test Australia as a separate cohort; expand into the US after establishing repeatable onboarding and support coverage. This geographic choice is an operating hypothesis about founder time-zone fit and reachable prospects, not measured demand. Use existing warm relationships in any country before cold geographic expansion.

Offer a focused tracking review, guided implementation, and a documented verification handoff. Sell recurring hosting and visibility; keep custom consulting bounded. Launch privately to five customers within seven days of satisfying the payment and tracking gates. Target 100 active paying accounts by day 90, with a 120–180-day fallback if early conversion or retention is weaker.

Do not wait for Shopify App Store approval to launch the WooCommerce offer. Do not build an affiliate portal, redesign the entire website, launch a new integration, or buy broad awareness ads to reach the first ten customers.

**First seven-day objective:** five distinct customers with a successfully collected subscription payment and verified tracking. Public signups alone do not establish demand.

## 2. Product truth and readiness

The current repository supports managed sGTM hosting, first-party domains/SSL, generated GTM templates, a Setup Assistant, incoming-event logs, purchase inspection, manual local payments and a Paddle billing implementation. WooCommerce is the best initial integration to validate commercially. These are repository observations; deployment and successful real customer outcomes still require verification.

Current code and public pricing show:

| Plan | USD monthly | Local BDT per monthly cycle | Request allowance | Containers |
|---|---:|---:|---:|---:|
| Free | $0 | ৳0 | 15,000 per 30-day cycle | 1 |
| Starter | $30 | ৳1,200 | 500,000 | 1 |
| Pro | $50 | ৳2,900 | 2,000,000 | 3 |
| Enterprise | $100 | ৳5,900 | 5,000,000 | 5 |

Use Starter/Pro/Enterprise in launch materials. Older architecture notes mention a USD Growth tier and ten Enterprise containers; those conflict with current `server.js` and pricing. Multi-domain management, dedicated IP and BigQuery export are marked coming soon in current public pricing. Do not advertise them as available. Container count is not a promise of equivalent independently managed client stores.

Confirm what the billing meter counts before writing customer FAQs: incoming HTTP requests, GA4 events, orders and downstream platform events are different units. Confirm whether allowances aggregate across containers and how longer local cycles behave. USD is the international launch rail; local pricing is a separate market offer, not a currency conversion.

### Minimum launch gates: finish these, then sell

| Gate | Evidence required | Owner |
|---|---|---|
| International payments | Verify Paddle production approval/configuration, one permitted real payment, webhook activation, renewal state, cancellation, and refund/support process | Founder |
| Customer journey | Fresh customer completes signup, email verification, payment, container creation, domain setup and dashboard access | Founder |
| Tracking | Throwaway WooCommerce store: one test order, stable transaction/event IDs, intended GA4/Meta destinations verified, no duplicate destination purchase | Founder/implementation helper |
| Support | Published hours, working support email/tickets, receipt and response tested | Founder |
| Reliability | Capacity estimate, backup/restore evidence, incident contact and change rollback procedure | Founder |
| Public truth | Live website agrees with real billing and plan limits; no unsupported claims or invented proof | Founder |
| Data handling | Actual data collection, retention, consent and customer responsibilities match public documentation; resolve material gaps before accepting affected stores | Founder |

HTTP 200 at the Tagioo endpoint does not prove Meta or GA4 accepted a purchase, and an accepted event does not prove ad attribution. Verify those layers separately.

Paddle live activation and Shopify approval are outstanding in recent work notes; do not assume approval from the existence of code. If card billing is unavailable, conduct interviews and demos and collect a waitlist. Do not advertise immediate international paid activation through an unverified rail. Shopify marketplace acquisition starts only after actual approval and install/billing verification.

## 3. Ideal customer and buying trigger

### Primary merchant

WooCommerce store, an owner or marketing lead reachable directly, active Meta/Google advertising, recurring orders, access to a developer or someone able to manage DNS/GTM, and an identifiable tracking issue. Qualifying range to test: $3,000–$30,000 monthly ad spend and roughly 100–2,000 monthly orders. These are prospecting filters, not evidence of market size or a requirement to buy.

Buying triggers: conflicting purchase counts, duplicate events, a CAPI setup they cannot verify, a store rebuild, a new media agency, or time spent maintaining tracking infrastructure.

Disqualify prospects with no budget or orders, no ability to grant necessary access, an expectation that tracking guarantees ROAS, unsupported complex stacks, or requirements Tagioo cannot currently satisfy. Avoid high-volume or specially regulated deployments during the first cohort.

### Primary partner

Small ecommerce ad agencies, WooCommerce developers and independent tracking implementers, with approximately 5–30 store clients. Buyer: founder, head of paid media or technical lead. Their job is to keep client tracking working without becoming infrastructure operators.

Start by implementing one client successfully. Ask for additional client introductions only after the first handoff and a retention check. Referral partnerships use separately billed customer accounts initially; no implied white-label interface, agency permissions or bulk billing capability.

### Qualification score

Score each lead 0–2 for paid-ad activity, recurring order volume, concrete tracking pain, access readiness, and decision-maker access. Contact leads scoring at least 7/10 first. Record uncertainty explicitly; public website inspection cannot prove that their tracking is broken.

## 4. Brand platform

**Category:** managed server-side tracking and sGTM hosting.

**Positioning statement:** For ecommerce merchants and agencies who need to understand their purchase tracking, Tagioo provides managed server-side GTM hosting, guided setup and event inspection, so they can verify their implementation and spend less time operating tracking infrastructure.

**Brand promise:** Help you see what your tracking is doing.

**Tagline:** “Know what your tracking is sending.”

**Mission:** Make dependable ecommerce measurement easier to implement, inspect and maintain.

**Personality:** calm, precise, practical, approachable. Speak like an expert who can explain the evidence. Avoid security theater, exaggerated recovery claims and unexplained acronyms.

### Three message pillars

| Pillar | Customer message | Proof to show |
|---|---|---|
| Implementation clarity | Know what to configure and how to verify it | Setup walkthrough, prerequisites, a completed test-order checklist |
| Event visibility | Inspect incoming purchase events and identify repeated transaction IDs | Sanitized real dashboard demonstration, distinction between ingestion and destination acceptance |
| Managed operation | Keep hosting and container operation off your everyday task list | Clear responsibilities, support hours, operational procedures and observed service history |

GA4 and Meta CAPI are implementation context, not the headline. Do not imply Tagioo supplies complete attribution or diagnoses all ad-platform discrepancies.

### Messaging examples

One sentence: “Tagioo helps ecommerce teams set up and inspect server-side tracking, with managed GTM hosting and guided support.”

Merchant pitch: “If you cannot confidently explain what happens to a purchase event after checkout, we can review the setup, configure the supported server-side path and verify a test order together.”

Agency pitch: “Use Tagioo for managed tracking hosting and purchase-event visibility while your team keeps the implementation relationship with the client.”

Bangla/local positioning can later emphasize familiar support and payment methods. Keep the international homepage in clear English with USD pricing and stated support hours.

### Visual direction

Keep the existing warm-white, dark-ink and purple marketing system. Use actual product screenshots with personal data and secrets concealed, readable diagrams and short annotations. One primary action per section. Prefer a demonstration of purchase inspection over decorative dashboards or stock ecommerce photos. Use the existing wordmark; do not delay launch for a logo exercise.

### Claims policy

Use “managed hosting,” “guided setup,” and “inspect incoming events” when verified. Use purchase recovery or deduplication claims only for the supported implementation with explicit verification. Never promise “100% tracking,” “ad-blocker proof,” guaranteed ROAS, blanket privacy compliance, or a numeric uptime SLA without evidence and an operational commitment. No invented customer counts, logos, quotes or uplift percentages.

## 5. Competitive strategy

Stape already offers low-volume free hosting, a broad set of tracking tools, and an agency partner program. Its public pricing snapshot showed Pro at $17/month **billed $200 yearly**, for up to 500K requests; do not present that as a monthly-billing quote. [Stape pricing](https://stape.io/price).

TAGGRS competes with request-based hosting, implementation resources and tracking tools. Recheck currency and billing interval before publishing any price comparison. [TAGGRS pricing](https://taggrs.io/prices/).

Stape advertises up to 40% lifetime partner commissions, alongside agency tools and support. Tagioo cannot assume a small referral percentage alone will persuade established partners to switch. [Stape partner program](https://stape.io/partner-program/agencies-and-freelancers).

**Strategic inference:** “Cheaper hosting” and “server-side tracking” are weak differentiation for an international $30 starting plan. Lead with a narrow supported workflow, founder involvement, an understandable verification handoff and purchase visibility. Prove that package with customer interviews; it is a proposed advantage, not yet a defensible moat.

Win against DIY on operating effort; win a small segment against large providers on implementation attention. Do not claim more features or better infrastructure. For an already satisfied Stape/TAGGRS user, ask about an unmet workflow before offering migration; leave satisfied prospects alone.

Google describes server-side tagging as giving control over server-side data shaping and routing. That supports the category explanation, not an automatic revenue or compliance benefit. [Google server-side tagging introduction](https://developers.google.com/tag-platform/tag-manager/server-side/intro).

## 6. Offer and packaging

### Launch offer: first 20 paying accounts

“Start a paid Tagioo plan and receive one guided setup session plus a written test-order verification checklist.”

Scope: one supported WooCommerce store, one standard GA4/Meta setup, existing DNS/GTM access, one kickoff, one verification session, and seven days of setup follow-up during published business hours. Target no more than 90 minutes total hands-on work per store. Customer subscriptions remain $30/$50/$100; this is a service bonus, not lifetime discounted SaaS.

Exclude custom checkout engineering, historical data repair, paid-media management and unrelated GTM cleanup. Quote extra consulting separately before doing it. Do not make the bonus public until capacity is confirmed. Stop complimentary implementation at 20 accounts, then test a separately quoted setup service or partner-led implementation.

Use Free for evaluation and a test order. Clearly disclose the 15K allowance and that reaching it can pause tracking. A live advertising store should choose an adequately sized paid plan before sending sustained production traffic. Do not position a production tracking interruption as the conversion strategy.

Recommend plans from measured or estimated request volume and actual capacity needs. Pro is a useful default recommendation only when the store needs its allowance/features; do not push unnecessary upgrades. Keep Enterprise's existing name for consistency but avoid implying enterprise security/procurement capabilities.

### Agency pilot

Invite 10 qualified agencies into a one-client pilot. Use one named contact and separate client accounts. Give partners a checklist, short demo and a verification report they can share with client permission. Proposed incentive: 15% of net collected subscription revenue for the first six paid months of each referred account, paid after month two and adjusted for refunds. This is an optional commercial proposal to validate margins before offering, not an existing feature.

Run attribution and payouts manually in a ledger at first. Define referral window, duplicate lead handling, refund adjustments, payout method and customer data boundaries in a short written agreement. Partners can charge clients for implementation themselves. No custom partner software required for the first 100 accounts.

## 7. What 100 customers means and the revenue target

Success is **100 unique, active paying billing accounts**, excluding Free, unpaid claims, internal accounts, complimentary plans, refunded/canceled accounts and duplicate subscriptions. One agency subscription with five containers counts as one account. Five referred merchants with independent paid subscriptions count as five.

Illustrative mix: 60 Starter × $30 + 30 Pro × $50 + 10 Enterprise × $100 = **$4,300 MRR**, $43 average monthly revenue/account. This is an assumption; an all-Starter base would be $3,000 MRR. Setup fees do not count toward MRR. Discounts, refunds, tax treatment and processor deductions reduce cash available.

Plan for **110 gross acquisitions and at most 10 churned/refunded accounts**, leaving 100 active. Replacement demand rises if losses exceed ten. Recalculate weekly from actual paid records; do not count pipeline as customers.

## 8. Acquisition model: required activity

The following is an ambitious scenario, not a benchmark or guaranteed funnel. Leads are unique; introductions and assisted closes receive one primary acquisition source to prevent double counting.

| Channel | Activity over 90 days | Assumed funnel | Gross paid |
|---|---|---|---:|
| Founder merchant outreach | 1,000 qualified first contacts | 15% substantive replies → 60% held reviews → 50% pay | 45 |
| Agency referrals | 100 qualified agency first contacts | 30 substantive conversations → 15 active pilot partners → average 3 independently paying referred clients | 45 |
| Content, live clinics and referrals outside partner cohort | 200 qualified inbound/warm leads | 25% held reviews → 30% pay | 15 |
| Small paid-intent test | 100 qualified visits | 20% leads → 50% held reviews → 50% pay | 5 |
| **Total** | | | **110** |

Agency assumptions require meaningful traction, and a 50% close rate from merchant reviews is demanding. At half the merchant reply rate, a 40% reply-to-review rate and a 35% review close rate, 1,000 contacts produce only about 11 paid accounts. If agency pilots generate one client each rather than three, that channel produces 15 instead of 45. Inbound also starts slowly without an audience. These are reasons to validate early and extend the timeline, not to send indiscriminate messages.

Warm relationships count within their appropriate channel. Partner introductions should request permission before connecting people. No bulk scraping of personal contacts or unsolicited WhatsApp sequences.

## 9. Channel playbooks

### A. Founder outreach: first priority

Sources: public WooCommerce agency portfolios, relevant business directories, LinkedIn company pages, publicly listed business contact channels and existing professional relationships. Manually inspect platform fit and a specific business signal. Track the URL and rationale. Never assert missing purchases based only on browser tools.

Daily target during the sales sprint: 20 new merchant contacts and two agency contacts, five working days/week for ten weeks. Personalize one sentence. Send at most two relevant follow-ups (days 4 and 9), honor opt-outs, and follow the receiving market's outreach requirements. Stop contacting after a decline. Start at five/day while evaluating reply quality and deliverability; scale only when that works.

Email example:

> Subject: Purchase tracking for [Store]
>
> Hi [Name], I saw [specific public detail] on [Store]. I run Tagioo, a managed server-side tracking service for ecommerce teams.
>
> We help WooCommerce stores configure and inspect purchase events across their supported GA4/Meta setup. Would a 15-minute review of your current tracking workflow be useful? I can show what we check before recommending a subscription.
>
> Sifatul — Tagioo
>
> If this is not relevant, let me know and I will not follow up.

Follow-up 1: share a genuinely relevant purchase-event checklist, then ask whether they handle implementation internally. Follow-up 2: close the loop politely. No fake urgency, presumed tracking defect or promise of recovered revenue.

Record: company, platform, country, contact, evidence, fit score, channel, stage, next action/date, reply, objection, session held, activation date, plan, paid date, source, loss reason and opt-out.

### B. Agencies: second priority

Pitch one client, not a fleet migration. Show a five-minute sanitized demo. Ask: Which tracking problems take the most time? Who owns implementation? What would make you try a smaller hosting provider? Is managed setup or recurring hosting actually what you want?

Partner message:

> We are opening a small Tagioo pilot for WooCommerce-focused agencies. Your team keeps the client relationship; we provide managed sGTM hosting, setup guidance and a documented purchase-event verification handoff. Would you like to review one client workflow together before considering referrals?

After a successful pilot, request one introduction; after two retained clients, request the next two. Interview lost agencies too. Manual account handling must be convenient enough for partners before expanding promises.

### C. Content and clinics: evidence first

Publish two useful pieces/week: one screen-recorded demonstration and one checklist, short article or problem explanation. Use LinkedIn for agency discovery, YouTube for searchable walkthroughs and relevant WooCommerce communities with moderator permission. Repurpose one verified demonstration rather than maintaining every network.

First eight pieces:

1. How to verify a WooCommerce test purchase from checkout to destination.
2. Why a server HTTP 200 is not proof of ad-platform attribution.
3. Browser/server event IDs and duplicate-purchase diagnosis.
4. Requests versus orders: how to choose a hosting allowance.
5. A sanitized Tagioo purchase inspection walkthrough.
6. Setup prerequisites: DNS, GTM and analytics access.
7. Merchant order totals versus GA4/Meta reports: what differences mean.
8. What managed hosting covers and what still needs implementation.

Run a live tracking clinic every two weeks starting week two, with a partner inviting relevant merchants. Demonstrate a test store. Goal per clinic: ten qualified attendees, three held reviews, one paid customer. Those leads are included in the inbound target, not extra customers.

### D. Paid marketing: conditional experiment

No paid acquisition before five retained paying customers and a working payment-to-activation path. Start with one high-intent search cohort, e.g. WooCommerce server-side tracking or WooCommerce Meta CAPI setup. Use exact/phrase targeting where available and negatives for jobs, free templates and unrelated searches. Paid search may be too expensive for this budget; test rather than assume it works.

Maximum first test $150. Stop if $100 produces zero qualified leads. If there are leads but no customers after $150, interview them and repair fit/offer before restarting. Expand only when measured subscription CAC and retention support it. Retarget only if a usable, consented audience exists. Avoid cold broad Meta campaigns and paid directory placement initially.

## 10. Sales process

Fifteen-minute review: three minutes on business/platform, four on the current event flow and concern, four on a relevant demonstration, two on fit and plan, two on next action. Request read-only access only when needed; do not ask for passwords in email.

Deliver a short summary: observed issue versus unverified concern, supported implementation, prerequisites, success checks, appropriate plan, setup scope and next step. Send a checkout link only for a working billing rail. Follow up within two business days if the prospect requested a proposal.

Objections:

- “Why not Stape?” — “They offer a mature platform. Tagioo may fit if guided setup and a clear purchase-event handoff solve a gap for your team. Let's check that first.”
- “Will ROAS improve?” — “We can verify event delivery and deduplication. Advertising performance also depends on creative, targeting, consent and attribution; we cannot guarantee a lift.”
- “We already have CAPI.” — “Then the review is about verifying the existing setup. If it works well, you may not need a change.”
- “We cannot do DNS/GTM.” — “We need an authorized technical contact. We can guide a supported setup, but custom development needs a separate scope.”
- “Can five clients share Enterprise?” — “We will confirm capacity, domains and access separation first. Container count alone does not establish client-management support.”

## 11. Conversion website and proof

Homepage headline: **“Know what your tracking is sending.”**

Subhead: “Managed server-side GTM hosting for ecommerce teams. Set up your supported tracking flow, inspect incoming purchase events and get guided help when you need it.”

Primary CTA: “Book a tracking review.” Secondary: “Explore the Free plan.” Provide a simple working booking or contact route; a full sales platform is unnecessary.

Page order: audience/problem → short real demo → three benefits with evidence → how setup works → supported WooCommerce scope → pricing → real case study → responsibilities/FAQ → CTA. Existing design can support this; the plan does not require a new site.

Minimum assets: homepage offer, WooCommerce implementation page, pricing, a setup checklist, five-minute demo, booking/contact path, and clear support/legal pages. Add an agency page after partner conversations establish the correct offer. Competitor comparisons should describe responsibilities and suitability rather than an unsupported winner matrix.

Case-study protocol: obtain customer permission; use a defined date range and the same supported order cohort; separate eligible paid orders, Tagioo ingestion, destination acceptance, deduplication and attributed conversions. State cancellations, consent restrictions, attribution windows and incomplete data. Avoid treating a before/after difference as causal proof of revenue growth. Secure permission before naming existing stores or using logos.

## 12. Onboarding and retention

Activation is a connected first-party domain plus a verified supported test order, with expected destination acceptance and deduplication checked. Count “receiving any event” separately. Target activation within two business days after receiving complete prerequisites; this is an internal operating goal until proven, not a public guarantee.

Sequence:

- Immediately: receipt, prerequisites and setup booking link.
- Day 1: help with DNS/GTM if not completed.
- Day 3: verified test-order checklist and exact remaining gaps.
- Day 7: customer review of incoming events and any platform discrepancy.
- Day 14: short check-in; resolve recurring setup issues.
- Day 21: ask activated, satisfied customers for one introduction.
- Day 28: verify billing understanding and monitor renewal/cancellation signals.

Send fewer messages when the customer has already completed the step. Publish founder support hours in Dhaka and UTC, verify daylight-saving conversions for customer appointments, and offer two appointment windows/week appropriate to target markets. Do not imply 24/7 staffed support.

Watch canceled/failed payments, stopped containers, zero incoming events, unfinished DNS and repeated support incidents. Compare drops against each store's normal traffic before labeling an outage. Use existing product signals/manual reviews; do not add expensive per-tenant scans to the owner dashboard.

## 13. Budget and unit economics

Cash allocation ceilings, released in stages rather than prepaid:

| Item | $1,000 plan | $3,000 plan |
|---|---:|---:|
| Email, scheduling and simple CRM/tools | $120 | $180 |
| Prospect research assistance | $180 | $500 |
| Demo editing and case-study production | $100 | $250 |
| Implementation/support contractor reserve | $250 | $900 |
| Conditional paid-intent test | $150 | $500 |
| Partner/referral payout reserve | $100 | $370 |
| Contingency | $100 | $300 |
| **Total** | **$1,000** | **$3,000** |

Use existing tools before subscribing. At $1,000, the founder does most research and delivery. At $3,000, fund implementation capacity and lead quality before increasing ads. Referral liabilities can extend beyond day 90; the reserve does not cover all future payouts. Track and fund those from collected revenue under written terms.

Suggested economic gate: monthly contribution after payment fees, refunds, variable hosting, recurring support and partner commissions of at least $25/account. This is a hypothesis to measure, not current margin. Set a three-month acquisition payback ceiling: at $25 contribution, maximum fully loaded CAC is $75. If contribution is $15, the ceiling falls to $45. Report one-time implementation cost in CAC; report ongoing support in contribution to avoid double counting.

A $1,000–$3,000 cash budget divided by 110 gross wins is $9.09–$27.27 cash spend/account. It is **not** a credible fully loaded CAC estimate without labor. Example: 300 acquisition/onboarding hours at an assumed $15/hour add $4,500, yielding roughly $50–$68 total CAC/account. Replace all illustrative costs with actuals.

At 100 accounts, 60 Starter + 30 Pro + 10 Enterprise could provision up to 200 included containers if every entitlement is used. Even just one container/account has meaningful memory and concurrency demand. Use actual worker capacity and usage data, not request allowances alone, before scaling. No infrastructure cost or margin has been verified by this plan.

## 14. Capacity: what the founder must sustain

The funnel implies about 180 merchant/inbound/paid held reviews, 30 agency conversations and 110 onboardings in 90 days. At 20 minutes/review including notes, 30 minutes/agency conversation and 90 minutes/onboarding, that is about 240 hours before prospect research, follow-ups, content and support. Researching 1,100 first-contact leads at five minutes each adds about 92 hours.

Allow roughly 30–40 founder hours/week during the launch sprint, with a contractor reserve. Once onboarding consumes more than ten hours/week or appointments wait more than two business days, train a helper on the supported checklist or restrict the offer. A part-time founder should use a longer timeline. Never keep expanding acquisition while setup and support queues deteriorate.

## 15. Ninety-day execution calendar

Day 1 is 12 October 2026; all dates below are Dhaka calendar dates. If critical gates are unresolved, shift the selling dates rather than pretending launch happened.

| Period | Main work | Gross paid target | Active paying target |
|---|---|---:|---:|
| Days 1–7, Oct 12–18 | Verify gates; demo/checklist; 25 warm/qualified conversations; first cohort | 5 | 5 |
| Days 8–30, Oct 19–Nov 10 | Daily outreach; first agency pilots; two clinics; permissioned proof | 25 cumulative | 23 |
| Days 31–60, Nov 11–Dec 10 | Repeat best segment; first referrals; conditional search test; delivery helper | 65 cumulative | 60 |
| Days 61–90, Dec 11–Jan 9, 2027 | Partner expansion; referrals; renewals; replacement acquisition | 110 cumulative | 100 |

October 12: verify payment and customer flow, publish actual support hours, define tracking verification checklist.
October 13: record demo; prepare 30 qualified merchant and 10 agency leads; refine outreach.
October 14: conduct first reviews; validate pricing/offer objections; inspect a throwaway order end to end.
October 15: onboard first suitable paid customers; document time and setup friction.
October 16: ask successful pilot users for feedback; begin agency conversations.
October 17: close open prerequisite gaps; draft first evidence-based story with permission.
October 18: decide whether to open the next cohort based on payment, activation and support evidence.

Weekly rhythm: Monday funnel and cohort review; Tuesday/Wednesday sales and implementation; Thursday demo or clinic plus partner meetings; Friday retained-customer check, next week's lead list and cash review. Protect a daily follow-up block.

## 16. Scorecard and decisions

Track weekly: unique qualified contacts, substantive replies, held reviews, activated accounts, gross paid, active paid, renewals, churn/refunds, MRR, source, cash CAC, labor hours, contribution estimate, support load and unresolved tracking incidents. Merchant and agency funnels stay separate. Measure signup conversion only after source attribution is reliable.

| Signal | Initial decision rule |
|---|---|
| Contact-to-substantive reply | Below 8% after 100 delivered qualified merchant contacts: revise segment/message before more volume |
| Reply-to-held review | Below 40%: simplify invitation, availability and follow-up |
| Held review-to-paid | Below 25% after 20 reviews: review pain, trust, pricing and implementation scope |
| Paid activation | Fewer than 80% activated within two business days of complete prerequisites: fix onboarding before more spend |
| Early retention | More than 10% cancel/refund within 30 days of payment in the first cohort: investigate before scaling |
| Agency leverage | Fewer than five active pilots by day 30: agency assumptions are too optimistic; extend timeline or shift to merchant sales |
| Capacity | More than ten implementation hours/week or growing support backlog: assign helper or limit cohort |
| Paid spend | No qualified leads after $100 or no sale after $150 initial test: pause and diagnose |

At day 14, require evidence of paid demand and a reproducible activation path. At day 30, if fewer than 15 active paying accounts exist, move the 100-account target to 120–180 days and concentrate on the best-converting segment. If more than 25 exist but quality is weak, fix delivery first. Small sample sizes make percentages noisy: review individual reasons alongside ratios.

## 17. Launch scope and next actions

Do now: verify the international checkout, choose one supported WooCommerce configuration, finish the demo/checklist, build the first 40 qualified leads and conduct reviews. Use the current brand system. Reconcile public pricing against deployed behavior. Keep real evidence and sales objections in a weekly ledger.

Do later: Shopify marketplace launch after approval, broader integrations, automated referrals, multilingual content, annual promotions, broad paid acquisition and extensive SEO. Avoid lifetime deals: indefinite hosting/support obligations can consume the first customers' revenue.

The practical route is five proven implementations, then 20 repeatable onboardings, then agencies and referrals scaling a product customers retain. The first 100 is a sales-and-delivery goal as much as a marketing goal.

## Source and assumption notes

Product evidence: `PROJECT_CONTEXT.md`, `CURRENT_WORK.md`, `public/pricing.html`, and `server.js` pricing/resource definitions, inspected 11 October 2026. Current code supersedes conflicting older notes for this plan; deployed behavior remains unverified here.

External primary sources: [Stape pricing](https://stape.io/price), [Stape agency program](https://stape.io/partner-program/agencies-and-freelancers), [TAGGRS pricing](https://taggrs.io/prices/), [Google server-side tagging introduction](https://developers.google.com/tag-platform/tag-manager/server-side/intro), reviewed 11 October 2026. Pricing snapshots may display different billing/currency settings; recheck before publication.

All conversion rates, market filters, channel yields, contribution targets, contractor costs, timing goals and proposed referral terms are planning assumptions. No customer-count baseline, actual margins, ad account results, live Paddle approval or demand survey was available. If existing paying accounts are verified, subtract their retained active count from the net acquisition gap and adjust the pipeline.
