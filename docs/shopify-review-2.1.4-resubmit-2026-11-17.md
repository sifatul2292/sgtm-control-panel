# Shopify review 135263: 2.1.4 resubmission prep (resubmit on or after 2026-11-17)

Status on 2026-11-13: the app is paused until 2026-11-17 for requirement 2.1.4
("Synchronize data accurately"). 2.2.1 was accepted. The fixes for 2.1.4 are live on the VPS.
This file lists what is left before resubmitting, in order.

## What the reviewer hit (recap)

- On Nov 2 the reviewer's app-created workspace "Veil & Vow" (veil-vow, store
  6ybwxh-vs.myshopify.com) had no container. They typed review-track.tagioo.com and the
  review GA4 ID into Setup Assistant, probably copied from our testing notes. The app
  connected the store to those settings, so its 35 hits (6 purchases) went to the review
  workspace's container log. The reviewer's own Event Logs showed 0.
- Event Logs also lagged about a minute.

## Fixes already live

| Fix | Panel | App | Live |
| --- | --- | --- | --- |
| Only real containers whose domain is their own can connect (404 `no_container`, 409 `domain_mismatch`); the app warns "This store has no Tagioo container" | 788080a | ee51af7 | 2026-11-04 |
| Live Event Logs: new hits show within ~3 s | b3b0fe9 | | VPS dc5a5fd, 2026-11-04 |
| Uninstall or disconnect always frees the store's container | 0b69463 | 7021fe8 | VPS ee65c50, image release-7021fe8 |
| Event Logs label each request Browser or Server; one order from both shows "Browser + Server" | 563d085 | | VPS df9aede |

## New in this prep (2026-11-13, local, NOT deployed)

- **Custom Pixel consent.** The Setup Assistant's manual Shopify Custom Pixel used to call
  `gtag('consent','update',{... all 'granted'})`, which overrode the shopper's choice. It now
  sets the Google consent default from `init.customerPrivacy` and updates on
  `visitorConsentCollected`: `analyticsProcessingAllowed` gives `analytics_storage`, and
  `marketingAllowed` gives `ad_storage`, `ad_user_data` and `ad_personalization`.
  Test: `test/saas-templates.test.js` runs the generated pixel in a VM with an opted-out and an
  opted-in shopper.
- **Setup Assistant (Shopify).** "Connect the Tagioo Shopify app (recommended)" is now the
  first card. The manual card is now "Without the app: Shopify Custom Pixel", and the line
  "No App Store approval is required" is gone. A reviewer who opens Setup Assistant should not
  read it as being steered away from the app. Only `public/index.html` changed, so app.js keeps
  v=127.
- Verified: `npm run check` passes. The full suite is 241/244, with the same 3 old failures
  (Paddle activation and 2 WP plugin tests). A local panel on a fresh Shopify signup shows the
  app card first and the new manual copy.
- Deploy: `server.js`, `public/index.html` and `test/saas-templates.test.js`. This is a
  panel-only, tracking-safe change: generated template text and Setup Assistant copy. No
  restart is needed for index.html, but server.js needs `pm2 restart`.

## Owner checklist before resubmitting

1. **Deploy the change above** (needs your OK). Back up first, check out the 3 files from the
   branch on the VPS, run `node --check server.js`, then `pm2 restart sgtm-control-panel --update-env`.
2. **Free the review container.** Free plans allow 1 container, so the review workspace
   (`shopify-review@tagioo.com`, container review-track) must have **no store connected**
   when you resubmit. If you connected tagioo-test-store to it for the screencast, click
   **Disconnect** in the app there afterwards. Since 2026-11-04 an uninstall frees it too.
   If you would rather keep your own test store connected, the workspace needs a paid plan
   (Starter or Pro, changed through Shopify plan selection on a dev store at no charge) and a
   second container such as `review-store.tagioo.com`. That container needs a Cloudflare DNS
   record, must go live, and needs Setup Assistant run once.
3. **Plan copy in Managed Pricing** (Partner Dashboard → the app → Pricing). This is locked
   copy that has been deferred since 10-10:
   - "Brave bypass" → "First-party script loading (Custom Loader)"
   - "Dedicated support + SLA" → "Priority support"
   Do not claim to bypass ad blockers or offer an uptime SLA anywhere in the listing.
