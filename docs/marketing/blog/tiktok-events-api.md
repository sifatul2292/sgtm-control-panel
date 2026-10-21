---
title: "TikTok Events API: The Complete Server-Side Setup Guide (2026)"
seoTitle: "TikTok Events API: Server-Side Setup Guide (2026)"
description: "TikTok Events API setup guide: Pixel vs Events API, partner, Gateway, server GTM and direct options, event mapping, event_id dedup, match keys and testing."
category: TikTok
keyword: tiktok events api
published: 2026-10-31
updated: 2026-10-31
summary: "How to send TikTok conversions server-side, map your events, deduplicate them against the Pixel with event_id, and test before going live."
related: meta-conversions-api, server-side-gtm-setup, ad-blocker-tracking-loss
featured: false
---
# TikTok Events API: The Complete Server-Side Setup Guide (2026)

Your TikTok ads are getting clicks. Your store is getting orders.

But TikTok Ads Manager shows only a handful of purchases, and the algorithm keeps optimizing for… what, exactly?

Is the Pixel blocked? Did the thank-you page never load? Or is TikTok simply not seeing the sales it drove?

Ahh, so many questions. Let's work through them.

**What is the TikTok Events API?** The TikTok Events API is TikTok's server-to-server connection for sending conversion events, such as purchases and add-to-carts, from your server straight to TikTok, instead of relying only on the TikTok Pixel in the browser. TikTok recommends running it alongside the Pixel, with a shared `event_id` so each conversion counts once.

Think of it as TikTok's version of Meta's Conversions API.

Same idea, different names, and a few rules of its own that are worth knowing before you build anything.

> **Key takeaways**
> - The Events API is a **second channel**, not a Pixel replacement. TikTok recommends using both, with deduplication.
> - Send the same `event_id` and the same event name through both channels. TikTok keeps the first copy it receives.
> - TikTok renamed two events in 2025: `CompletePayment` is now **Purchase** and `SubmitForm` is now **Lead**. Old names still work.
> - The click ID (`ttclid`), the `_ttp` cookie, hashed email/phone, IP and user agent are the match keys that matter.
> - The Events API never overrides consent. If someone declines advertising cookies, don't send their data from either channel.

In this guide, you'll find out how the Events API differs from the Pixel, the four ways to set it up, how to map and deduplicate events, and how to test before you trust the numbers. We'll also answer the questions people ask most, like *"Is the TikTok Events API free?"* and *"Do I still need the Pixel?"*

So, why the wait? Let's begin.

![Diagram of the TikTok Pixel sending a Purchase from the browser while a Google tag request goes to the store's own server container, which maps the event to TikTok's Purchase and sends it to the Events API with the same event_id and match keys; TikTok counts the purchase once](/assets/blog/tiktok-events-api-flow.svg "The Pixel and the server each send the purchase. A shared event_id lets TikTok keep one copy.")

## How is the TikTok Events API different from the Pixel?

They do the same job from different places. Here's the side-by-side:

| | TikTok Pixel | TikTok Events API |
|---|---|---|
| Where it runs | The visitor's browser | Your server, a server container or a partner |
| How it sends data | JavaScript from TikTok's domain | HTTPS requests from a server to TikTok |
| Can be stopped by | Blocked scripts, connectivity issues, pages that never load | Not by browser extensions, but only fires if your site or backend sends the event |
| IP and user agent | Shared automatically | You must configure them manually |
| `_ttp` cookie | Set and read by the Pixel | Only if you forward it |
| Backend, CRM and offline events | No | Yes |
| Best for | Browsing context, quick setup | Reliable conversions and backend events |

TikTok's [Events API overview](https://ads.tiktok.com/help/article/events-api) puts the benefit simply. Pixel conversions can be affected by "connectivity issues and browser inconsistency", and the Events API aims to report more of them for measurement, optimization and targeting.

