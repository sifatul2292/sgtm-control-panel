# Shopify review 135263 — requirement 2.2.1 fix (2026-10-26)

Shopify flagged "Tagioo Server-Side Tracking" under **2.2.1 Use Shopify APIs**:

> During installation, we observed that the app requires a connection code generated in
> the external Tagioo dashboard, and the store connection remains incomplete without it.
> The app displays "Could not connect" and "Enter the connection code from Tagioo."

Status: **built locally, not committed, not deployed, not resubmitted.**
Branch `fix/shopify-codeless-connect` in two worktrees made from the deployed code, so the
uncommitted grace-period work in the main checkouts stays separate:

- Panel: `.claude/worktrees/shopify-codeless` (base 49698ef)
- App: `.claude/worktrees/shopify-app-codeless` (base 956abaa)

## What the reviewer hit

They installed the app and created a workspace in it. The app then asked them to add a
container in the Tagioo dashboard, generate a code in Setup Assistant and paste it back.
They pressed **Connect Tagioo** with the field empty, and `app._index.jsx` answered
"Enter the connection code from Tagioo." in a "Could not connect" banner. The store never
connected, so no app pixel and no paid-order webhook were installed. From the reviewer's
side the app did nothing with Shopify's APIs.

## Fix

### A. No connection code

- The panel's signed app endpoint `POST /api/integrations/shopify/workspace` has new intents
  (same timestamp + HMAC signature as before):
  - `status` now also returns the workspace's `containers` (id, name, tracking domain, GA4
    ID, launch status, `connectedShop`, `connectable`) and `dnsTarget`.
  - `connect` `{ shop, tenantId, containerId }` connects the store to that container and
    returns the tracking settings for the app pixel.
- The redeem logic was moved into `connectShopifyContainerLocked()`, which the old code path
  and the new one share. The guards are unchanged: one store per container (409
  `container_in_use`), no workspace with a plan billed outside Shopify, and privacy-route
  retention.
- The app lists the containers. Each usable one has a **Connect** button; one in use shows
  "Used by <store>". The code field, `redeemConnectionCode` and every mention of a code are
  gone from the app.
- Panel Setup Assistant: the "Generate connection code" card now says to open the app in
  Shopify admin and click Connect. The click handler was removed. app.js `?v=124`; v=123 is
  taken by the uncommitted grace work.
- Kept for older app builds during deploy: `POST /api/customer/shopify/connect-code` and
  `POST /api/integrations/shopify/connect`. Nothing in the UI uses them now; remove them once
  the new app is live.

### B. Container setup inside Shopify admin

- When no container is usable (or after **Add a new container for this store instead**), the
  app shows a form with these fields: tracking subdomain, GTM server Container Config, GA4
  Measurement ID, and optionally Meta Pixel ID and Conversions API token. The website and
  store name come from the Admin API (`shop.name`, `shop.primaryDomain`).
- The `create-container` intent validates the GA4 ID and the Meta pair, then runs the normal
  `addCustomerSetupRequest` (plan container limit, worker, auto-launch) as the workspace's
  customer with `platform: "shopify"`. It saves GA4 and Meta with `saveTenantTrackingConfig`
  and connects the store in the same call. When the plan's limit is reached, the merchant is
  told to choose a larger plan in Shopify; the ৳ add-on message is not shown.
- After connecting, a **Finish setup** section loads once the page is open, so opening the
  app never waits for Tagioo. It has two parts:
  1. **Tracking domain.** It shows the launch status. For `dns_pending` it shows the CNAME
     record (`<subdomain>` → `PROVISION_DNS_TARGET`) and a **Check DNS** button. The
     `check-dns` intent reruns the normal launch, but only for `dns_pending` and at most once
     a minute per container.
  2. **Server container template.** The `server-template` intent builds GA4, plus Meta when
     its pixel and token are saved, with the same `buildSetupAssistantTemplates` used by the
     dashboard. The app saves it as a .json download for GTM's Import container.

### C. Security: only proven store links can connect

Removing the code exposed a hole that already existed. The app's **Create account** and
**Sign in** links were `/shopify/start?shop=<store>`, which is unsigned. Anyone could open
that URL with any store's domain, sign in to their own workspace, and have that store
recorded on it. With one-click connect, a merchant who later installed the app would see that
workspace and could connect their store into a stranger's container. Their customer events
and paid-order data would then reach the stranger. The one-click dashboard button would also
have opened the stranger's workspace.

- The app now signs its account links: `/shopify/start?token=…`, with `purpose: "start"`,
  valid for 50 minutes, refreshed on every page load.
- `verifyShopifyAppToken` takes a `purpose`, so an account link can never act as a one-click
  sign-in link and the reverse.
