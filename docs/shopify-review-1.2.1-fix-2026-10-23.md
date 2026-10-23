# Shopify review 135263 — requirement 1.2.1 fix (2026-10-23)

Shopify paused "Tagioo Server-Side Tracking" for 1.2.1 (off-platform billing).
Local fix only: nothing is deployed, committed or resubmitted.

## What the reviewer saw

Screencast `22-42-k7w6j-ziunx.mp4` (20 s):

1. tagioo.com panel, signed in to a **new** workspace (tenant `test`, Free,
   0 containers, cycle starting Oct 23). Not the prepared reviewer account.
2. Billing → Enterprise **Upgrade** → "Opening checkout…" → `/checkout`
   "Start your free trial" (Enterprise $100, invoice `test-INV001`).
3. "Start 3-day free trial" opened the **Paddle** overlay; the page also offered
   "Or pay with bKash / Nagad — ৳5,900".

Cause: a workspace became Shopify-billed only when the merchant chose Shopify in
Setup Assistant or generated a connection code. A merchant who installed the app,
signed up on tagioo.com and opened Billing first got Paddle and bKash/Nagad.

## Fix

Shopify App Pricing (Managed Pricing) stays the only way to charge these merchants.
Plans and prices are unchanged.

Panel (`server.js`, `shopify-billing.js`, `public/app.js`, `public/index.html` v=120):

- `GET /shopify/start?shop=<shop>.myshopify.com` is the entry from the embedded app.
  It sets `tg_shopify`, a cookie signed with the panel session HMAC that lasts 24 h,
  then opens signup, or login when `account=existing` is passed. If the merchant is
  already signed in, they get a confirmation page. The workspace only changes on
  `POST /shopify/start`, which needs the SameSite=Lax session cookie, so a
  cross-site POST cannot change a workspace.
- Signup with that cookie shows a Shopify note and ignores any `?plan=` value.
  The new account gets `shopifyBillingRequired: true`, `shopifyShop` and
  `signupPlatform: "shopify"`. Only the cookie can set a shop; a posted
  `shopifyShop` is ignored. The cookie is cleared after verification.
- Signup now has a required **Store platform** field (Shopify / WooCommerce /
  Custom / Other). Choosing Shopify sets the same flag, so a merchant who goes to
  tagioo.com directly still never sees Paddle or bKash/Nagad. Other platforms keep
  the current paid-plan checkout.
- Login with the cookie calls `adoptShopifyBilling`. It drops an unpaid staged
  invoice, which covers the reviewer's `test` account, flags the workspace and
  sends the merchant to Setup Assistant. A workspace with an external paid plan
  or a payment claim awaiting confirmation is refused, with an explanation.
- The Billing plan buttons open
  `admin.shopify.com/store/<store>/charges/tagioo-tracking/pricing_plans`. That
  link is available before the store is connected, because the shop comes from
  the handoff.
- The Free-tier 12K nudge and 15K cap emails link Shopify-billed workspaces to
  Shopify plan selection instead of `tagioo.com/#billing`.
- The existing guards still apply: `/checkout` redirects; plan, claim, add-on,
  Paddle and portal APIs return 409; billing omits the bKash/Nagad numbers.

Embedded app (`../tagioo-shopify-app`: `app/routes/app._index.jsx`,
`app/tagioo.server.js`, `app/billing.server.js`, `app/app-loader.test.js`):

- Before a store is connected, the app shows a 3-step guide, the **Create free
  Tagioo account** and **Sign in to Tagioo** buttons (both through
  `/shopify/start`), a "Billed through Shopify" banner and the **View or change
  Shopify plan** link.

## Part 2: create the workspace and sign in from inside Shopify

Owner decision (2026-10-23): **a workspace that includes any Shopify store is billed
by Shopify for all of its sites.** Prices are unchanged. A merchant with several stores
or websites keeps them in one workspace. They pay one Shopify plan, on any one store;
the highest active plan across connected stores applies.

How it works:

- **Shared secret.** `TAGIOO_SHOPIFY_APP_SECRET` (32+ random characters) is set to the
  same value on the panel and in the app. If it is missing or too short, both features
  below are off and the app falls back to the account links from part 1.
