---
title: Server-Side Tracking Cost: How Much Does Server-Side GTM Cost in 2026?
seoTitle: Server-Side Tracking Cost: sGTM Pricing Compared (2026)
description: Server-side tagging cost explained: Google Cloud Run vs managed sGTM hosting, provider prices compared, hidden costs and how to estimate your event volume.
category: Getting started
keyword: server side tracking cost
published: 2026-10-28
updated: 2026-10-28
summary: What server-side GTM really costs: Cloud Run self-hosting, managed plans compared, hidden costs and a simple way to estimate volume.
related: server-side-tracking-explained, server-side-gtm-setup, stape-alternative
featured: false
---
# Server-Side Tracking Cost: How Much Does Server-Side GTM Cost in 2026?

You've decided to try server-side tagging. Then you open three pricing pages.

One charges per request. One per event. Google Cloud shows a calculator with vCPUs and gibibytes.

So what will it actually cost *you*? And is "free" ever really free?

Let's put real, sourced numbers on it.

**How much does server-side tagging cost?** Server-side tagging cost ranges from $0 to a few hundred dollars a month for most small and mid-sized stores. Low-traffic sites can often start on a managed free tier. Self-hosting on Google Cloud Run starts at roughly $90 a month for Google's recommended two servers, before logging and other extras. Setup and maintenance time usually cost more than hosting.

The software itself, server-side Google Tag Manager, is free. You pay for the server that runs it, and for the people who set it up and keep it healthy.

> **Key takeaways**
> - Google estimates **~$45 per Cloud Run server per month** and recommends **at least two**, so self-hosting starts around **$90/month** before extras.
> - Managed hosts start at **$0** on free tiers. Entry paid plans listed below range from about $17 to €90 a month, as of October 2026.
> - **Requests and events aren't the same unit.** Compare plans using your own volume, in each provider's unit.
> - The biggest costs are often **hidden**: setup time, maintenance, monitoring and logging.
> - Server-side tagging can pay off when ad bidding depends on conversions you're losing. It's never a guaranteed return.

In this guide, you'll find a cost breakdown for self-hosting and managed hosting, a price comparison from each provider's own page, the hidden costs most guides skip, and a simple way to estimate your event volume. We'll also answer *"Is server-side tagging free?"* and *"Is managed hosting cheaper than Cloud Run?"*

So, why the wait? Let's begin.

## What does server-side tagging cost? The short answer

| Option | Typical monthly cost | Best for |
|---|---|---|
| Managed free tier | $0 | Testing, very low traffic |
| Managed paid plan | Roughly $17 to $200+ | Most stores and agencies that want no infrastructure work |
| Self-hosted Cloud Run | From about $90, plus logging and extras | Teams with Google Cloud skills who want full control |
| High volume or enterprise | Hundreds to thousands | Very high traffic, custom requirements |

These are ranges, not quotes. Your number depends on traffic, how many events each visitor generates, and how much engineering time you count.

New to the topic? Start with [what server-side tracking is](/blog/server-side-tracking-explained).

## Why isn't server-side tagging free?

Regular, browser-based Google Tag Manager runs in your visitors' browsers. Google pays for nothing but the script download, and so do you.

Server-side tagging moves the work to **a server you control**. Google's [introduction to server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/intro) says it runs "in your own Google Cloud Platform project—or in a different environment of your choosing."

Someone has to pay for that server. You pay for:

1. **Compute.** The tagging servers that receive and forward each event.
2. **Extras.** Logging, network traffic, a load balancer for some setups, and a preview server for debugging.
3. **People.** Setup, testing, updates and monitoring.

Managed providers bundle the first two into a plan. The third never fully goes away.

## How much does self-hosting on Google Cloud Run cost?

Google's [Cloud Run setup guide](https://developers.google.com/tag-platform/tag-manager/server-side/cloud-run-setup-guide) is the main reference. As of October 2026, it says:

- **Server size:** each tagging server is a Cloud Run instance with 1 vCPU and 0.5 GB of memory, on CPU-always-allocated pricing.
- **Price:** each server costs "approximately $45 /month (USD)."
- **Minimum:** Google recommends "a minimum of 2 instances to reduce the risk of data loss in case of a server outage." That's about **$90 a month**.
- **Scaling:** Google expects autoscaling 2–10 servers to handle roughly 35–350 requests per second.