- The handoff cookie records whether the link was signed (`:app` mark, covered by the
  session HMAC). Only a signed handoff adds the store to `tenant.shopifyAppShops`, whether
  through signup, login or the signed-in confirm page.
- `findShopifyWorkspace` (used by status, connect, one-click sign-in and workspace creation)
  now uses `verifiedShopifyShops`. That covers `shopifyAppShops`, a workspace the app created
  (`source: "shopify_app"`), and any store already connected with a code. A bare `?shop=`
  link still sets Shopify billing but never links the store.
- Effect on existing data: a workspace linked only through an old unsigned link shows as not
  linked until the merchant clicks **Sign in to link that account** once more in the new app.
  App-created and code-connected workspaces are unaffected.

## Other review risks fixed in the same branch (2026-10-26)

- **App name is now the same everywhere.** Shopify admin showed "Tagioo Tracking" while the
  listing says "Tagioo Server-Side Tracking". `shopify.app.toml` `name`, the app page heading,
  the public app landing (`connect.tagioo.com`), the login notice, the README and
  `docs/APP_STORE_SUBMISSION.md` now all say **Tagioo Server-Side Tracking**. The handle stays
  `tagioo-tracking`, so plan-selection URLs don't change. The new name reaches Shopify with
  `shopify app deploy`.
- **App landing page.** The public app landing page told visitors to "enter the one-time
  connection code generated by Tagioo". It now describes one-click connect and Shopify
  billing.