- **`POST /api/integrations/shopify/workspace`** (panel). The app signs each call the
  same way as the other integration calls (timestamp + HMAC, 5-minute window).
  - `intent: "status"` returns the workspace linked to the shop.
  - `intent: "create"` makes a Free, Shopify-billed workspace from the store's own
    details (Admin GraphQL `shop { name email contactEmail shopOwnerName billingAddress }`).
    The account gets a random password and `source: "shopify_app"`, and a welcome
    email explains Forgot password.
  - Calling create twice returns the existing workspace.
  - If the store email already belongs to a Tagioo account, the panel answers 409
    `account_exists`. The app then asks the merchant to sign in and link the account;
    it never takes the account over.
- **`GET /shopify/login?token=`** (panel). This is the one-click "Open Tagioo dashboard"
  sign-in.
  - The app signs `{shop, tenantId, nonce, exp}` itself. Links last 9 minutes; the
    panel accepts at most 10.
  - Each link works once: the panel keeps each nonce in memory until it expires. A
    second click from the same browser just opens the dashboard; from anywhere else
    it is refused.
  - The panel finds the store's workspace, sets the session cookie and opens `/`.
- **Several stores in one workspace.** A workspace now records every linked shop in
  `shopifyShops`. `findShopifyWorkspace` matches `shopifyShop`, `shopifyShops` and
  connected tracking entries, and prefers a store that is already connected. Linking a
  second store through "Sign in to link" keeps the first store as the plan link.
- **Embedded app screens:**
  - No workspace yet: **Create my free Tagioo workspace**, plus "Already use Tagioo
    for other websites? Sign in to link that account".
  - Workspace linked: the next steps and **Open Tagioo dashboard**.
  - Store connected: **Open Tagioo dashboard** sits next to the tracking status.
  - The connection-code field and "View or change Shopify plan" show on all of them.
  - After each click the app fetches a fresh dashboard link.

Access note: anyone who can open the Tagioo app in that store's Shopify admin can
sign into the workspace. Shopify staff permissions decide who that is.

Tests and checks:

- Panel: `test/shopify-app-workspace.test.js` (6 tests) covers the app's token format,
  tampering, expiry, store lookup, creation, the email clash and single use. The full
  suite passes 201 of 204; the 3 failures were already failing before this work.
- App: `app/tagioo-workspace.test.js` (4 tests). App totals: 15 of 15 tests, ESLint on
  `app/`, build and `tsc` all pass.
- Local run: the panel on port 3107 with a test secret, driven by the app's real
  `tagioo.server.js` functions.
  - status is unlinked, create makes the workspace, a second create returns the same
    one, and status is then linked.
  - The same email on another store gets 409 `account_exists`. A wrong secret gets 401.
  - The one-click link signs in as the app-made workspace: Billing says Shopify, no
    payment numbers, and all 3 Upgrade buttons open Shopify plan selection.
  - Reusing the link with no session gets 400 "already used"; a tampered token gets
    400; an unsigned API call gets 401.
  - A second store linked through the confirm page ends up in the same workspace.
- Not checked: the embedded UI inside a real Shopify admin. That needs the deployed
  app or a separate development app.

## Verification (local)

- `npm run check` passes. 195 of 198 `node --test` tests pass. The 3 failures
  also fail without this change: `paddle-billing.test.js` activation and 2 tests in
  `woocommerce-plugin-events.test.js`. The new `test/shopify-signup-billing.test.js`
  passes 9 of 9.
- Shopify app: `node --test app/*.test.js` passes 11 of 11. ESLint, `react-router build`
  and `tsc --noEmit` pass on Node 22.
- Isolated local panel on port 3107 with a fresh data directory and no secrets:
  - Handoff signup with `?plan=Enterprise` lands on the dashboard, not `/checkout`.
  - All three Upgrade buttons point at Shopify plan selection.
  - The page has no Paddle, bKash or Nagad text.
  - Plan and claim APIs return 409.
  - A direct "Shopify" signup skips checkout. A WooCommerce paid signup still
    reaches `/checkout` (200).
  - Handoff login on an account with a staged Pro invoice moves it to Free and
    Shopify billing, then opens Setup Assistant.
  - The signed-in confirm-and-POST flow sets the plan URL.
  - A POST without a session redirects to `/login`.

## Other requirements likely to fail review

