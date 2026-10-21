---
title: "Safari ITP and iOS Tracking: What Still Works for Conversion Tracking"
seoTitle: "Safari ITP and iOS Tracking: What Still Works (2026)"
description: Safari ITP explained: cookie caps, link decoration, CNAME and IP cloaking, ATT vs ITP, iOS 26 changes, and what still works for conversion tracking.
category: Privacy
keyword: safari itp
published: 2026-11-01
updated: 2026-11-01
summary: What Safari ITP, App Tracking Transparency and Link Tracking Protection change, and which conversion tracking methods still hold up.
related: first-party-tracking, meta-conversions-api, ad-blocker-tracking-loss
featured: false
---
# Safari ITP and iOS Tracking: What Still Works for Conversion Tracking

An iPhone shopper clicks your Instagram ad on Monday. She comes back the following Thursday, ten days later, and buys.

Your store records the sale. Meta doesn't.

Was it the iOS app prompt? Safari? A stripped `fbclid`? Or did the cookie just quietly expire?

Ahh, so many questions. Let's sort them out.

**What is Safari ITP?** Safari ITP (Intelligent Tracking Prevention) is WebKit's set of built-in protections that blocks third-party cookies, caps how long some first-party cookies last, and limits cross-site tracking. It shortens attribution windows for Safari and iPhone visitors. Server-set first-party cookies and server events with consented match keys still work well.

Safari is the default browser on every iPhone and Mac.

So for many stores, a big share of mobile traffic runs through these rules. Including the ten-day buyer above.

> **Key takeaways**
> - ITP blocks third-party cookies and caps cookies written by JavaScript at **7 days**, or **1 day** after some ad clicks.
> - Server-set cookies can last longer, unless your tracking subdomain points at a third party's servers. Then Safari caps them at 7 days too.
> - ITP (the browser) and App Tracking Transparency (the app prompt) are different systems. You can influence ITP outcomes. You can't influence ATT.
> - Link Tracking Protection removes click IDs in Private Browsing, Mail and Messages. UTMs survive.
> - What still works: first-party server-set cookies, server-side events with consented hashed data, enhanced conversions and backend purchase hits. All of them respect consent.

In this guide, you'll find out exactly what ITP does, how it differs from ATT, what Safari 17 and Safari 26 changed, how to test it yourself, and which tracking methods still hold up. We'll also answer *"Does a cookie banner disable ITP?"* and *"Can server-side tracking bypass ITP?"*

So, why the wait? Let's begin.

![Timeline of Safari tracking prevention from 2017 to 2025: ITP 1.0, ITP 2.0, ITP 2.1 with the 7-day JavaScript cookie cap, ITP 2.2 with the 1-day cap, ITP 2.3, full third-party cookie blocking, the CNAME cloaking defense, Link Tracking Protection in Safari 17, and fingerprinting protection by default in Safari 26](/assets/blog/safari-itp-ios-tracking-timeline.svg "Eight years of ITP. Each step made browser-side identifiers a little shorter-lived.")

## What does Safari ITP do?

