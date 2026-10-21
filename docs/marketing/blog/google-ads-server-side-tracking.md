---
title: Google Ads Server-Side Tracking: The Complete 2026 Setup Guide
seoTitle: Google Ads Server-Side Tracking: Complete Setup Guide (2026)
description: Set up Google Ads server-side tracking with server GTM: Conversion Linker, conversion tag, enhanced conversions, Consent Mode v2, dedup and testing.
category: Google
keyword: server side tracking google ads
published: 2026-10-21
updated: 2026-10-21
summary: How Google Ads conversions work through a server container, when it's worth it, and an 8-step setup you can test today.
related: ga4-server-side-tracking, server-side-gtm-setup, conversion-tracking-discrepancies
featured: false
---
# Google Ads Server-Side Tracking: The Complete 2026 Setup Guide

Your store shows 100 orders this week. Google Ads shows 71 conversions.

So where did the other 29 go?

Did those people never click an ad? Did an ad blocker eat the tag? Or did Smart Bidding just learn from 29 fewer sales than you actually made?

Ahh, so many questions. Let's sort them out.

**What is Google Ads server-side tracking?** Google Ads server-side tracking sends your conversions to Google Ads through a server-side Google Tag Manager (sGTM) container on your own domain, instead of only from a tag in the visitor's browser. The server keeps the ad click ID in a first-party cookie and fires the conversion tag, so fewer conversions get lost.

Some of that 100-vs-71 gap is normal. Not every buyer clicked an ad.

But part of it is often plain data loss. A blocked script, a Safari cookie that expired, or a customer who closed the tab before the thank-you page loaded.

> **Key takeaways**
> - Server-side tracking moves the Google Ads conversion tag to a server container on your own subdomain, such as `track.yourstore.com`.
> - The click ID lives in a server-set first-party cookie (`FPGCLAW`) for up to 90 days, instead of a JavaScript cookie that Safari can cap at 7 days or even 1.
> - It isn't required for every account. Fix the basics first, then test it if backend orders still clearly beat Google Ads conversions.
> - Google Ads **does** deduplicate, within one conversion action, when the order ID matches.
> - It never overrides consent. Consent Mode v2 travels from your web container to the server.

In this guide, you'll find out how it works, whether you actually need it, and how to set it up in 8 steps. We'll also answer the questions people ask most, like *"Is server-side tracking legal?"* and *"Is $20 a day enough for Google Ads?"*

So, why the wait? Let's begin.