| Requirement | Risk | Action |
| --- | --- | --- |
| 2.2.2 embedded experience | Medium (was medium-high) | Part 2 moves account creation and sign-in into the app. Container and GTM setup still happen in the Tagioo dashboard. Next step: create the container and connect it from inside the app, without a code. |
| 4.5.4 / 4.5.5 test credentials | High (the reviewer ignored them) | In the testing instructions, start from the in-app **Sign in to Tagioo** button with shopify-review@tagioo.com. Confirm that workspace is still Shopify-billed and has its prepared container. |
| 4.2.1 / 4.4.2 listing and plan claims | Medium | Shopify plan copy still says "Brave bypass" and "dedicated support + SLA" (deferred since 10-10). The submission is paused, so it can be edited now. Make the panel plan cards (Live Chat/Call/Meet, Video & Files, Dedicated Support, Bot Detection) match the Shopify plan descriptions and the trial terms. |
| 4.5.3 screencast | Medium | Re-record: install → Create free Tagioo account → container → connection code → connect → Billing → Upgrade opens Shopify plan selection. |
| Production tenant `test` | Medium | The reviewer's account probably still has a staged Enterprise invoice, so a direct login at tagioo.com/login would show `/checkout` again. A login through the app button fixes it. Optionally flag it on the VPS, with the owner's approval. |
| tagioo.com/shopify ad page | Low-medium | It says "Shopify app coming soon" and sells Paddle 3-day trials to Shopify stores. Signup now routes Shopify stores to Shopify billing, so the page copy is out of date. Marketing decision for the owner. |
| `app/routes/app.additional.jsx` | Low | Leftover template page at /app/additional. Delete it. |
| Paddle tenant picking Shopify in Setup Assistant | Low, already present | `requiresShopifyBilling` then blocks the Paddle portal while Paddle keeps billing. There are no such tenants today. |

Billing choice: keep **Shopify Managed Pricing**. It is Shopify's default for new
public apps and hosts the plan page. Upgrades, downgrades, proration, trials and
re-approval on reinstall are handled by Shopify, which covers 1.2.2 and 1.2.3. It
fits flat monthly tiers. It is already integrated: the plan-handle return plus
Partner API `activeSubscription` polling, because Managed Pricing sends no
webhooks after 2026-04-28. The Billing API (Manual Pricing) is legacy and would
need its own plan page and approval flow. The two can't be mixed after opting in.
Limits: USD only and no one-time charges, neither of which Tagioo needs.

## Deploy (needs owner OK)

1. Generate the shared secret on the VPS with `openssl rand -hex 32`. Put it in the
   panel `.env` and in the app's container env as `TAGIOO_SHOPIFY_APP_SECRET`. Keep it
   out of chat and git.
2. Panel: on the VPS, check out `server.js`, `shopify-billing.js`,
   `shopify-workspace.js`, `public/app.js`, `public/index.html` and `.env.example`.
   Run `npm run check`, then
   `node --test test/shopify-signup-billing.test.js test/shopify-app-workspace.test.js test/shopify-payment-boundary.test.js test/signup-transaction.test.js shopify-billing.test.js`,
   then `pm2 restart sgtm-control-panel`. This touches the panel only: no nginx,
   containers or `/g/collect`. Purge Cloudflare for `/app.js`.
3. Shopify app: rebuild the Docker image with `app/routes/app._index.jsx`,
   `app/tagioo.server.js`, `app/billing.server.js` and the tests, then restart it with
   the new env value. Do **not** include the separate uncommitted
   `extensions/tagioo-web-pixel/src/index.js` edit or run `shopify app deploy` for it.
4. Deploy the panel before the app, so `/shopify/start`, `/shopify/login` and the
   workspace API exist when the buttons appear.
5. Live check on the review development store:
   - Open the app and click Create my free Tagioo workspace.
   - Open the Tagioo dashboard and add a container, then connect it with a code.
   - In Billing, Upgrade should open Shopify plan selection.
   - Reuse an old dashboard link; it should be refused.

## Deployed 2026-10-23 (owner approved; not resubmitted)

Deployed through the Hostinger web terminal on srv1736566.