4. **Protected customer data request** (Partner Dashboard → API access → Protected customer
   data). The app reads these order fields (`app/tagioo.server.js` `sendOrderToTagioo`):
   - email, phone, first and last name
   - billing city, province, zip and country
   - browser IP, user agent, customer ID
   - order ID, total, currency, line items

   Purpose: the paid-order (`orders/paid`) conversion is sent to the merchant's own Tagioo
   container. GA4 receives no personal data. Meta Conversions API receives email, phone,
   name and location **SHA-256 hashed** for matching. Answer the security questions only
   with controls you have verified. For example, `history.json` encryption at rest is on
   only if `TAGIOO_DATA_ENCRYPTION_KEY` is set in the production `.env`, so check that
   before ticking it.
5. **Partner payouts.** You have to do this yourself (identity and bank details).
6. **Testing instructions.** Paste the text below.
7. **Screencast for "Proof of resolution"**, recorded on a fresh dev store:
   1. Install the app and click **Sign in to link that account** with the review account.
   2. Click **Connect** and wait for "Tracking is connected".
   3. Open Tagioo dashboard → Event Logs.
   4. Browse a product, add it to cart and check out with Bogus gateway. The events appear
      within seconds and the purchase shows "Browser + Server".
   5. Uninstall, then show that the container is free again.
8. **Resubmit on or after 2026-11-17.**

### Testing instructions (paste into the submission)

> The app connects your store to Tagioo with one click inside Shopify admin. There is no
> connection code, and you never need to type a tracking domain or Google Analytics ID.
>
> 1. Install and open the app. If it shows a workspace from an earlier review (for example
>    "Veil & Vow") or a red "This store has no Tagioo container" banner, click
>    **Disconnect**, then **Use a different Tagioo account**.
> 2. Click **Sign in to link that account** and sign in with the test account in the
>    credentials field. Return to the app tab. It updates by itself.
> 3. Click **Connect** next to the container listed. The app installs its web pixel (Admin
>    API `webPixelCreate`) and subscribes to the `orders/paid` webhook. The page shows
>    "Tracking is connected".
> 4. Click **Open Tagioo dashboard** and open **Event Logs**. In the storefront, view a
>    product, add it to the cart and place a test order. Each event appears in Event Logs
>    within a few seconds. The purchase arrives from the web pixel and from the `orders/paid`
>    webhook with the same Shopify order ID. It is labelled "Browser + Server" and counted
>    once.
> 5. **View or change Shopify plan** opens Shopify's plan selection (Managed Pricing).
>    Development stores are not charged.
> 6. Uninstalling the app removes the store connection and frees the container.
>
> A new merchant clicks **Create my free Tagioo workspace** instead and then adds a tracking
> container in the same page with their own Google Tag Manager server container. Until they
> do, the app shows that the store has no container and sends no events.

## Known risks not fixed in this prep

- The backend purchase (`orders/paid` → panel → Meta CAPI, hashed) does not check the
  shopper's storefront consent. This is fine where consent is not required. For EU/UK
  shoppers it is a GDPR question to decide before a US/EU launch.
- The panel's order forward falls back to `cu: "BDT"` when an order has no currency. Shopify
  orders always carry one, so this has no review impact; it is part of the US-defaults
  cleanup.
- Order ID match between pixel and webhook. The webhook strips `gid://shopify/Order/`
  (`app/shopify-order-id.js`). The released web pixel sends `checkout.order.id` as is. The
  2026-09-25 test order shared the numeric ID, but the app repo's local `main` has an
  uncommitted pixel edit that strips `gid://` too. **Check during the screencast:** the test
  order must show one Purchase row labelled "Browser + Server". If it shows two rows with
  different IDs, ship that pixel edit with `shopify app deploy` before resubmitting.
- Branches are still unmerged.
  - Panel: `fix/shopify-codeless-connect` reached production as file checkouts onto VPS
    `feat/saas-phase1-payments`.
  - App: `fix/shopify-codeless-connect` is cherry-picked on VPS main.
  - The app repo's local `main` has uncommitted edits, including stripping `gid://` from the
    pixel order ID.
  - Merge plan still to decide with the owner.
