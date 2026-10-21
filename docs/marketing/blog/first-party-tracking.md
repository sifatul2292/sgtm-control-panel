---
title: What Is First-Party Tracking? Custom Domains and Server-Set Cookies Explained
seoTitle: What Is First-Party Tracking? Domains & Cookies (2026)
description: First-party tracking explained: first- vs third-party cookies, custom tracking subdomains, server-set cookies, Safari ITP caps, consent, and a setup checklist.
category: Privacy
keyword: first party tracking
published: 2026-10-30
updated: 2026-10-30
summary: How first-party tracking domains and server-set cookies work, what browsers still limit, and a setup checklist for your store.
related: safari-itp-ios-tracking, ad-blocker-tracking-loss, server-side-gtm-setup
featured: false
---
# What Is First-Party Tracking? Custom Domains and Server-Set Cookies Explained

You moved your tags to `track.yourstore.com`. Every guide called it "first-party tracking."

But Safari still forgets your returning customers after a week.

So is it really first-party? Is the `_ga` cookie first-party already? And do you still need a cookie banner if everything runs on your own domain?

Ahh, so many questions. Let's untangle them.

**What is first-party tracking?** First-party tracking means your measurement requests and cookies belong to your own website's domain, not a vendor's. Tags send data to an endpoint such as `track.yourstore.com`, and that server sets cookies for `yourstore.com`. Browsers treat this more favorably than third-party trackers. You still need consent, and some browser limits still apply.

The word gets used loosely. A setup can be "first-party" in one way and third-party in another.

And how the cookie is *written* matters just as much as its domain.

> **Key takeaways**
> - First-party is about two things: where requests go, and who sets the cookies. A full setup has both on your own domain.
> - Cookies written by JavaScript are capped at 7 days in Safari, or 1 day after some ad clicks. Server-set cookies can last longer.
> - Safari also caps server-set cookies at 7 days when your tracking subdomain points to a third party's servers. Check it, don't assume.
> - Google calls a same-origin setup (`yourstore.com/metrics`) a best practice. A subdomain is the practical choice for most stores.
> - First-party tracking never removes the need for consent. Consent rules apply to the cookie, whoever's domain it's on.

In this guide, you'll find the difference between first- and third-party tracking, why third-party tracking keeps getting weaker, how cookie lifetimes really work in Safari, and how to set up a tracking subdomain properly. We'll also answer *"Do first-party cookies need consent?"* and *"Can ad blockers still block first-party tracking?"*

So, why the wait? Let's begin.