![Diagram comparing browser-only Google Ads tracking, where the conversion request can be dropped, with server-side tracking, where the browser sends one request to the store's own tracking subdomain and the server container forwards the conversion to Google Ads](/assets/blog/google-ads-server-side-flow.svg "Browser-only tracking sends the conversion straight from the browser to Google. With server-side tracking, the browser talks to your own subdomain and the server container forwards the conversion.")

## What does server-side tracking mean for Google Ads?

Google describes server-side tagging as processing data "on a server you control, rather than in the user's browser." ([Google's introduction to server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/intro))

For Google Ads, it works like this:

1. Your website sends **one** Google tag (GA4) request to a tracking subdomain you own, like `track.yourstore.com`.
2. A **server container** receives it. Its **GA4 client** turns the request into event data.
3. Server-side tags read that data. The **Conversion Linker** handles the click ID, and the **Google Ads Conversion Tracking** tag reports the conversion.

You still need a tag on the page. Something has to notice the purchase.

What changes is everything *after* that: where the request goes, which cookies hold the click ID, and who decides what gets forwarded.

Here's a detail most guides skip. The server tag isn't purely server-to-server.

As Simo Ahava explains in his [guide to Google Ads with server-side tagging](https://www.simoahava.com/analytics/google-ads-server-side-tagging-google-tag-manager/), the server can ask the browser to send a pixel to Google, so Google's own cookies still get used where they're available.

So it's a hybrid. Your first-party path gets more reliable, and Google still receives whatever signals it can use.

## How does it work? Click IDs, cookies and the GA4 client

When someone clicks your ad, Google adds a click ID to the landing page URL. Usually that's `gclid`. On iOS, it's sometimes `wbraid` or `gbraid`.

Conversion tracking only works if that ID survives until the visitor buys. And that might be days later.

Here's where it's stored:

| | Browser-only setup | Server-side setup |
|---|---|---|
| Cookie name | `_gcl_aw` | `FPGCLAW` |
| Written by | JavaScript in the browser (web Conversion Linker) | Your server container (server Conversion Linker) |
| Lives on | Your domain | Your domain |
| Max lifetime | 90 days, but Safari can cap it at 7 days or 1 day | Up to 90 days |
| Sources | [Conversion Linker help](https://support.google.com/tagmanager/answer/7549390) | [Google Ads cookie list](https://business.safety.google/adscookies/) |

Why does lifetime matter so much?

Because Google Ads' default click-through conversion window is **30 days** ([Google's conversion window help](https://support.google.com/google-ads/answer/3123169)).

If a Safari shopper clicks your ad today and buys on day 10, a 7-day JavaScript cookie is already gone. That sale can't be linked to the click.

![Bar chart of the maximum lifetime of the Google Ads click ID cookie: 90 days for a JavaScript cookie in Chrome or Firefox, 7 days in Safari, 1 day in Safari after some ad clicks, and up to 90 days for the server-set FPGCLAW cookie, compared with Google Ads' 30-day default conversion window](/assets/blog/google-ads-click-id-cookie-lifetime.svg "Safari's Intelligent Tracking Prevention caps cookies written by JavaScript at 7 days, and at 1 day in some link-tracking cases. Server-set cookies on your own domain can last much longer.")

The Safari limits come straight from WebKit: [ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/) caps JavaScript cookies at 7 days, and [ITP 2.2](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-2/) cuts that to 1 day when the visitor arrives from a domain Safari classifies as a tracker, with a click ID in the URL.

One honest catch: Safari can *also* cap server-set cookies at 7 days if your tracking subdomain points to a different IP range than your main site ([WebKit's CNAME-cloaking defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/)). Same-origin setups avoid this.

> **Recommended article:** [Safari ITP and iOS privacy: what still works for conversion tracking](/blog/safari-itp-ios-tracking)

There's one more prerequisite people miss.

In server GTM, Google Ads tags read data from the **GA4 client**. So your web container must send hits through a Google tag to the server container. That's why the setup below starts with GA4.

![Four-step diagram: ad click with gclid, click ID stored in the FPGCLAW first-party cookie by the server Conversion Linker, purchase event with transaction ID and value reaching the server container, and Google Ads receiving the conversion](/assets/blog/google-ads-click-id-lifecycle.svg "From ad click to counted conversion. The click ID waits in a first-party cookie until the purchase happens.")

## Is server-side tracking necessary for Google Ads?

No, not for every account.

People who run ads genuinely disagree on this, and honestly, both sides have a point.

**Why you might not need it (yet):**

- The standard Google tag, with **enhanced conversions** and **Consent Mode v2** set up properly, already recovers a lot of signal.
- Google **models** conversions it can't observe directly ([Google's conversion modeling explainer](https://support.google.com/google-ads/answer/10081327)).
- It adds hosting, a DNS record and one more container to look after.
- Most "uplift" numbers you'll see online come from vendors. Your result depends on your own traffic.

**Why it often pays off:**

- A first-party subdomain is less exposed to blocklists and short JavaScript cookie lifetimes.
- One server container can feed Google Ads, [GA4](/blog/ga4-server-side-tracking), [Meta's Conversions API](/blog/meta-conversions-api) and [TikTok](/blog/tiktok-events-api) from the *same* purchase event.
- You control what gets forwarded, and you can strip data a vendor doesn't need.
- On WooCommerce, a backend purchase hit can still record orders when the thank-you page never loads ([our WooCommerce guide](/blog/woocommerce-server-side-tracking)).

We see one pattern again and again in store owners' forum threads.

Google Ads shows about half the orders, *and* GA4 is low too.

When both are low, it's usually a **collection** problem, not attribution. A tag that only fires on a thank-you page some customers never see. A purchase that fires twice. A half-removed old setup.

Server-side tracking can help. But only after the basics are right.

![Decision flowchart: if campaigns don't bid on conversions, the standard Google tag is usually enough; if the basics are broken, fix them first; if backend orders still clearly exceed Google Ads conversions, test server-side tracking with enhanced conversions; if you also feed Meta, TikTok or GA4, server-side pays off](/assets/blog/google-ads-server-side-decision.svg "Not sure? Follow the flow. Start by comparing a few weeks of backend orders with Google Ads conversions.")

## Server-side tracking vs enhanced conversions vs Google tag gateway: what's the difference?

These get mixed up all the time.

They solve different problems, and the strongest setups combine a few of them:

| Approach | What it does | Where it runs | Helps with blocked scripts? | Effort |
|---|---|---|---|---|
| Standard Google tag | Sends conversions from the browser | Browser | No | Low |
| Enhanced conversions | Adds hashed email/phone so Google can match conversions to signed-in users | Browser or server | No, but improves matching | Low |
| Consent Mode v2 | Tells tags what the visitor agreed to; enables modeling when denied | Browser, passed to server | No (and it shouldn't) | Low–medium |
| Google tag gateway | Serves Google's tag and requests through your own domain via your CDN | Your CDN or load balancer | Partly: requests become first-party | Low–medium |
| Server-side GTM | Processes events on your server, then forwards them to Ads, GA4, Meta and more | Your server container | Partly, plus data control and multi-platform | Medium |

**What's Google tag gateway?** Launched in May 2025, it loads Google's tag through your own domain. Cloudflare was the first one-click partner.

In its [announcement](https://business.google.com/en-all/accelerate/announcements/enhance-your-conversion-measurement-and-ad-performance-with-google-tag-gateway-for-advertisers/), Google reported an average 11% uplift in signals. Google also calls the gateway complementary to server-side tagging, not a replacement ([tag gateway docs](https://developers.google.com/tag-platform/tag-manager/gateway)).

In plain words:

- **Only advertising on Google?** The gateway is the lighter option.
- **Also running Meta or TikTok, or want control over your data?** Server-side GTM does more.

Analytics Mania explains the difference really well in this video:

@[youtube](uMQpirSsJ-0 "Google Tag Gateway vs Server-side tracking. What's the difference? (Analytics Mania)")

## Before you start: take a 15-minute baseline

Please don't skip this one.

Without a baseline, you'll never know whether server-side tracking actually helped.

1. **Export your orders.** Two to four weeks from your store or CRM, with order ID, value and date.
2. **Add the right column.** In Google Ads, add **Conversions (by conv. time)** for your purchase action. It counts conversions by the day they happened, not the day of the click.
3. **Export GA4 purchases** with `transaction_id` for the same dates.
4. **Write down three numbers:** backend orders, GA4 purchases, Google Ads conversions.

Now read the numbers:

| What you see | What it usually means | Start here |
|---|---|---|
| GA4 **and** Google Ads both far below backend | Collection problem | Tag firing, thank-you page, duplicate plugins |
| GA4 close to backend, Google Ads low | Attribution, consent or click-ID loss | Server-side tracking + enhanced conversions |
| Google Ads **above** backend | Double counting | Deduplication section below |

> **Recommended article:** [Why your store, GA4 and ad reports show different sales numbers](/blog/conversion-tracking-discrepancies)

## How do you set up Google Ads server-side tracking? (8 steps)

These steps follow Google's own [server-side Google Ads setup guide](https://developers.google.com/tag-platform/tag-manager/server-side/ads-setup).

You'll need a Google Ads account, a web GTM container on your site and a server GTM container.

Here's the whole setup at a glance:

| Step | Where | What you add | Trigger |
|---|---|---|---|
| 1 | Google Ads | Manual website conversion action → Conversion ID + label | — |
| 2 | DNS / hosting | Server container on `track.yourstore.com` with SSL | — |
| 3 | Web container | Google tag sending to the server + GA4 `purchase` event | Purchase |
| 4 | Server container | Conversion Linker | All Pages |
| 5 | Server container | Google Ads Conversion Tracking (ID + label) | Event name = `purchase` |
| 6 | Web container | User-provided data → `user_data` (enhanced conversions) | — |
| 7 | Server container | Google Ads Remarketing (optional) | All Pages |
| 8 | Both + Google Ads | Preview, publish, Tag Assistant | — |

### Step 1: Create a conversion action and copy the ID and label

In Google Ads, go to **Goals → Conversions → New conversion action → Website**.

Create it **manually**. Automatically created actions don't give you a conversion label.

Pick **Use Google Tag Manager** as the setup method, then copy the **Conversion ID** and **Conversion label** ([Google's GTM conversion help](https://support.google.com/tagmanager/answer/6105160)).

For purchases, set **Count: Every** and use transaction-specific values.

### Step 2: Host the server container on your own subdomain

Point a subdomain like `track.yourstore.com` at your server container, and turn on SSL. Google's [custom domain guide](https://developers.google.com/tag-platform/tag-manager/server-side/custom-domain) lists the options.

This step matters more than people think.

If the container runs on a default cloud URL, it's on a *third-party* domain, so it can't set the `FPGCLAW` cookie on your site. That's the root cause behind the common "no FPGCLAW cookie" support question.

New to server containers? This walkthrough from MeasureSchool covers the basics:

@[youtube](waqBSk3vkko "How to Set Up GTM Server-Side Tagging (MeasureSchool)" 2024-07-17)

> **Recommended article:** [Server-side GTM setup: step-by-step guide](/blog/server-side-gtm-setup)

### Step 3: Send your Google tag and purchase event to the server

In your **web** container:

- **Route the Google tag to your server.** Use **server_container_url** ("Send to server container") with your subdomain.
- **Send complete purchase data.** Your GA4 `purchase` event needs `transaction_id`, `value` and `currency` from your data layer. The server-side Google Ads tag reads these fields.
- **Add `user_data`** if you'll use enhanced conversions (step 6).

### Step 4: Add the Conversion Linker to the server container

In the **server** container, create a **Conversion Linker** tag and trigger it on **All Pages**.

Already have one? Don't add a second.

Without it, the click ID is never stored or read, so conversions can't be tied to ad clicks.

### Step 5: Add the Google Ads Conversion Tracking tag

Still in the server container, create a **Google Ads Conversion Tracking** tag.

1. Paste the **Conversion ID** and **label** from step 1.
2. Trigger it on a **Custom Event** where the event name equals `purchase` (or whatever your GA4 conversion event is called).
3. Leave the defaults: the tag picks up transaction ID, value and currency from the incoming ecommerce data.

Track leads or sign-ups too? Repeat this step for each conversion action, each with its own label and trigger.

When you're done, your server container's tag list should look roughly like this:

![Illustration of a server Google Tag Manager container with four tags: GA4, Conversion Linker on All Pages, Google Ads Conversion Tracking on the purchase event, and optional Google Ads Remarketing, with the GA4 client listed under Clients](/assets/blog/google-ads-server-container-tags.svg "Illustration of a typical server container for Google Ads. Names are examples; your tags can be named anything.")

### Step 6: Turn on enhanced conversions

Enhanced conversions send a **hashed** email address or phone number with the conversion. This helps Google match it to a signed-in Google user.

Here's how to use it with server-side tagging:

1. **Turn it on in Google Ads**, in your conversion settings.
2. **Create a User-Provided Data variable** in the web container (automatic, CSS selectors, or code). The code method needs at least an email or phone. Pre-hashed values need the `sha256_` prefix.
3. **Assign it to `user_data`** on your Google tag. The server-side Google Ads tag forwards it.

Only collect and send this data where your privacy notice and consent allow it.

Google's own Google Ads channel shows the setup in GTM:

@[youtube](mmy4vEtA0fE "Google Ads Tutorials: Account level Implementation of Enhanced Conversions with Google Tag Manager (Google Ads)")

### Step 7 (optional): Add server-side remarketing

Want remarketing audiences? Add a **Google Ads Remarketing** tag in the server container with your Conversion ID, triggered on All Pages.

Stores can turn on dynamic remarketing and pass product data from the web container.

When `ad_storage` consent is denied, the remarketing tag blocks its requests and cookies ([Google's remarketing setup](https://developers.google.com/tag-platform/tag-manager/server-side/ads-remarketing-setup)).

### Step 8: Test, publish and confirm in Google Ads

This is where most setups fail quietly. Go slowly:

1. **Open Preview** in both the web and server containers.
2. **Fake an ad click.** Visit `https://yourstore.com/?gclid=test123`. In server preview, check that the Conversion Linker fired. In your browser's dev tools, check for an `FPGCLAW` cookie on your domain.
3. **Place a test order.** In server preview, confirm the purchase event arrived with the right transaction ID, value and currency, and that the Google Ads tag fired ([Google's debugging guide](https://developers.google.com/tag-platform/tag-manager/server-side/debug)).
4. **Publish both containers.** Publishing only the web container is one of the most common mistakes.
5. **Check Google Ads.** Open the conversion action and run **Troubleshoot** with Tag Assistant.

How long until you see results?

| When | What to expect | Source |
|---|---|---|
| Right away | Tags fire in server preview | — |
| ~30 minutes after a Tag Assistant session | Conversion action status updates | [Google help](https://support.google.com/google-ads/answer/10989978) |
| Up to 48 hours after a fix | Status reflects the fix | [Google help](https://support.google.com/google-ads/answer/7521212) |
| 2–4 weeks | Enough data to compare with your baseline | Your own reports |

Prefer to watch first? Here's a full walkthrough for a Shopify store:

@[youtube](rO-tXWrD1oY "Google Ads conversion tracking for Shopify with Server-side Google Tag Manager (Analytics Mania)")

## Does Google Ads deduplicate conversions?

Yes, within limits.

You'll sometimes read "Google Ads doesn't deduplicate, so use either the web tag or the server tag." That's only half right.

If two conversions in the **same conversion action** carry the **same transaction ID**, Google counts only the first one ([Google's transaction ID help](https://support.google.com/google-ads/answer/6386790)).

What it *won't* do is merge two **different** conversion actions. So:

- **Don't run two primary purchase actions** (one browser, one server) for the same sale.
- **Retire the old tag.** Once the server action is verified, pause the browser purchase tag or set its action to secondary.
- **Always send a stable `transaction_id`.** Use the order number from every source. It must match exactly, even across offline uploads.

Watch out for native integrations as well. Shopify's Google channel and older WooCommerce plugins can fire their own Google Ads conversions. List every source before you switch.

> **Recommended article:** [Meta Pixel + CAPI: how to check for duplicate purchases](/blog/meta-capi-deduplication-checklist). Same idea, different platform.

## How does Consent Mode v2 work with server-side Google Ads?

First things first: server-side tracking is **not** a way around consent.

Here's how it works with Google's setup:

- **Consent is set in the web container**, usually by your consent banner (CMP) through Consent Mode. The Google tag passes that state to the server with every hit ([Google's server-side consent docs](https://developers.google.com/tag-platform/tag-manager/server-side/consent-mode)).
- **If `ad_storage` is denied**, server tags don't write or read conversion cookies. A cookieless signal is sent instead.
- **Consent Mode v2** added `ad_user_data` and `ad_personalization`. Google requires them for EEA traffic ([Google's consent overview](https://developers.google.com/tag-platform/security/guides/consent)).
- **With advanced Consent Mode**, Google can use cookieless pings to model conversions from visitors who said no ([Google Ads consent help](https://support.google.com/google-ads/answer/10000067)).

For US traffic, follow your privacy policy and the state laws that apply to you. Many consent tools can apply opt-out rules by region.

## What about iOS, wbraid and gbraid?

Since Apple's App Tracking Transparency arrived in April 2021, some iOS clicks arrive without a `gclid`.

Instead, Google uses `wbraid` (web) and `gbraid` (app), plus conversion modeling ([Google's iOS measurement help](https://support.google.com/google-ads/answer/10417364)).

The server Conversion Linker handles these too. Just make sure your site doesn't strip unknown URL parameters on redirect.

**Selling offline?** For leads that close later (a sales call, a signed contract), store the click ID with the lead and upload the conversion afterwards, or use **enhanced conversions for leads**. Google has moved offline imports to its Data Manager API, so check the [current import guidance](https://support.google.com/google-ads/answer/2998031) before building anything new.

> **Recommended article:** [Track form submissions that actually become leads](/blog/server-side-tracking-lead-generation)

## 8 common mistakes (and how to avoid them)

1. **Default cloud URL:** the container runs on a cloud URL, so `FPGCLAW` is never set on your domain. *Fix: use your own subdomain.*
2. **Old tag still live:** a second primary purchase action double-counts. *Fix: retire or demote it.*
3. **Incomplete purchase data:** missing `transaction_id`, `value` or `currency` breaks dedup and ROAS. *Fix: check the data layer.*
4. **No `page_location`:** server-side GA4 events can get attributed to your homepage. *Fix: see our [GA4 guide](/blog/ga4-server-side-tracking).*
5. **One container published:** the web container is live, the server isn't (or the other way round). *Fix: publish both.*
6. **Firing on page view:** the purchase tag fires on the thank-you page view, so every refresh is a new sale. *Fix: trigger on the purchase event.*
7. **Empty `user_data`:** enhanced conversions are on but receive nothing. *Fix: check the variable in preview.*
8. **Judging too early:** three days isn't enough. *Fix: compare 2–4 weeks against your baseline.*

## How do you know it worked?

Repeat your baseline for the same length of time after launch: backend orders, GA4 purchases and Google Ads conversions (by conversion time).

Then look for three things:

- **Coverage holds or rises.** Google Ads conversions as a share of backend orders should go up or stay steady. It should never go above 100% for a purchase action. If it does, you're double counting.
- **Value tracks revenue.** Conversion value in Google Ads should follow your real revenue more closely.
- **No new duplicates.** Spot-check a few order IDs in your Google Ads reports.

Remember, not every order came from an ad.

You're not chasing 100%. You want a consistent, honest signal that Smart Bidding can learn from.

## How do you set this up with Tagioo?

[Tagioo](/features) hosts a dedicated server GTM container on your own tracking subdomain, with DNS guidance and automatic SSL.

Our Setup Assistant generates the Web and Server container files for you, including the **Conversion Linker**, the **Google Ads purchase conversion** and **dynamic remarketing** tags, plus GA4, Meta CAPI and TikTok.

You just import, preview and publish.

Then check **Event Logs** and **Purchase Inspector** to confirm a test order reached your server with the right order ID and value, *before* you go hunting in Google Ads.

![Tagioo Event Logs showing incoming tracking requests reaching a store's own server container](/assets/tagioo-event-logs.png "Tagioo's Event Logs show every request that reached your server container. It's a quick first check before you look in Google Ads.")

There's a free plan with 15,000 events a month, and no card is needed. See [pricing](/pricing), or set it up for [WooCommerce](/woocommerce) or [Shopify](/shopify).

## Sources and further reading

Everything in this guide is backed by these primary sources:

- Google: [Set up Google Ads conversions in server-side Tag Manager](https://developers.google.com/tag-platform/tag-manager/server-side/ads-setup)
- Google: [Server-side consent mode](https://developers.google.com/tag-platform/tag-manager/server-side/consent-mode)
- Google: [Google Ads remarketing in server containers](https://developers.google.com/tag-platform/tag-manager/server-side/ads-remarketing-setup)
- Google: [Custom domain for your tagging server](https://developers.google.com/tag-platform/tag-manager/server-side/custom-domain)
- Google: [Google tag gateway for advertisers](https://developers.google.com/tag-platform/tag-manager/gateway)
- Google Ads Help: [Transaction IDs and duplicate conversions](https://support.google.com/google-ads/answer/6386790)
- Google Ads Help: [Conversion windows](https://support.google.com/google-ads/answer/3123169)
- Google: [Cookies used by Google advertising](https://business.safety.google/adscookies/)
- WebKit: [ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/), [ITP 2.2](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-2/), [CNAME cloaking defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/)
- Simo Ahava: [Google Ads conversion tracking with server-side tagging](https://www.simoahava.com/analytics/google-ads-server-side-tagging-google-tag-manager/)

## Related questions

### Is server-side tracking legal?

Yes. Server-side tracking is a way of *moving* data, not a legal basis for *collecting* it.

The same rules apply as for browser tags: consent under GDPR and ePrivacy in the EU, notice and opt-out rights under US state laws like the CCPA/CPRA, and limits on sharing sensitive data. The FTC has [warned](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2023/03/lurking-beneath-surface-hidden-impacts-pixel-tracking) that tracking which leaks personal or health information can break the law, whatever technology sends it.

Respect your visitors' choices, and check with a qualified lawyer for your situation. This isn't legal advice.

### What does server-side tracking mean?

It means your website sends tracking data to a server you control, usually on your own subdomain. That server then forwards it to platforms like Google Ads, GA4 or Meta.

Want the basics? Read our [guide to what server-side tracking is and how it works](/blog/server-side-tracking-explained).

### Is $20 a day good for Google Ads?

It can work for testing, but it depends on your cost per click and cost per conversion.

At $20 a day (about $600 a month) and a $40 cost per acquisition, you'd get roughly 15 conversions a month. That's thin data for Smart Bidding. Google suggests evaluating Target CPA over about 30 days with at least 30 conversions ([Google's bidding help](https://support.google.com/google-ads/answer/6268632)).

With a small budget, every recorded conversion matters more, so accurate tracking helps. But it can't make up for a budget that's too small for your market.

### How do I set up server-side tracking for Google Ads?

In short:

1. Create a manual website conversion action.
2. Host a server GTM container on your own subdomain.
3. Route your GA4 Google tag through it.
4. In the server container, add a Conversion Linker and a Google Ads Conversion Tracking tag, triggered on your purchase event.
5. Test with a `?gclid=` URL and a test order, publish both containers, and confirm in Google Ads.

The 8 steps above walk through each one.

### Does server-side tracking bypass ad blockers?

Not completely, and that shouldn't be the goal.

Serving tracking from your own subdomain makes it less likely to be caught by blocklists that target Google's domains, but some tools block first-party endpoints too. And server-side tracking never overrides consent. More in our [ad blocker guide](/blog/ad-blocker-tracking-loss).

### What is the Google Ads conversion tracking extension?

People usually mean **Tag Assistant**, Google's Chrome extension for checking that tags fire correctly.

Google has merged its Legacy and Companion versions into one extension ([Tag Assistant help](https://support.google.com/tagmanager/answer/16463290)). You can also open it from the **Troubleshoot** option on any conversion action in Google Ads.

### Does Google Ads deduplicate conversions from browser and server tags?

Within the same conversion action, yes. Conversions with the same transaction ID are counted once.

Across two different conversion actions, no. So don't run a browser purchase action and a server purchase action side by side as primary goals.

### How long until Google Ads shows the conversion status?

About 30 minutes after a Tag Assistant troubleshooting session, and up to 48 hours after you fix a problem.

Test conversions appear in reports once Google processes them. Use the conversion-time column when you compare.