- **Leftover template page removed.** `app/routes/app.additional.jsx` ("Additional page",
  placeholder text from Shopify's template) is deleted.
- **tagioo.com/shopify rewritten for the app and Shopify billing.**
  - Before: it sold a Paddle 3-day trial with a card to Shopify stores, said "Shopify app coming
    soon", recommended the manual Custom Pixel and linked to BDT/bKash pricing.
  - Now every call to action is **Install the Shopify app**. The setup steps follow the in-app
    flow, and pricing says plans are chosen in the app and billed through Shopify.
  - The FAQ (visible and JSON-LD) now covers Shopify billing, what you need before starting,
    and consent through the app pixel. The footer no longer links to BDT pricing (WhatsApp
    stays BD-only). The Custom Pixel video and docs link were taken out of this page.
  - New test: `test/shopify-payment-boundary.test.js` checks that the page has no signup,
    checkout, trial, bKash or "coming soon" text and links to apps.shopify.com, for both
    regions.
  - Install link: `https://apps.shopify.com/search?q=tagioo`. It works before and after approval;
    swap in the direct listing URL once the app is public.
  - Prices kept at $30 / $50 / $100 because the 10-23 notes say "prices unchanged". **Check them
    against the Managed Pricing plans before deploying.**
  - Checked in the browser at desktop and phone width: the setup card, pricing and FAQ render,
    and there is no horizontal scroll.
- **`/docs#shopify` rewritten (2026-10-27).**
  - It now follows the app flow: install, create or link a workspace, add a container in the app,
    CNAME and Check DNS, download and import the server template, then test.
  - It also has "What the app sends" (the pixel events plus the `orders/paid` backend Purchase),
    "Plans and billing" (through Shopify, never a card) and a consent note.
  - Removed: the Custom Pixel steps, "coming soon" and the Shopify video. The only remaining
    Custom Pixel mention tells merchants to remove an old one so purchases aren't counted twice.
  - The "Getting Started" list now names the Tagioo Shopify app.
  - A test guards the section. Checked in the browser.
- **Still showing the old Shopify story:**
  - the Shopify setup video (no longer embedded on /shopify or /docs);
  - the blog post `public/blog/shopify-server-side-tracking.html`, which is uncommitted in the
    main checkout;
  - the dashboard Setup Assistant, which still offers the manual Shopify Custom Pixel card next to
    the app card.

- **Still owner-only:**
  - the protected customer data request in the Partner Dashboard;
  - the listing and plan text ("Brave bypass", "dedicated support + SLA");
  - checking that the plan names and prices match;
  - flagging the reviewer's `test` workspace as Shopify-billed on the VPS;
  - the spare reviewer container and the screencast.

## Files

Panel: `server.js`, `shopify-workspace.js`, `shopify-billing.js`, `public/index.html`,
`public/app.js`, `public/shopify.html`. Tests: new `test/shopify-app-connect.test.js` (10). Updated:
`test/shopify-app-workspace.test.js`, `test/shopify-container-per-store.test.js`,
`test/shopify-signup-billing.test.js`.

App: `app/tagioo.server.js`, `app/routes/app._index.jsx`, `shopify.app.toml`,
`app/routes/_index/route.jsx`, `app/routes/auth.login/route.jsx`, `README.md`,
`docs/APP_STORE_SUBMISSION.md`; `app/routes/app.additional.jsx` deleted. Tests: new `app/app-connect.test.js`
(3). Updated: `app/tagioo-workspace.test.js` (+3).

## Verification (2026-10-26)

- Panel: `npm run check` clean. Full suite 212/215 (after the /shopify and docs tests); the 3 failures are the same ones that
  already failed before (Paddle activation, 2 WP plugin).
- App: 22/22 tests, lint, typecheck and build all pass.
- End to end: a local panel from the worktree was driven by the app's real client functions,
  with auto-launch off and a throwaway data dir. All 16 checks passed:
  - workspace created in the app;
  - container created and connected in one call;
  - status lists the container as connected;
  - server template includes GA4 and Meta;
  - Check DNS ignores a container that is not DNS-pending;
  - the same store reconnects;
  - a store linked through a bare `?shop=` link can neither see nor connect into that
    workspace, and its dashboard button returns 404;
  - a signed Sign-in link does link the store;
  - a signed account link used as a sign-in link returns 400;
  - a tampered account link returns 400;
  - an unsigned connect call returns 401.
- Panel UI: the Setup Assistant Shopify card shows the new text, app.js v=124, no console
  errors.
- **Not checked:** the embedded UI inside a real Shopify admin (layout, form submission of
  `s-text-area` and `s-password-field`, and whether the admin iframe allows the template
  download). A real Docker launch and DNS check was not run either (auto-launch was off).
  Test both on a dev store and a throwaway container before resubmitting.

## Deploy (needs owner OK; panel first, then the app image)

1. Panel: merge or cherry-pick `fix/shopify-codeless-connect`, deploy, then `pm2 restart`.
   It needs `TAGIOO_SHOPIFY_APP_SECRET`, which is already set, and `PROVISION_DNS_TARGET` for
   the CNAME text.
2. App: build and deploy the image from `fix/shopify-codeless-connect`. Keep the old
   container stopped for rollback, as in earlier releases.
3. The grace work, uncommitted in both main checkouts, will conflict in `app._index.jsx`,
   `tagioo.server.js`, the workspace endpoint and the `?v=` bump. Rebase it on top
   afterwards and bump app.js past 124.

## Reviewer path (owner steps before resubmitting)

The reviewer installs on their own dev store, and each store needs its own container. The
review workspace (`shopify-review@tagioo.com`) therefore needs one ready container that no
store is connected to:

1. Finish the production repair still open from 2026-10-23: disconnect app-test-joygfim7 and
   check that tagioo-test-store is back on review-track with the Pro plan synced.
2. In the review workspace, add a second container for the reviewer, for example
   `review-store.tagioo.com`. It can reuse the same GTM server Container Config. Add a
   Cloudflare DNS record pointing to the VPS, let it go live, and run Setup Assistant once so
   it has a domain and a GA4 ID. Pro allows 3 containers.
3. Check that the workspace is still Shopify-billed and that the reviewer password works.

### Testing instructions (paste into the submission)

> The app connects your store to Tagioo with one click inside Shopify admin. There is no
> connection code.
>
> 1. Install the app. On the Tagioo Tracking page, click **Sign in to link that account**
>    and sign in with the test account in the credentials field
>    (shopify-review@tagioo.com). Return to the app tab; it updates by itself.
> 2. The app lists the workspace's tracking containers. Click **Connect** next to
>    **review-store**. The app installs its web pixel (Admin API `webPixelCreate`) and
>    starts sending paid orders from the `orders/paid` webhook. The page shows "Tracking is
>    connected".
> 3. Plans: **View or change Shopify plan** opens Shopify's plan selection (Managed Pricing).
>
> A merchant without a Tagioo account clicks **Create my free Tagioo workspace** instead.
> The workspace is created from the store's details (Admin API `shop`). The merchant then
> adds their tracking container in the same page, using their Google Tag Manager server
> container settings and GA4 ID, and the store connects at once.

### Screencast for "Proof of resolution"

Record on a fresh dev store:

1. install;
2. **Sign in to link that account** with the reviewer account;
3. the container list → **Connect** → "Tracking is connected" and Finish setup;
4. briefly, **Create my free Tagioo workspace** on a second store, showing the in-app
   container form with no code anywhere;
5. **View or change Shopify plan**.

Upload it as an unlisted video or a public Drive or Loom link, paste the URL into **Proof of
resolution** on the 2.2.1 item, and click **Mark resolved**. The reply is due within 14 days
of the email (2026-10-26).
