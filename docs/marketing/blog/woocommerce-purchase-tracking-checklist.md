# WooCommerce orders missing from your ads? Start with this checklist

Before you reinstall a plugin or change your ad budget, pick one order that’s missing from the report. Find its order number, time and value. You’ll use those details to follow the purchase from WooCommerce to your tracking server and then to the ad platform.

This checklist uses Tagioo's documented WooCommerce plugin, incoming events and purchase inspection workflow. It is a diagnostic method, not a promise that every order should appear as an attributed ad conversion.

## Define the order you will follow

Use a permitted test purchase or another order your team can inspect. Write down its reference, completion time, currency and expected purchase value. Decide which order state your integration treats as a purchase. An unpaid order and a completed sale should not become interchangeable merely because both have an order number.

Do not place real personal details into a shared test worksheet. You need enough information to correlate the event, not a customer's complete profile.

## Inventory the existing senders

List the tracking plugins, GTM purchase tags, direct pixels and backend integrations currently installed. Identify the owner of each purchase path. If two plugins and a custom tag all react to checkout completion, adding a fourth sender is unlikely to make the picture clearer.

The Tagioo WooCommerce plugin supplies ecommerce data for the supported tracking flow. Use it with the generated GTM configuration rather than assuming it should be layered on top of every existing implementation unchanged.

## Check the browser event

In the Web GTM preview, follow the action that completes your test order. Inspect the purchase event's reference, value and currency. Confirm that the tag responds to the intended event and does not reuse data from an earlier cart action.

Refreshing a confirmation page is a useful check. It should not create a new business purchase. If another request appears, inspect how the implementation keeps the original order identity stable.

## Check Tagioo's incoming purchase view

Find the same order in Purchase Inspector. Use its transaction reference rather than the amount alone: two customers can place different orders for the same value within the same minute.

Inspect the request details and resend count where available. A repeated request for an identified transaction can be a retry, not another sale. Conversely, two distinct order references should not be collapsed just because their amounts match.

If the order is absent, check the selected container and domain before changing tags. Then work backwards to the website or backend sender. If it is present, continue forwards to the server-container tags and destination diagnostics.

## Validate purchase data and destination receipt

Check whether value and currency match the reporting definition your team chose. Record whether that value includes shipping or tax so later comparisons use the same basis. Google's [GA4 ecommerce guidance](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce) describes the purchase payload and transaction identifier; use current destination documentation when configuring its fields.

A successful incoming request is one checkpoint. It does not prove acceptance or ad attribution. Confirm the destination behavior separately and examine any validation errors.

## Keep a repeatable record

Save a small result sheet: order reference, expected value, observed incoming request, destination result and remaining issue. Repeat the test after changes to checkout, plugins or payment behavior. This turns tracking verification into a reproducible check rather than a reassuring screenshot.

For overlapping browser and server purchase paths, continue with [Meta deduplication checks](/blog/meta-capi-deduplication-checklist). To start the supported integration, use [Tagioo's setup guide](/how-it-works).
