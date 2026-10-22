=== Tagioo for WooCommerce ===
Contributors: sifatul92
Tags: woocommerce, server-side tracking, google tag manager, ga4, conversions api
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 2.7.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Server-side tracking for WooCommerce: GTM, GA4 ecommerce dataLayer events and a server-side purchase hit to your server-side GTM container.

== Description ==

Tagioo for WooCommerce connects your store to Google Tag Manager and to a server-side Google Tag Manager (sGTM) container, so purchases are still recorded when a browser pixel is blocked or the shopper closes the tab.

**What it does**

* Adds the Google Tag Manager snippet to your store (optional — turn it off if you already load GTM).
* Pushes GA4 ecommerce events to the dataLayer: `view_item`, `view_item_list`, `search`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info` and `purchase`. Works with the classic shortcode checkout and the Cart and Checkout Blocks.
* Sends a server-side GA4 purchase hit to your sGTM container when an order is paid (or reaches Processing for cash on delivery and bank transfer). The hit runs in the background with retries, so a slow server never blocks checkout.
* Adds a shared `event_id` to browser and server events so Meta and TikTok can deduplicate them.
* Stores the Meta `_fbp` / `_fbc` identifiers as first-party cookies and saves them on the order for better conversion matching.
* Optional cookie consent: a built-in Accept / Reject banner wired to Google Consent Mode v2, or read the choice from CookieYes, Complianz, Cookiebot, OneTrust or the WP Consent API.
* Optional Custom Loader: load `gtm.js` through your own sGTM domain instead of googletagmanager.com.
* Compatible with WooCommerce High-Performance Order Storage (HPOS).

**What you need**

* A Google Tag Manager web container.
* A server-side GTM container on your own domain (for the server-side purchase hit). You can host it yourself or use [Tagioo](https://tagioo.com).
* A GA4 Measurement ID and Measurement Protocol API secret.

All features in the plugin are free. The plugin does not lock any feature behind a licence or account.

== External services ==

This plugin connects to the following services. Nothing is sent until you enter the matching setting on WooCommerce → Tagioo.

= Google Tag Manager =

When a GTM Container ID is set and "Inject GTM snippet" is on, every front-end page loads `https://www.googletagmanager.com/gtm.js` (and the `ns.html` noscript iframe) from Google. Google receives the visitor's IP address, user agent and the page URL, and the tags you configure inside GTM decide what else is sent. If cookie consent is set to "Wait for consent", GTM loads only after the visitor accepts.
Google Terms of Service: https://policies.google.com/terms
Google Privacy Policy: https://policies.google.com/privacy

= Your server-side GTM container (sGTM domain) =

When an sGTM domain, GA4 Measurement ID and API secret are set and "Server-side purchase hit" is on, the plugin sends one request per paid order from your server to `<your sGTM domain>/g/collect`. The request contains the order number and ID, total, tax, shipping, currency, coupon codes, line items, and the customer's billing email, phone, first and last name, city, state, postcode and country, customer ID, IP address, user agent, Meta `_fbp`/`_fbc` values and (when consent is enabled) the shopper's marketing consent. Your sGTM container then forwards this data to the destinations you configure there, such as Google Analytics 4, the Meta Conversions API or the TikTok Events API.
The sGTM domain is chosen by you. If it is hosted by Tagioo, the Tagioo terms and privacy policy apply:
Tagioo Terms: https://tagioo.com/terms
Tagioo Privacy Policy: https://tagioo.com/privacy

= Custom Loader =

When "Custom Loader" is on, `gtm.js` and `ns.html` are loaded from `<your sGTM domain>/tagioo-loader/` instead of googletagmanager.com. The request goes to your sGTM domain, which passes it on to Google Tag Manager. The same Google and Tagioo terms above apply.

= Destinations configured in your containers =

Data forwarded by your GTM or sGTM containers is governed by those services' own terms, for example:
Meta: https://www.facebook.com/legal/terms and https://www.facebook.com/privacy/policy
TikTok: https://ads.tiktok.com/i18n/official/policy/terms and https://www.tiktok.com/legal/privacy-policy

== Privacy ==

The plugin sets these cookies on the store's own domain:

* `_fbp`, `_fbc` — Meta browser and click identifiers (90 days). With the Tagioo consent banner they are only set after the shopper accepts.
* `tagioo_consent` — the shopper's choice in the Tagioo consent banner (180 days).
* `tagioo_q` — a short-lived flag (10 minutes) that tells the page an add/remove-to-cart event is waiting to be sent.

It saves the shopper's `_fbp`, `_fbc`, IP address, user agent and consent choice as order meta so the server-side purchase hit can send them later.

You are responsible for telling shoppers about this tracking in your privacy policy and for choosing the cookie consent option your store needs.

== Installation ==

1. Install and activate WooCommerce.
2. Upload the plugin through Plugins → Add New, or search for "Tagioo for WooCommerce", then activate it.
3. Go to WooCommerce → Tagioo.
4. Enter your GTM Container ID.
5. For the server-side purchase hit, enter your sGTM domain, GA4 Measurement ID and GA4 API secret.
6. Choose the events you want, set cookie consent if your store needs it, and save.

If you already load GTM with another plugin or your theme, untick "Inject GTM snippet" so it does not load twice.

== Frequently Asked Questions ==

= Do I need a Tagioo account? =

No. The plugin works with any server-side GTM container you control. Tagioo is one way to host one.

= Will purchases be counted twice? =

No. The browser purchase event and the server-side hit share the same `event_id` (the WooCommerce order ID), and GA4 deduplicates by `transaction_id`.

= Does it work with the Checkout Block? =

Yes. Events fire on both the classic shortcode checkout and the Cart and Checkout Blocks.

= Can I change or skip the server-side hit? =

Yes. Use the `tagioo_server_purchase_params` filter. Return modified parameters, or `false` to skip the hit for an order.

= Where do I see errors from the server-side hit? =

Failed attempts are retried up to five times and logged in WooCommerce → Status → Logs under the source `tagioo`.

== Changelog ==

= 2.7.0 =
* Inline scripts and styles now use the WordPress script and style APIs.
* Escaping and input sanitizing hardened throughout.
* Phone numbers sent for ad matching now get the right country code for every country (WooCommerce's calling-code table), including Bangladesh (+880), North America and the Caribbean (+1), Russia and Kazakhstan (+7) and Italian landlines. The store's base country is used when an order has no billing country.
* Server-side hit errors now go to WooCommerce → Status → Logs.

= 2.6.0 =
* Optional cookie consent: Tagioo banner with Google Consent Mode v2, or read an existing banner plugin.
* Optional "wait for consent" GTM loading.

= 2.5.0 =
* Added `view_item_list`, `search`, `view_cart`, `remove_from_cart`, `add_shipping_info` and `add_payment_info` events.

== Upgrade Notice ==

= 2.7.0 =
Security hardening and a fix for Bangladesh phone numbers sent to Meta.