- **Backups:** `/var/backups/tagioo-review-135263-billing-20261023085*`, mode 700, path
  recorded in `/root/.tagioo-135263-backup-dir`. It holds:
  - the previous panel code
  - the previous panel `.env`, mode 600
  - a copy of the app's SQLite database
- **Secret:** generated on the VPS with `openssl rand -hex 32` and never displayed.
  It was appended to `/var/www/tagioo/.env` and written to
  `/etc/tagioo-shopify-app/panel-link.env`, mode 600. Both copies are 64
  characters and identical, checked by comparing sha256 hashes.
- **Panel:**
  - Files checked out from `origin/feat/us-launch` at 78c7b03 and committed on the
    VPS branch as `bb6b3da`. The follow-up 0b97f7f is VPS commit
    `deploy: hide manual invoices…`.
  - `npm run check` passed, and 28 of 28 focused tests passed (20 of 20 after the
    follow-up).
  - After `pm2 restart sgtm-control-panel`: online, `/login` 200, `/shopify/login`
    with no token 400, unsigned workspace API 401 (so the secret is loaded).
- **Shopify app:**
  - d9fa904 pushed to GitHub `main` together with the 4 earlier local commits,
    which were already live under different SHAs. On the VPS it was cherry-picked
    as `a507de0`; the files match origin.
  - Image `tagioo-shopify-app:release-d9fa904` built with exit 0; 15 of 15 tests
    pass inside the image.
  - Canary on port 3201 with an empty database and billing sync off: `/` 200,
    `/auth/login` 200. A signed status call to `https://tagioo.com` returned 200,
    so the secret works end to end through Cloudflare.
  - Production swap: the old container was stopped and kept as
    `tagioo-shopify-app-before-d9fa904`. The new container runs with the same
    port, mount and restart policy, using env file
    `/etc/tagioo-shopify-app/runtime-d9fa904.env` (the old env plus the secret,
    mode 600). Local and public `/`, `/auth/login` and `/app` give
    200 / 200 / 410, the same as before.
- **Live check on tagioo-test-store** (connected to Shopify Review Workspace, Pro):
  - The embedded app shows **Open Tagioo dashboard**. It signed in to the Pro
    workspace, billed by Shopify with no payment numbers; `app.js` v=121 is live.
  - Billing shows only Shopify plan buttons, and Upgrade opened Shopify's own
    Select a plan page. No plan was changed.
  - A link minted in the container worked once: first use 302, reuse 400
    "already used", tampered 400.
- **Found live and fixed (0b97f7f):** Billing → Invoices still listed an old
  rejected bKash invoice (৳2,900). Shopify-billed workspaces no longer receive
  manual payment records. The page now says charges appear in Shopify admin, and
  it has no ৳, bKash, Nagad or Paddle text.
- **Not exercised live:** "Create my free Tagioo workspace". The review store is
  already connected, so testing it would mean disconnecting the reviewer setup.
  The production canary's signed status call for an unknown shop answered
  `{"linked":false}`, and create was covered by the local end-to-end run.
- **Rollback:**
  - App: `docker stop tagioo-shopify-app && docker rename tagioo-shopify-app tagioo-shopify-app-failed-d9fa904 && docker rename tagioo-shopify-app-before-d9fa904 tagioo-shopify-app && docker start tagioo-shopify-app`.
  - Panel: `git revert` the two VPS deploy commits, then restart pm2.
  - The secret can stay in place; it is unused by old code.
- **After the deploy:** this Chrome was signed out of tagioo.com. The owner needs to
  sign in again there.

## Resubmission note for the Partner Dashboard

> Fixed 1.2.1. Merchants who install Tagioo from Shopify are billed only through
> Shopify App Pricing. The app creates the merchant's Tagioo workspace from inside
> Shopify admin ("Create my free Tagioo workspace") and opens it with one click
> ("Open Tagioo dashboard"); there is no separate sign-up and no card form. Every
> workspace that includes a Shopify store is marked Shopify-billed for all its sites.
> Its Billing page and plan-limit emails link only to the app's plan selection in
> Shopify admin, and Tagioo's external checkout and payment endpoints refuse these
> workspaces.
>
> To test: install the app → Create my free Tagioo workspace → Open Tagioo dashboard
> → Billing → Upgrade (opens Shopify plan selection). The prepared reviewer account
> is still available through "Sign in to link that account".