WebKit documents ITP in its [tracking prevention policy](https://webkit.org/tracking-prevention/) and a long series of blog posts.

Here are the parts that matter for conversion tracking:

- **Third-party cookies are blocked.** Since Safari 13.1 and iOS 13.4, WebKit has [blocked third-party cookies by default](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). An ad network's cookie on its own domain can't follow someone from site to site.
- **JavaScript cookies are capped at 7 days.** [ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/) capped persistent cookies created through `document.cookie` at seven days. That includes the first-party `_ga`, `_gcl_au` and `_fbp` cookies standard tags write.
- **Some ad clicks trigger a 1-day cap.** [ITP 2.2](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-2/) cuts JavaScript cookies to 24 hours when a domain classified as a tracker sent the visitor, *and* the landing URL has a query string or fragment. Think `?fbclid=` or `?gclid=`.
- **Script storage is deleted after 7 days.** LocalStorage, IndexedDB and similar storage get removed after 7 days of Safari use without interaction on your site ([ITP 2.3](https://webkit.org/blog/9521/intelligent-tracking-prevention-2-3/)).
- **Cloaked server cookies are capped too.** Cookies set by a subdomain that's CNAME-cloaked to a third party are capped at 7 days ([CNAME cloaking defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/)). WebKit later added the same cap for subdomains pointing to a third party's IP address, in regular browsing too ([Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/)).
- **The referrer gets trimmed.** After a link-decorated click from a tracker domain, `document.referrer` is cut down to the site's main domain (ITP 2.3).

How long does each cookie actually last? Here's the cheat sheet:

| Cookie or storage | How it's created | Max lifetime in Safari |
|---|---|---|
| Third-party cookie | Any | Blocked |
| `_ga`, `_fbp`, `_gcl_au` (standard tags) | JavaScript | 7 days |
| Same, after a click from a tracker domain with `?query` | JavaScript | 1 day |
| LocalStorage, IndexedDB | JavaScript | Deleted after 7 days without interaction |
| Server-set cookie, CNAME- or IP-cloaked to a third party | HTTP header | 7 days |
| Server-set cookie from your own infrastructure | HTTP header | The expiry you set |

> **Recommended article:** [First-party tracking: custom domains, cookies and why they matter](/blog/first-party-tracking)

## How does ITP hurt Meta and Google Ads attribution?

Put those rules together and you get a familiar pattern:

- **Shorter effective windows.** If the click ID or `_fbp` cookie expires after 1 or 7 days, a sale on day 10 can't be tied to the click. The platform reports fewer conversions than really happened.
- **More "new" users.** GA4 sees a returning Safari visitor as new once `_ga` expires. Returning-user rates look worse than reality.
- **Lower match quality.** Meta's Event Match Quality depends partly on `fbp` and `fbc`. When they're missing, the server event leans more on hashed customer data.
- **Weaker remarketing.** Shorter-lived cookies mean smaller, less accurate audiences of past Safari visitors.
- **Modeled conversions fill some gaps.** Both Google and Meta model some conversions they can't observe. That helps totals, but you can't inspect a modeled conversion order by order.

Google Ads' default click-through conversion window is 30 days. A 7-day cookie covers less than a quarter of it.

![Bar chart of the maximum Google Ads click ID cookie lifetime: 90 days in Chrome or Firefox, 7 days in Safari, 1 day in Safari after some ad clicks, and up to 90 days for the server-set FPGCLAW cookie, against a 30-day conversion window](/assets/blog/google-ads-click-id-cookie-lifetime.svg "The same click ID cookie, very different lifetimes. Safari's caps are the reason Safari sales go unattributed.")

None of this means your tracking is broken. It means browser-side identifiers are less durable on Apple devices, and you need signals that don't depend only on them.

## Is ITP the same as App Tracking Transparency?

No. They get lumped together all the time, but they're separate systems.

| | App Tracking Transparency (ATT) | Intelligent Tracking Prevention (ITP) |
|---|---|---|
| Where it applies | Native iOS apps | Safari and WebKit browsers |
| What it controls | Tracking across other companies' apps and websites, and access to the IDFA | Cookies, storage and cross-site tracking on websites |
| How it works | A permission prompt the user answers | Automatic browser rules, no prompt |
| Started | iOS 14.5 (2021) | Safari 11 (2017) |
| Can your website change the outcome? | No | Partly, by how you set cookies and send events |

Apple's [user privacy and data use page](https://developer.apple.com/app-store/user-privacy-and-data-use/) says apps need permission through ATT to track users or access the advertising identifier. Without it, the identifier is "all zeros."

That hit Meta hard, because many purchases start with an ad seen inside the Facebook or Instagram app.

For an online store, ATT mostly affects what the ad platform knows *inside its own app*. ITP affects what *your website* can store. Your site can't change ATT outcomes, and you shouldn't try to link app users who declined.

Google responded with new click parameters, `wbraid` for web and `gbraid` for app conversions, paired with conversion modeling ([Google's iOS measurement help](https://support.google.com/google-ads/answer/10417364)). Keep them intact on redirects.

Digiday's short explainer covers Apple's wider privacy push well:

@[youtube](9X5-vVddsFg "WTF is Apple's Advanced Tracking and Fingerprinting Protection? (Digiday)" 2023-10-13)

## Does Safari remove gclid and fbclid from links?

Sometimes. It depends on where the link is opened.

With iOS 17, Apple [announced Link Tracking Protection](https://www.apple.com/newsroom/2023/06/apple-announces-powerful-new-privacy-and-security-features/). It removes tracking information from links users share in Messages and Mail, and from links in Safari Private Browsing.

WebKit adds detail: Safari removes "a subset of query parameters" identified as used for cross-site tracking. Campaign-level parameters are allowed through ([Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/)).

![Table of Safari Link Tracking Protection: click IDs usually kept in normal Safari browsing, removed in Private Browsing, removed in links shared in Mail or Messages, and removed when the user turns on protection for all browsing; UTM parameters kept in every case](/assets/blog/safari-itp-ios-tracking-link-protection.svg "Normal browsing usually keeps click IDs. Private Browsing, Mail and Messages are where they disappear.")

What to expect in practice:

- **Paid clicks in normal Safari** usually still carry the click ID. The 1-day cap may still apply to JavaScript cookies set on that landing page.
- **Links from Mail, Messages or Private Browsing** may arrive without the click ID. UTMs survive.
- **Users can opt in to more.** Setting Advanced Tracking and Fingerprinting Protection to "All Browsing" extends these protections to normal browsing.
- **Apple doesn't publish the list.** Independent tests report `gclid` and `fbclid` among the removed parameters. Check your own landing page URLs on current iOS rather than trusting old articles.

## What changed in iOS 26 and Safari 26?

Apple's iOS 26 announcement says Safari's advanced fingerprinting protection now extends "to all browsing by default" ([Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/)).

WebKit's [Safari 26.0 post](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) explains what that means for **known fingerprinting scripts**:

- They can't reliably read device details like screen dimensions or hardware concurrency.
- They can't set long-lived storage, such as cookies or LocalStorage.
- They can't read query parameters or `document.referrer`.

For a normal store, the key point is simple. If a script you run is classified as a fingerprinting script, it may lose access to your URL parameters and its own cookies.

Here's what didn't change by default: Link Tracking Protection in normal browsing still requires the user's opt-in, as far as Apple has documented.

> **Recommended article:** [Google Ads server-side tracking: the complete 2026 setup guide](/blog/google-ads-server-side-tracking)

## Does a cookie consent banner disable ITP?

No. This one confuses a lot of people.

A visitor clicking "Accept all" tells *you* what they agreed to. It doesn't change Safari's rules. A JavaScript cookie set after consent is still capped at 7 days.

It works the other way round too. ITP doesn't replace your consent banner. You still need consent where the law requires it, whatever Safari does.

## How do you test what ITP does to your cookies?

Don't trust any article for your exact numbers, ours included. Test it:

1. **Open your store in Safari on a Mac.** Turn on the Develop menu in Safari's advanced settings.
2. **Open Web Inspector → Storage → Cookies.** Look at the **Expires** column for `_ga`, `_fbp`, `_gcl_au` and any server-set cookies, such as `FPID`.
3. **Compare with Chrome.** The same cookie may show a much longer expiry there.
4. **Simulate an ad click.** Visit your store with `?gclid=test123` and check the click ID cookie's expiry.
5. **Check server-set cookies.** If a server cookie shows a 7-day expiry in Safari but a longer one in Chrome, Safari is treating your tracking subdomain as a third party.
6. **Test on iPhone.** Connect it to the Mac and inspect it from the Develop menu. Try links from Mail and Private Browsing too.

WebKit also built an **ITP Debug Mode**, first shipped in [Safari Technology Preview 62](https://webkit.org/blog/8387/itp-debug-mode-in-safari-technology-preview-62/), that logs which domains ITP classifies as trackers. This older walkthrough shows how it works:

@[youtube](RRR8SbuRyns "Intelligent Tracking Prevention - Debug (Connected Path)" 2018-09-26)

## What still works for iOS conversion tracking?

Each of these works *within* the visitor's consent choices. None of them is a way to track people who said no.

![Illustrative scenario of a Safari shopper who clicks an ad on day 0 and buys on day 10: with browser-only tracking the 7-day JavaScript cookie has expired and the purchase can't be tied to the click; with server-side tracking and consent, a server-set cookie and a server purchase event with order ID and hashed email give the platform a better chance to match it](/assets/blog/safari-itp-ios-tracking-day-10-purchase.svg "The ten-day buyer from the intro, in two setups. Server-side signals give the platform more to match on, but it's never a guarantee.")

1. **First-party, server-set cookies.** A tagging server on your own domain sets cookies with an HTTP header instead of `document.cookie`, so the 7-day JavaScript cap doesn't apply. Safari may still cap them if your subdomain resolves to third-party infrastructure. Check in Web Inspector.
2. **Server-side events with match keys.** Send the purchase from your server with consented customer data, such as hashed email and phone, plus `fbp` and `fbc` when available. The platform can match the sale even after the browser cookie is gone.
3. **Meta Conversions API.** Meta's [Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api) receives events from your server. Pair it with the browser Pixel and a shared event ID, so Meta deduplicates the two.
4. **Google Ads enhanced conversions.** [Enhanced conversions](https://support.google.com/google-ads/answer/9888656) add SHA-256 hashed first-party data, such as email, to your conversion tags, so Google can match conversions to signed-in users.
5. **Backend purchase hits.** A purchase sent from your store's backend doesn't depend on the thank-you page loading in Safari at all.
6. **Clean UTMs.** UTM parameters survive Link Tracking Protection and still give GA4 campaign data when click IDs are removed.

Collect and send hashed customer data only where your consent setup and privacy policy allow it.

> **Recommended article:** [Meta Pixel + CAPI: how to check for duplicate purchases](/blog/meta-capi-deduplication-checklist)

## What doesn't help (and can backfire)?

| Tactic | Why to skip it |
|---|---|
| **Fingerprinting** visitors to replace cookies | Safari actively restricts known fingerprinting scripts, and it undermines trust |
| **Renaming click IDs** to dodge Link Tracking Protection | Goes against the user's choice, and likely to be caught by a future release |
| **Rewriting `document.cookie` on every visit** | Doesn't escape the cap. It just restarts the 7 days and makes debugging harder |
| **Ignoring consent** because the endpoint is first-party | The domain doesn't change your obligations |
| **Expecting dashboards to match exactly** | Even a strong setup leaves some Safari conversions unattributed |

Instead, compare backend orders with platform conversions over a few weeks. Our guide to [conversion tracking discrepancies](/blog/conversion-tracking-discrepancies) shows how.

## How do you set this up with Tagioo?

[Tagioo](/features) hosts a dedicated server-side GTM container on your own tracking subdomain, with DNS guidance and automatic SSL.

For Safari and iPhone buyers, that gives you:

- **Meta CAPI for the full funnel.** ViewContent, AddToCart, InitiateCheckout and Purchase go server-side from your first-party endpoint, with hashed match keys, `fbp`/`fbc` and event ID dedup. The purchase event ID is the order ID.
- **Google Ads tags.** The Setup Assistant includes the Conversion Linker, purchase conversion and dynamic remarketing tags.
- **A backend purchase hit on WooCommerce**, deduplicated on `transaction_id`, so orders count even if the thank-you page tag never fires.

One honest note. Your Tagioo subdomain points at our servers, not your website's. So Safari may cap server-set cookies at 7 days, as WebKit describes. Server events with consented match keys don't depend on that cookie, which is why they matter most here.

The [free plan](/pricing) covers 15,000 events per 30 days, no card needed. See [how it works](/how-it-works), or set it up for [WooCommerce](/woocommerce) or [Shopify](/shopify).

## Sources and further reading

- WebKit: [Tracking prevention policy](https://webkit.org/tracking-prevention/)
- WebKit: [ITP 1.0](https://webkit.org/blog/7675/intelligent-tracking-prevention/), [ITP 2.0](https://webkit.org/blog/8311/intelligent-tracking-prevention-2-0/), [ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/), [ITP 2.2](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-2/), [ITP 2.3](https://webkit.org/blog/9521/intelligent-tracking-prevention-2-3/)
- WebKit: [Full third-party cookie blocking](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [CNAME cloaking defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/), [Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/), [Safari 26.0 features](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [ITP Debug Mode](https://webkit.org/blog/8387/itp-debug-mode-in-safari-technology-preview-62/)
- Apple: [Link Tracking Protection announcement (2023)](https://www.apple.com/newsroom/2023/06/apple-announces-powerful-new-privacy-and-security-features/), [iOS 26 announcement](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/), [User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- Google Ads Help: [iOS campaign measurement (wbraid, gbraid)](https://support.google.com/google-ads/answer/10417364), [Enhanced conversions](https://support.google.com/google-ads/answer/9888656)
- Meta: [Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api)

## Related questions

### What does ITP stand for?

ITP stands for Intelligent Tracking Prevention. It's WebKit's set of anti-tracking rules, built into Safari on Mac, iPhone and iPad since 2017.

### Does Safari ITP block Google Analytics?

No. ITP doesn't stop GA4 from loading or sending hits. It limits how long the `_ga` cookie lasts when JavaScript sets it, so returning Safari visitors are more likely to count as new.

Content blockers and privacy browsers are a separate issue. See [how ad blockers affect tracking](/blog/ad-blocker-tracking-loss).

### How long do cookies last under Safari ITP?

Cookies written by JavaScript last up to 7 days, or 1 day after a click from a tracker-classified domain with a query string. Third-party cookies are blocked.

Server-set cookies last as long as you set them, unless the server is CNAME- or IP-cloaked to a third party. Then they're capped at 7 days.

### Can server-side tracking bypass Safari ITP?

It's better to say it works *within* ITP. Server-set cookies avoid the 7-day cap on JavaScript cookies, which is why Google recommends a first-party tagging server domain. But WebKit caps server cookies from cloaked third-party subdomains too.

And server-side tracking still needs consent, like any other cookie.

### Does Safari ITP block ads?

Not directly. ITP limits cookies and storage, which weakens ad tracking and retargeting. Safari's Private Browsing also blocks known trackers using DuckDuckGo and EasyPrivacy rules, but most ads still load, according to WebKit.

### Does a cookie consent banner disable Safari ITP?

No. Consent tells you what the visitor agreed to. It doesn't change Safari's cookie caps. A JavaScript cookie set after "Accept all" is still capped at 7 days.

### What is the most reliable way to track iPhone purchases?

Combine a first-party tagging server with server-side purchase events that carry consented match keys and a deduplication ID. Send them to the Meta Conversions API and Google Ads enhanced conversions, then check the result against backend orders.

Tagioo's [setup guide](/how-it-works) walks through it, and the [free plan](/pricing) covers 15,000 events per 30 days.