![Bar chart of estimated monthly Cloud Run server cost based on Google's figure of about $45 per server: about $45 for one server, about $90 for Google's recommended two-server minimum, and about $450 for ten servers at the top of Google's example autoscaling range, excluding logging, load balancer, network and preview server](/assets/blog/server-side-tagging-cost-cloud-run.svg "Servers only. Google's own estimate, before logging, load balancing and network costs.")

Google adds that the `max-instances` setting is "the worst case scenario for how much you will need to pay." So set it deliberately.

### The logging trap

This one surprises a lot of people.

By default, Cloud Run logs every request. Google's guide warns that above roughly 1 million requests a month, "those log messages may incur significant logging charges," and recommends disabling request logging.

Google Cloud's [observability pricing page](https://cloud.google.com/stackdriver/pricing) lists log storage at $0.50 per GiB, with the first 50 GiB per project per month free. A busy tagging server can produce a lot of log data, so exclude request logs in the Logs Router ([Google's log exclusion docs](https://cloud.google.com/logging/docs/exclusions)) unless you need them.

### Other Cloud costs

- **Preview server:** you need one for debugging, as Google's [manual setup guide](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide) explains.
- **Load balancer:** needed for multi-region setups and some same-origin setups.
- **Network traffic:** outgoing requests to GA4, Meta, TikTok and Google Ads.
- **Other services:** BigQuery or Firestore, if your container writes to them.

Run your own numbers in the [Google Cloud pricing calculator](https://cloud.google.com/products/calculator) and check [Cloud Run pricing](https://cloud.google.com/run/pricing).

> **Recommended article:** [Server-side GTM setup: step-by-step guide](/blog/server-side-gtm-setup)

## How do managed providers price server-side tagging?

Managed sGTM providers run the tagging server for you: provisioning, scaling, SSL, updates and uptime. You still own your GTM containers.

Most charge in one of two units:

- **Requests.** The number of HTTP requests your tagging server receives each month.
- **Events.** The number of events processed. This maps more directly to what you see in GA4, so it's easier to estimate.

Why does that matter? Because the same visit can be counted in very different ways:

![Illustration of one batched browser request carrying three GA4 events, page_view, view_item and add_to_cart, which the server container splits into three events and forwards as three outgoing requests each to GA4, Meta CAPI and TikTok, giving 1 incoming request, 3 events or 9 outgoing requests depending on how you count](/assets/blog/server-side-tagging-cost-requests-vs-events.svg "Same visit, three different counts. That's why a '500K' plan at one provider isn't the same as '500K' at another.")

GA4 can bundle several events into one request. And one event can trigger several outgoing requests to vendors. Each provider documents what it counts, so read the definition before you compare.

Plans are usually tiered: a free tier, then bigger limits, more containers or more features. Annual billing is often discounted.

## Managed sGTM hosting prices compared (October 2026)

Prices below come from each provider's own public pricing page **as of October 2026**. They change, so check the linked page before deciding.

| Provider | Free tier | Paid plans (as listed) | Unit | Source |
|---|---|---|---|---|
| Tagioo | 15,000 events per 30 days, no card | Starter $30/mo (500K events), Pro $50/mo (2M), Enterprise $100/mo (5M); 3-day free trial | Events | [Tagioo pricing](/pricing) |
| Stape | Up to 10K requests, no card | Pro $17/mo (up to 500K), Business $83/mo (up to 5M), Enterprise $167/mo (up to 20M), billed annually; Custom for unlimited | Requests | [Stape pricing](https://stape.io/price) |
| TAGGRS | Up to 10,000 requests per month | Basic (750,000), Pro (3,000,000), Ultimate (10,000,000), Enterprise (custom). Basic starts at 22/month; the figure varies by currency and billing term | Requests | [TAGGRS prices](https://taggrs.io/prices/) |
| Addingwell | Up to 100,000 requests per month | €90/mo for 1M requests, €120 for 5M, €210 for 12M, up to €1,190 for 100M; overage listed per 100K | Requests | [Addingwell pricing](https://www.addingwell.com/pricing) |

A fair word on each:

- **Stape** has a wide range of tiers, a low entry price on annual billing, and a big library of templates and docs.
- **TAGGRS** has a free tier, clearly stepped request limits, and says it runs on European infrastructure.
- **Addingwell** has the largest free tier of the request-based plans here, and publishes its overage rates openly.
- **Tagioo** prices by events and includes a dedicated, isolated container per account, a custom subdomain with automatic SSL, and generated GA4, Meta CAPI, TikTok and Google Ads container files.

> **Recommended article:** [Stape alternative: how Tagioo compares](/blog/stape-alternative)

Leon Korteweg's cost breakdown is a useful second opinion. It's from 2024, so treat its prices as dated and check the current pages above:

@[youtube](wGXkMRXEQ2g "How much does server-side Google Tag Manager cost? (Leon Korteweg)" 2024-10-18)

## What are the hidden costs of server-side tagging?

Hosting is usually the *smaller* part of the real cost.

![Iceberg illustration: the hosting bill sits above the waterline, while setup time, maintenance, monitoring, cloud extras like logging and load balancing, and outside help such as agency fees sit below it](/assets/blog/server-side-tagging-cost-hidden-costs.svg "The hosting bill is the part you see. Budget for the rest too.")

Budget for these:

| Hidden cost | What it involves | Self-hosted | Managed |
|---|---|---|---|
| Setup time | Containers, DNS, SSL, event mapping, consent, testing | All yours | Shorter; pre-built files help |
| Maintenance | Image updates, scaling settings, unhealthy instances | All yours | Handled by the host |
| Template changes | Vendor APIs and templates change over time | Yours | Yours, unless templates are maintained for you |
| Monitoring | Noticing when events stop, a token expires, or a theme update breaks the purchase | Yours | Shared; depends on the dashboard |
| Cloud extras | Logging, load balancer, network | Yours | Included in the plan |
| Outside help | Agency or consultant setup fees | Often the biggest line | Often smaller or none |

How big is the setup line? It depends heavily on experience.

As one data point, WeltPixel, which sells a Shopify tracking app, estimates 10–20 hours of setup for a do-it-yourself tagging server ([WeltPixel's Shopify cost comparison](https://weltpixel.com/blogs/news/what-server-side-tracking-costs-on-shopify-diy-tagging-server-vs-app)). Treat any vendor's estimate as a rough guide, including ours.

Here's the one people forget: a tracking outage you discover two weeks later can cost more than a year of hosting. Monitoring isn't optional.

Tagioo's dashboard shows real-time event counts, and its **Run tracking test** checks that your GA4 server container is published and your Meta CAPI credentials work. That covers part of the monitoring job, not all of it.

## How do you estimate your event volume?

You need a rough monthly event count to pick a plan. Here's a simple method, using **hypothetical numbers** for illustration only.

![Worked example with hypothetical numbers: 40,000 monthly pageviews times 3 events per pageview equals 120,000 events a month, plus 25 to 50 percent headroom gives about 150,000 to 180,000 events a month to compare plans against](/assets/blog/server-side-tagging-cost-event-estimate.svg "A hypothetical store's estimate. Swap in your own GA4 numbers.")

1. **Find your monthly pageviews.** In GA4, open **Reports → Engagement → Pages and screens** for the last 30 days. Say it's **40,000**.
2. **Count events per pageview.** Every page fires `page_view`, and some pages add `view_item`, `add_to_cart`, `begin_checkout` or `purchase`, often plus `scroll` or `user_engagement`. GA4's **Events** report shows your real ratio. Say it's **3**.
3. **Multiply.** 40,000 × 3 = **120,000 events a month**.
4. **Add headroom.** Sales and holidays spike traffic. Add 25–50%: about **150,000–180,000 events a month**.
5. **Convert to the provider's unit.** If a provider bills by requests, ask how they count, or run its free tier for a week and read the dashboard.

In this example, a 15,000-event free tier is fine for testing but too small for production. You'd compare paid plans at roughly 150K–200K events a month.

> **Recommended article:** [Why your store, GA4 and ad reports show different sales numbers](/blog/conversion-tracking-discrepancies)

Want a quick look at what your site sends today? The free [Website Tracking Checker](/website-tracking-checker) scans a public page for tags, IDs and whether tracking already goes through a first-party domain.

## Is managed hosting cheaper than self-hosting on Cloud Run?

For many small and mid-sized stores, yes, once you count people's time. But not always.

| Your situation | Usually cheaper | Why |
|---|---|---|
| Low traffic, no cloud team | Managed (free or entry plan) | Entry plans cost less than two Cloud Run servers, and you skip setup of the infrastructure |
| Mid traffic, small marketing team | Managed | Hosting, scaling and SSL are handled; your time goes to event quality |
| High traffic, in-house Google Cloud team | Could be either | Self-hosting can compete at scale if your team already runs Cloud projects |
| Strict data residency or custom infrastructure needs | Self-hosted, or a host that meets them | Control over region and setup matters more than the bill |

The comparison flips on one question: **who does the work, and what's their hour worth?**

## How can you reduce server-side tagging costs?

1. **Disable request logging** on Cloud Run unless you need it. Google recommends this at high volume.
2. **Set `min` and `max` instances deliberately.** Two for resilience, and a max you're happy to pay for.
3. **Don't send events nobody uses.** Every extra event costs requests and processing. Check which ones you actually report on.
4. **Filter obvious bot traffic** before it fires vendor tags.
5. **Start on a free tier** to measure your real volume before you commit.
6. **Use annual billing** if you're sure. Several providers discount it.
7. **Use pre-built container files** to cut setup time. With Tagioo, the Setup Assistant generates the Web and Server GTM files for you.

## Is server-side tagging worth the cost?

It can be, if you spend meaningfully on ads that optimize on conversion data and you're losing events to blocked tags, short cookie lifetimes or missed thank-you pages.

A simple way to frame it: compare the monthly cost to your ad spend. A $30 plan is 1% of a $3,000 monthly ad budget. Then ask whether more complete conversion data is likely to be worth that to you.

What it's **not** is a guaranteed return. Nobody can honestly promise a specific ROAS lift from tracking alone.

So start small:

1. **Take a baseline** of orders vs GA4 vs ad platforms.
2. **Set up one conversion** end to end, using our [server-side GTM setup guide](/blog/server-side-gtm-setup).
3. **Compare after 2–4 weeks** on your own data.

You can [start free with Tagioo](/signup), no card needed, and upgrade only if the numbers justify it.

## Sources and further reading

- Google: [Cloud Run setup guide for server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/cloud-run-setup-guide)
- Google: [Manual setup guide](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide)
- Google: [An introduction to server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/intro)
- Google Cloud: [Cloud Run pricing](https://cloud.google.com/run/pricing), [Observability (logging) pricing](https://cloud.google.com/stackdriver/pricing), [Log exclusions](https://cloud.google.com/logging/docs/exclusions), [Pricing calculator](https://cloud.google.com/products/calculator)
- Provider pricing pages, as of October 2026: [Stape](https://stape.io/price), [TAGGRS](https://taggrs.io/prices/), [Addingwell](https://www.addingwell.com/pricing), [Tagioo](/pricing)
- WeltPixel: [What server-side tracking costs on Shopify](https://weltpixel.com/blogs/news/what-server-side-tracking-costs-on-shopify-diy-tagging-server-vs-app)

## Related questions

### Is server-side tagging free?

The software is free: server-side Google Tag Manager costs nothing to use. Running it isn't, because it needs a server.

Several managed providers, including Tagioo, offer free tiers for low volume. That's enough to test a setup, but often not enough for a busy store.

### How much does server-side GTM cost on Google Cloud?

Google's Cloud Run guide estimates about $45 per server per month and recommends at least two, so roughly $90 a month as a baseline, as of October 2026.

Logging, load balancers and network traffic can add to that. Disable request logging at high volume, as Google recommends.

### Is managed hosting cheaper than self-hosting?

For many small and mid-sized stores, yes, once you count engineering time. Several managed entry plans cost less than two Cloud Run servers.

At very high volume, or if you already have a Google Cloud team, self-hosting can be competitive. Compare using your own event volume.

### What's the difference between requests and events?

An event is one action, like a page view or a purchase. A request is one HTTP call to your tagging server.

GA4 can bundle several events into one request, so the counts can differ. Check how each provider defines its billing unit before you compare.

### What happens if I go over my plan limit?

It depends on the provider. Some charge overage per block of requests, some stop forwarding data, and some ask you to upgrade.

Tagioo's Free plan has a hard cap of 15,000 events per 30 days: the container pauses until the cycle resets or you upgrade, and no data is deleted. Paid plan limits are on the [pricing page](/pricing).

### How much does it cost to set up server-side tracking?

If you do it yourself, the main cost is time: often several hours to a few days for a first setup, depending on experience and how many platforms you connect.

Agency setups are usually quoted per project. Managed hosting with pre-built container files can cut the infrastructure part a lot, but you should still budget time for testing.

### Is server-side tagging worth the cost?

It can be if you spend meaningfully on ads that optimize on conversion data and you're losing events. It isn't a guaranteed return.

Start small, verify one conversion end to end, and compare against your own data before you scale up.