![Side-by-side diagram: third-party tracking sends requests from yourstore.com straight to vendor domains like google-analytics.com and connect.facebook.net, while first-party tracking sends one request to track.yourstore.com, where a server container sets cookies for the store's own domain and forwards events to GA4, Google Ads, Meta and TikTok](/assets/blog/first-party-tracking-first-vs-third.svg "Third-party tracking talks to vendor domains directly. First-party tracking talks to your own subdomain, which then forwards data on your terms.")

## What does first-party tracking mean?

The terms describe the relationship between a resource and the site in the address bar.

If the visitor is on `yourstore.com`, anything on `yourstore.com` or its subdomains is **first-party**. Anything on another site is **third-party**.

Here's where people get confused. There are two separate things to check:

- **First-party cookies** are stored under your domain. GA4's `_ga` cookie and Meta's `_fbp` cookie are first-party cookies, even though a Google or Meta script writes them with JavaScript ([Google's GA4 cookie usage help](https://support.google.com/analytics/answer/11397207)).
- **First-party requests** go to a host on your domain. A standard GA4 setup sends hits to Google's collection domains. Those are third-party requests, even though the `_ga` cookie is first-party.

So a "normal" GA4 setup is half first-party. The cookie is yours. The request isn't.

A full first-party setup has both: a loader and collection endpoint on your domain, and cookies that your own server sets. MDN's [guide to HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) is a good reference for the attributes involved.

| Setup | Cookie | Requests | Fully first-party? |
|---|---|---|---|
| Standard GA4 tag | `_ga`, set by JavaScript on your domain | To Google's domains | No |
| Standard Meta Pixel | `_fbp`, set by JavaScript on your domain | To `facebook.com` | No |
| Server-side GTM on the default cloud URL | JavaScript cookies only | To the provider's domain | No |
| Server-side GTM on `track.yourstore.com` | Can be set by your server | To your subdomain | Yes |
| Server-side GTM on `yourstore.com/metrics` | Can be set by your server | To your own origin | Yes |

## First-party vs third-party tracking: what's the difference?

Here's the short version:

| | First-party | Third-party |
|---|---|---|
| Cookie domain | Your site, e.g. `yourstore.com` | Another site, e.g. an ad network |
| Request destination | Your domain or subdomain | A vendor's domain |
| Who can read the cookie | Your site and its subdomains | The vendor, across every site that embeds it |
| Browser treatment | Generally allowed, with limits | Blocked in Safari, isolated in Firefox |
| Filter lists | Less often matched by host | Common targets |
| Who controls the data flow | You, before it's forwarded | The vendor, directly |

That last row is underrated.

With a first-party endpoint, data stops at your server first. You decide what each vendor receives, and you can strip fields a vendor doesn't need.

Want the cookie basics explained on camera? Lights OnData covers them in a few minutes:

@[youtube](PWQEc6NjhfM "First Party Cookies vs. Third Party Cookies (Lights OnData)" 2022-02-23)

### Is first-party data the same as first-party tracking?

Not quite, though they're related.

**First-party data** is information *you* collect directly from your customers: orders, email sign-ups, account details. **First-party tracking** is the *method* of collecting behavioral data through your own domain.

First-party tracking is one of the cleaner ways to gather first-party data. But a CRM export is first-party data too, with no tracking involved.

## Why is third-party tracking getting weaker?

Because two of the three big browser engines already block or isolate it.

**Safari.** WebKit announced [full third-party cookie blocking](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) in March 2020, with Safari 13.1 and iOS 13.4. Intelligent Tracking Prevention also limits some first-party storage, which we cover below.

**Firefox.** Mozilla made [Total Cookie Protection](https://blog.mozilla.org/en/products/firefox/firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide/) the default in June 2022. Each site gets its own cookie jar, so a tracker's cookie on one site can't be read on another.

**Chrome.** Chrome changed course. In April 2025 Google said it would [keep its current approach to third-party cookie choice](https://privacysandbox.google.com/blog/privacy-sandbox-next-steps) instead of rolling out a new prompt. In October 2025 it [announced the retirement](https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies) of most Privacy Sandbox technologies.

So, as of October 2026, Chrome still allows third-party cookies in normal browsing by default. Users can block them in settings, and Incognito blocks them by default.

Add Brave, which blocks cross-site cookies and known trackers by default, plus content blockers on desktop. A setup that depends on vendor domains and cross-site cookies gets less reliable every year, whatever Chrome does.

## Why does it matter whether JavaScript or a server sets the cookie?

This is the part most "first-party tracking" articles skip. And it's the part that explains the Safari problem from the intro.

There are two ways to create a cookie:

- **JavaScript-set cookies** are written by a script with `document.cookie`. Most tags work this way, including standard GA4 and Meta Pixel cookies.
- **Server-set cookies** arrive in a `Set-Cookie` HTTP header from a server on your domain. They can be marked `HttpOnly`, so page scripts can't read them.

Safari treats them very differently:

- **JavaScript cookies: 7 days.** [ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/) capped cookies created through `document.cookie` at seven days. WebKit's [tracking prevention policy](https://webkit.org/tracking-prevention/) now says ITP deletes them after 7 days without user interaction on the site.
- **JavaScript cookies after some clicks: 1 day.** [ITP 2.2](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-2/) cuts the cap to 24 hours when a tracker-classified domain sent the visitor, and the landing URL has a query string or fragment.
- **Server-set cookies from a cloaked third party: 7 days.** Since Safari 14, cookies set in responses from a subdomain that's CNAME-cloaked to a third party are capped at 7 days ([WebKit's CNAME cloaking defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/)).
- **Server-set cookies from a third-party IP: also 7 days.** WebKit later added the same cap for subdomains that point to a third party's IP address. It treats two IPv4 addresses as different parties if they share less than the first 16 bits ([WebKit: Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/)). This applies in regular browsing too.

![Bar chart of Safari's maximum first-party cookie lifetime: 7 days for JavaScript-set cookies, 1 day for JavaScript cookies after a click from a tracker-classified domain, 7 days for server-set cookies from a cloaked third party, and the full expiry you set for server-set cookies from your own infrastructure](/assets/blog/first-party-tracking-safari-cookie-caps.svg "In Safari, both the method and the server behind the subdomain decide how long a cookie can live.")

What does this mean in practice?

A returning Safari visitor after eight days may look like a brand-new user in GA4. Even with a first-party `_ga` cookie.

A server-set cookie can avoid that, but only if your tracking server sits on infrastructure Safari sees as yours. And other browsers have caps too: Chrome limits *every* cookie to 400 days ([Chrome for Developers](https://developer.chrome.com/blog/cookie-max-age-expires)), even though GA4's default `_ga` expiry is 2 years.

For GA4 specifically, server-side GTM can set a **server-managed** client ID cookie called `FPID`, which is `HttpOnly`. Simo Ahava explains how it works, and how to stop the server setting it when you don't want it ([#GTMTips: Prevent SGTM from setting the FPID cookie](https://www.simoahava.com/gtm-tips/prevent-sgtm-from-setting-fpid-cookie/)).

> **Recommended article:** [Safari ITP and iOS privacy: what still works for conversion tracking](/blog/safari-itp-ios-tracking)

## Subdomain or same origin: which setup should you choose?

Google's [custom domain guide](https://developers.google.com/tag-platform/tag-manager/server-side/custom-domain) lists three ways to host a tagging server:

![Three cards comparing tagging server hosting: a default provider URL that is third-party with JavaScript cookies only, a subdomain like track.yourstore.com that is first-party with one DNS record, and a same-origin path like yourstore.com/metrics that is first-party and most durable in Safari but needs a CDN or load balancer](/assets/blog/first-party-tracking-setup-options.svg "Most stores use a subdomain. Teams that control their CDN can go same-origin.")

Google says the default domain runs "in a third-party context" and can only set JavaScript cookies. Both custom options get full access to server-set cookies, and Google calls same-origin serving a best practice.

Here's how the two first-party options compare:

| | Subdomain (`track.yourstore.com`) | Same origin (`yourstore.com/metrics`) |
|---|---|---|
| Setup effort | One DNS record | CDN or load balancer path routing |
| Server-set cookies | Yes | Yes |
| Safari 7-day cap on server cookies | May apply if the subdomain resolves to third-party infrastructure | Avoided when served through your own site's infrastructure |
| Works with most hosting | Yes | Only if you control a proxy or CDN in front of your site |
| Good fit for | Most stores and agencies | Teams with engineering control of the edge |

Our honest take? For most stores, a subdomain is the practical choice. It's a big step up from vendor domains, even when Safari caps some cookies.

If you already run a CDN with path routing, same-origin is worth the extra work for Safari durability.


## How do you set up a first-party tracking subdomain?

A typical subdomain setup takes six steps:

1. **Choose a neutral hostname.** Something like `track`, `data` or `sgtm` under your main domain. Use your own registrable domain, not a separate one.
2. **Add the DNS record your host gives you.** Usually an `A` record pointing to an IP address, or a `CNAME` pointing to a hostname. Use exactly what your provider specifies, and don't proxy it through a CDN unless the provider supports that.
3. **Wait for DNS and SSL.** The hostname must serve valid HTTPS before browsers will send tag traffic to it. Managed hosts usually issue the certificate automatically once DNS resolves.
4. **Point your tags at it.** In your web GTM container, set the Google tag's server container URL to `https://track.yourstore.com`. Make sure the server container's clients claim the requests.
5. **Serve the loader first-party (optional).** If `gtm.js` also loads from your domain, browsers that block `googletagmanager.com` can still load your container, subject to consent.
6. **Test in preview mode.** Confirm requests arrive, the right client claims them, and tags fire. Then check real cookie expiry in Safari's Web Inspector.

> **Recommended article:** [Server-side GTM setup: step-by-step guide](/blog/server-side-gtm-setup)

## Does first-party tracking need consent?

Yes. This one's not up for debate.

Consent rules apply to what you store and read on the visitor's device, and why. Not to which domain owns it.

The UK's ICO, for example, says its cookie rules apply to "anyone who stores information on a user's device" ([ICO: cookies and similar technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/)). Only strictly necessary cookies, like a shopping basket, are exempt. In most cases, analytics and ad cookies don't count as strictly necessary.

So in practice:

- **Keep your consent banner in control.** It should decide which tags fire, wherever they load from.
- **Pass consent to the server.** With Google's setup, consent state travels from the web container to the server container with each hit ([Google's server-side consent mode docs](https://developers.google.com/tag-platform/tag-manager/server-side/consent-mode)).
- **Disclose the subdomain.** Your privacy policy should name the tracking subdomain and the vendors that receive data from it.
- **US traffic too.** Follow your privacy policy and the state laws that apply to you. Many consent tools apply opt-out rules by region.

None of this is legal advice. Ask a privacy lawyer about your situation.

## Can ad blockers still block first-party tracking?

Some can, yes.

Moving to your own subdomain makes requests less likely to match **host-based** filter rules. But many tools also match paths, script names and behavior, and lists change all the time.

Expect some visitors to stay unmeasured. That's acceptable, and it's not something to "fix."

> **Recommended article:** [How ad blockers affect your tracking (and how to measure the gap)](/blog/ad-blocker-tracking-loss)

## First-party tracking checklist

Use this before and after you switch:

1. **Hostname.** Your tracking hostname is a subdomain of your main registrable domain and serves valid HTTPS.
2. **Routing.** The Google tag's server container URL points at it, and preview shows requests arriving.
3. **Loader.** `gtm.js` is served from your domain, if you want coverage in browsers that block Google's hosts.
4. **Consent.** Your banner and consent mode still control which tags fire. Declined visitors send no analytics or ad data.
5. **Disclosure.** Your privacy policy names the tracking subdomain and the vendors that receive data.
6. **Cookie expiry.** In Safari's Web Inspector, you checked the real expiry of `_ga`, `_fbp` and any server-set cookies.
7. **Orders.** GA4 purchases match backend orders on transaction ID at least as well as before.
8. **Dedup.** Meta and TikTok events carry an event ID, so browser and server events deduplicate.

The free [Website Tracking Checker](/website-tracking-checker) scans a public site and reports which tags it finds and whether they route through a first-party domain.

## How do you set this up with Tagioo?

[Tagioo](/features) gives each customer a dedicated, isolated server-side GTM container on a custom tracking subdomain, with DNS guidance in the panel and automatic SSL.

The Setup Assistant generates Web and Server container files for GA4, Meta CAPI, TikTok and Google Ads. You import, preview and publish. On [WooCommerce](/woocommerce), the optional Custom Loader also serves `gtm.js` from your own domain.

One honest note. Like any hosted sGTM service, your tracking subdomain points at our servers, not your website's. So Safari may apply its 7-day cap to server-set cookies, as described above.

Tagioo's optional first-party cookie lifetime extension lengthens the cookie your server container sets, subject to those same browser rules. Check the result in Safari's Web Inspector before you rely on it.

The free plan covers 15,000 events per 30 days, and paid plans start at $30 a month. See [pricing](/pricing) or [how it works](/how-it-works).

## Sources and further reading

- Google: [Custom domain configuration for server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/custom-domain)
- Google: [Server-side consent mode](https://developers.google.com/tag-platform/tag-manager/server-side/consent-mode)
- Google Analytics Help: [Cookie usage on websites](https://support.google.com/analytics/answer/11397207)
- WebKit: [Tracking prevention policy](https://webkit.org/tracking-prevention/), [ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/), [ITP 2.2](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-2/), [CNAME cloaking defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/), [Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/), [Full third-party cookie blocking](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
- Mozilla: [Total Cookie Protection by default](https://blog.mozilla.org/en/products/firefox/firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide/)
- Google Privacy Sandbox: [Next steps (April 2025)](https://privacysandbox.google.com/blog/privacy-sandbox-next-steps), [Update on plans (October 2025)](https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies)
- Chrome for Developers: [Cookie Expires and Max-Age now have an upper limit](https://developer.chrome.com/blog/cookie-max-age-expires)
- MDN: [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies), [Third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies)
- ICO: [Cookies and similar technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/)
- Simo Ahava: [Prevent sGTM from setting the FPID cookie](https://www.simoahava.com/gtm-tips/prevent-sgtm-from-setting-fpid-cookie/)

## Related questions

### Is first-party tracking the same as server-side tracking?

They overlap, but they're not identical. Server-side tracking means a server you control receives events and forwards them to vendors. First-party tracking means the requests and cookies live on your own domain.

Most server-side GTM setups use a first-party subdomain, which is why the terms appear together. Read [server-side tracking explained](/blog/server-side-tracking-explained) for the full model.

### Is the GA4 _ga cookie first-party?

Yes. Google says `_ga` is a first-party cookie set by the GA4 JavaScript tag, with a default expiry of 2 years.

But it's written by JavaScript, so Safari caps it at 7 days, and the GA4 requests still go to Google's domains unless you route them through a server container.

### Do first-party cookies need consent?

Usually, yes. Consent rules apply to analytics and advertising cookies whether they're first- or third-party. Only strictly necessary cookies, like a shopping basket, are typically exempt.

Keep your consent banner and consent mode in charge of which tags fire.

### Should I use an A record or a CNAME for my tracking subdomain?

Use whatever your hosting provider tells you. Both work for HTTPS and server-set cookies.

Note that Safari may cap server-set cookies at 7 days when the subdomain resolves to third-party infrastructure, whichever record type you use.

### Can ad blockers block first-party tracking?

Some can. A first-party subdomain avoids many host-based rules, but tools that match paths, script names or behavior can still block it. Expect some visitors to stay unmeasured.

### Are Chrome third-party cookies going away?

Not on the old timeline. As of October 2026, Google has said Chrome will keep its current third-party cookie choice approach and has retired most Privacy Sandbox technologies.

Safari and Firefox still block or isolate third-party cookies by default, so first-party tracking remains worthwhile.

### How much does a first-party tracking setup cost?

Self-hosting needs a server, SSL and maintenance. Google's [Cloud Run setup guide](https://developers.google.com/tag-platform/tag-manager/server-side/cloud-run-setup-guide) estimates about $45 a month per server and recommends running at least two instances. Managed hosting bundles all of that.

Tagioo has a free plan with 15,000 events per 30 days and paid plans from $30 a month. See [pricing](/pricing) and our guide to [server-side tagging cost](/blog/server-side-tagging-cost).