Notice what TikTok doesn't publish: a guaranteed uplift number. You'll see "30–50% more conversions" claims in tutorials. Those aren't TikTok's figures, and your result depends on your own traffic.

## Do you still need the TikTok Pixel?

Yes, for website advertisers.

TikTok's [getting started guide](https://ads.tiktok.com/help/article/getting-started-events-api) says it recommends setting up the Events API "as a second channel together with your TikTok Pixel."

Here's why both are better than either one:

- **The Pixel sets the `_ttp` first-party cookie** on your domain, which helps TikTok match visitors.
- **The Pixel captures browsing behavior** automatically.
- **The Events API backs up conversions** that the browser loses.

Also note: TikTok says a Pixel or Events API setup is a prerequisite for the Web Conversions objective in Ads Manager ([Events API overview](https://ads.tiktok.com/help/article/events-api)).

> **Recommended article:** [How ad blockers and browser privacy affect your tracking](/blog/ad-blocker-tracking-loss)

## What are the ways to set up the TikTok Events API?

TikTok's getting started guide lists three integration routes. TikTok also offers a Gateway product. Together, that's four options:

| Method | How it works | Effort | Control | Best for |
|---|---|---|---|---|
| Commerce partner | Connect Shopify, WooCommerce and similar from TikTok or the platform's app store | Low | Low | Stores on a supported platform |
| Events API Gateway | A TikTok-provided server-to-server setup with a dashboard for many accounts | Low–medium | Low–medium | Agencies, adtech partners, brands with sub-brands |
| Data partner (incl. server-side GTM) | A tag manager, CDP or CRM sends events for you | Medium | High | Anyone also feeding GA4, Meta or Google Ads |
| Direct API | Your developers call the Events API 2.0 from your backend | High | Full | Custom stacks with engineering time |

### 1. Commerce partner integration

This is the fastest route. You connect your store, pick a Pixel and the partner sends events.

The trade-off is control. You usually can't see or change the payload. And if you later add your own server tag, you can end up with two senders for the same event.

### 2. Events API Gateway

TikTok's [Events API Gateway](https://ads.tiktok.com/help/article/about-events-api-gateway) creates a server-to-server connection for website events with less technical work.

It's built for scale. One Gateway "Host" can manage many accounts, each in its own "tenant" space. TikTok names digital agencies, adtech partners and retailers with sub-brands as the intended users.

TikTok says the Gateway's internal logic avoids duplication by matching keys like `event_id` or the `_ttp` cookie.

### 3. Data partner, including server-side GTM

TikTok lists tag managers, customer data platforms and CRMs as data partners. With server-side Google Tag Manager, the flow looks like this:

1. Your web container sends GA4 events to a **server container** on your first-party tracking subdomain, such as `track.yourstore.com`.
2. A **TikTok Events API tag** in the server container (usually from the Community Template Gallery) maps each GA4 event to a TikTok event.
3. The tag sends the event to TikTok with your **Pixel ID** and an **Events API access token**.

The big advantage? One browser request can feed [GA4](/blog/ga4-server-side-tracking), [Meta's Conversions API](/blog/meta-conversions-api), [Google Ads](/blog/google-ads-server-side-tracking) and TikTok at once.

Analytics Mania shows the whole thing in GTM:

@[youtube](as3ttwsVJG0 "Tracking conversions with TikTok Events API and GTM (Analytics Mania)")

> **Recommended article:** [Server-side GTM setup: step-by-step guide](/blog/server-side-gtm-setup)

### 4. Direct API integration

TikTok's guide says direct integration gives you the most control over data management.

It also means you own authentication, retries, hashing, field mapping and keeping up with API versions. Build against TikTok's current [Events API 2.0 developer documentation](https://business-api.tiktok.com/portal/docs?id=1771100865818625), because field formats can change between versions.

**Whichever you pick, use one sender per event.** A partner integration and a server GTM tag both sending Purchase will create duplicates if their IDs differ.

## What should you plan before you start?

TikTok's getting started guide suggests some homework first. Honestly, it saves a lot of rework:

1. **Define your events, parameters and match keys.** Pick what matches your goals, and review it with whoever owns privacy and legal.
2. **Get your credentials.** You'll need your Pixel ID and an Events API access token. TikTok says an access token is required to authenticate Events API 2.0 calls. Keep it on the server, never in browser code.
3. **Plan consent.** Your consent banner should pass consent state to the server, so the server tag only fires for visitors who allowed it.
4. **Build a timeline** that allows for approvals, setup and testing.

## How do you map your events to TikTok events?

Most stores already have GA4 ecommerce events in their data layer. The server-side TikTok tag translates those names into TikTok's standard events.

Here's a common mapping:

![Mapping of GA4 events to TikTok standard events: view_item to ViewContent, add_to_cart to AddToCart, add_to_wishlist to AddToWishlist, begin_checkout to InitiateCheckout, add_payment_info to AddPaymentInfo, purchase to Purchase (formerly CompletePayment), generate_lead to Lead (formerly SubmitForm), sign_up to CompleteRegistration, and search to Search](/assets/blog/tiktok-events-api-event-mapping.svg "A common mapping in server-side TikTok tags. Check what your template does by default.")

About those renames.

TikTok's [updated standard events article](https://ads.tiktok.com/help/article/how-to-adopt-tiktoks-updated-standard-events) says `CompletePayment` became **Purchase** and `SubmitForm` became **Lead**, effective May 1, 2025 for web events. Existing setups keep working, because legacy names are converted on TikTok's side.

TikTok also added `StartTrial`, `SubmitApplication` and `ApplicationApproval` for subscription and application funnels.

Our advice: **use the same name on the Pixel and the server.** Don't rely on TikTok's backend conversion to pair `CompletePayment` from one channel with `Purchase` from the other. If you're starting fresh, use the new names on both.

## How does event_id deduplication work on TikTok?

TikTok's [event deduplication article](https://ads.tiktok.com/help/article/event-deduplication) sets out the rules:

| Overlap | What TikTok does | Window |
|---|---|---|
| Pixel + Events API | Merges or deduplicates events with the identical event name and `event_id` | Within 48 hours of the first event |
| Pixel + Pixel | Deduplicates repeats with the same name and `event_id` | Within 48 hours |
| Events API + Events API | Deduplicates repeats with the same name and `event_id` | Within 48 hours |
| Which copy wins | The first event received is used for measurement and reporting | — |

TikTok's own wording for the cross-channel case mentions events arriving after 5 minutes and within 48 hours of the first one. Either way, the practical rule is the same.

**Generate the `event_id` once, then pass it to both channels.**

For purchases, the order ID is the natural choice. It's unique, stable on retries and known to both the browser and your backend. Tagioo uses the same pattern for Meta, where the purchase `event_id` is the order ID.

Common mistakes:

- **Random IDs on each side.** The Pixel and the server tag each generate their own, so they never match.
- **One ID for everything.** Reusing the same `event_id` for every event on a page can merge different actions.
- **Different event names.** `Purchase` on one channel and something else on the other.
- **Two senders.** A partner integration plus your own server tag, each with its own IDs.

> **Recommended article:** [Meta Pixel + CAPI: how to check for duplicate purchases](/blog/meta-capi-deduplication-checklist). The same logic applies to TikTok.

## Which match keys should you send?

Match keys help TikTok connect a server event to a person who saw or clicked an ad. TikTok's [matching events article](https://ads.tiktok.com/help/article/how-to-set-up-matching-events-with-events-api) describes them:

![Four cards of TikTok match keys: the ttclid click ID from the landing URL, the _ttp first-party cookie set by the Pixel, hashed email, phone and external ID, and the visitor's IP address and user agent, which need manual setup for the Events API](/assets/blog/tiktok-events-api-match-keys.svg "The Pixel collects some keys automatically. For the Events API, you pass each one yourself.")

| Match key | Where it comes from | Hash it? | Notes |
|---|---|---|---|
| Click ID (`ttclid`) | Appended to the landing URL on a TikTok ad click | No | Capture it on landing and keep it until checkout |
| `_ttp` cookie | First-party cookie the Pixel sets on your domain | No | TikTok describes it as limited to the advertiser's domain |
| Email and phone | Checkout, sign-up or lead forms | Yes | Only where the customer gave them and consent allows |
| External ID | Your customer or loyalty ID | Yes | Keep it consistent across channels |
| IP address and user agent | The visitor's request | No | Shared by default by the Pixel; manual setup for the Events API |

TikTok's overview recommends passing all relevant match keys to improve match rates. Check the developer docs for exact normalization and hashing formats before you build a direct integration.

One easy-to-miss detail: TikTok says click IDs follow the click-through attribution window you set in Attribution Manager.

## How do you test the TikTok Events API?

Never publish a new setup straight to live traffic. Test it first:

1. **Open TikTok Events Manager** and select your Pixel. Find the **Test Events** area.
2. **Copy the test event code** for server events. Add it to your server tag or API request *only* while testing.
3. **Run server container preview.** Walk through a real journey: view a product, add to cart, place a test order. Confirm the TikTok tag fired and TikTok returned a success response.
4. **Check Test Events.** Your events should appear with the expected names, values and match keys. If the Pixel is also live, both copies should show the same `event_id`.
5. **Remove the test code and publish** both containers.
6. **Watch Diagnostics** over the next days. TikTok's [monitoring guide](https://ads.tiktok.com/help/article/tiktok-events-manager-monitor-and-diagnose) says Diagnostics lists quality issues with their severity and how to fix them.


## How long until you see results?

| When | What to expect |
|---|---|
| Seconds to minutes | Events show in Test Events when you send them with a test code |
| With a delay | Events Manager overview updates; TikTok notes it shows the last hour an event was received and isn't real time |
| Up to 7 days | An event counts as "Active" if TikTok received it in the last 7 days |
| 2–4 weeks | Enough data to compare TikTok purchases with your store orders |

Then compare TikTok-reported purchases with your orders from TikTok traffic.

They won't match exactly. TikTok's Attribution Manager defaults web advertisers to **7-day click and 1-day view** attribution ([TikTok's announcement](https://ads.tiktok.com/business/en/blog/flexible-attribution-windows-campaign-measurement)), and it can credit a sale to someone who saw an ad but never clicked. But the trend should make sense.

> **Recommended article:** [Why your store, GA4 and ad reports show different sales numbers](/blog/conversion-tracking-discrepancies)

## 8 common TikTok Events API mistakes

1. **No `event_id`** on one channel, so nothing can be deduplicated.
2. **Separate random IDs** on the Pixel and the server.
3. **Mixed event names** between channels, such as legacy and new names.
4. **Your server's IP and user agent** instead of the visitor's.
5. **Dropping the `ttclid`** on redirects or by stripping URL parameters.
6. **The access token in browser code.** It belongs on the server only.
7. **Leaving the test code on** after you go live.
8. **Ignoring consent.** The server tag must respect the same choices as the Pixel.

## Does the TikTok Events API respect consent?

It should. That's something you configure, not something you get for free.

Server-side delivery improves reliability for visitors who **consented**. It doesn't change who you may track.

In practice, pass consent state from your banner to the server container, and block the TikTok tag when advertising consent is denied. TikTok's getting started guide also asks you to have your legal team review TikTok's data terms and how it honors users' privacy settings.

This isn't legal advice. Check what applies to your business.

## How do you set this up with Tagioo?

[Tagioo](/features) hosts a dedicated server GTM container on your own tracking subdomain, with DNS guidance and automatic SSL.

Our Setup Assistant generates ready-to-import Web and Server container files with a **TikTok Events API** tag already mapped, alongside GA4, Meta Conversions API and Google Ads. You import, preview and publish.

Then use **Event Logs** and **Purchase Inspector** to see exactly what reached your server. That helps you tell a site problem from a TikTok-side problem before you dig through Events Manager.

![Tagioo Event Logs showing incoming tracking requests reaching a store's own server container](/assets/tagioo-event-logs.png "Event Logs show every request your server container received.")

There's a free plan with 15,000 events per 30 days, and no card is needed. See [pricing](/pricing), set it up for [WooCommerce](/woocommerce) or [Shopify](/shopify), or check what your site runs today with the free [Website Tracking Checker](/website-tracking-checker).

## Sources and further reading

- TikTok Business Help Center: [About Events API](https://ads.tiktok.com/help/article/events-api)
- TikTok Business Help Center: [How to get started with Events API](https://ads.tiktok.com/help/article/getting-started-events-api)
- TikTok Business Help Center: [About event deduplication](https://ads.tiktok.com/help/article/event-deduplication)
- TikTok Business Help Center: [How to set up matching events with Events API](https://ads.tiktok.com/help/article/how-to-set-up-matching-events-with-events-api)
- TikTok Business Help Center: [About Events API Gateway](https://ads.tiktok.com/help/article/about-events-api-gateway)
- TikTok Business Help Center: [How to adopt TikTok's updated standard events](https://ads.tiktok.com/help/article/how-to-adopt-tiktoks-updated-standard-events)
- TikTok Business Help Center: [Monitor and diagnose in Events Manager](https://ads.tiktok.com/help/article/tiktok-events-manager-monitor-and-diagnose)
- TikTok for Business: [Flexible attribution windows](https://ads.tiktok.com/business/en/blog/flexible-attribution-windows-campaign-measurement)
- TikTok API for Business: [Events API 2.0 developer documentation](https://business-api.tiktok.com/portal/docs?id=1771100865818625)

## Related questions

### Is the TikTok Events API free?

TikTok doesn't charge for sending events through the Events API. Your costs come from whatever sends them: a partner app, your own server or a hosted server container.

Tagioo has a free plan with 15,000 events per 30 days; see [pricing](/pricing).

### Do I need both the TikTok Pixel and the Events API?

TikTok recommends both for websites, with deduplication. The Pixel captures browsing context and sets the `_ttp` cookie; the Events API adds reliable server-side conversions.

Send the same `event_id` and event name through each channel.

### What is the difference between the TikTok Pixel and the Events API?

The Pixel runs in the visitor's browser. The Events API sends events from a server.

The server path doesn't depend on the browser loading TikTok's script, and it can send backend and offline events. But you have to pass every field yourself, including IP and user agent.

### How do I get a TikTok Events API access token?

In TikTok Events Manager, open your Pixel's settings and generate an access token for the Events API. TikTok's developer docs describe the two ways to create one.

Store it as a secret on your server. Never put it in browser code.

### What should I use as the event_id for purchases?

Your order ID is usually best. It's unique per purchase, stable across retries and available in both the browser and your backend.

Make sure the Pixel and the server event use exactly the same string.

### Does the TikTok Events API work if the Pixel is blocked?

Server events are sent from your server, so an extension that blocks TikTok's script doesn't stop them. They still depend on your site sending the event to your server, and they must respect consent.

More in our [ad blocker guide](/blog/ad-blocker-tracking-loss).

### Should I use CompletePayment or Purchase?

TikTok renamed `CompletePayment` to `Purchase` in 2025, and says legacy names keep working. For new setups, use `Purchase`.

Whatever you choose, use the same name on the Pixel and the Events API.

### Can I send TikTok events from server-side Google Tag Manager?

Yes. TikTok lists tag managers among its data partners. A server container can map incoming GA4 events to TikTok events with an Events API tag.

Tagioo's Setup Assistant generates this configuration for you.
