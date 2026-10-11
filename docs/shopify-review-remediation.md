# Shopify review 135263 — billing and test access

Updated 2026-10-09 for Tagioo Server-Side Tracking. Billing prevention is deployed;
review submitted at owner request; delayed privacy-routing fix deployed. Broader checks remain open.

## Billing correction

Shopify hosting, event capacity and containers must all be charged through
Shopify App Pricing. The existing integration offers Free, Starter ($30/month),
Pro ($50/month) and Enterprise ($100/month). Extra containers are obtained through
the included capacity of a Shopify plan; the manual extra-container add-on is
unavailable for Shopify workspaces.

The panel now reserves Shopify workspaces before billing synchronization, blocks
manual plan selection and payment claims, manual add-ons and owner confirmation,
and blocks Paddle checkout, activation, plan changes and portal access. Billing
responses omit manual transfer numbers and the panel explains Shopify billing.
A redeemed connection retains this billing restriction after disconnection.
Connecting an externally paid workspace is refused: cancel the external
subscription and finish moving to Free, or use a separate Free workspace.
No existing subscription is automatically canceled or migrated by this patch.

Reference: [Shopify requirement 1.2.1](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements#use-shopify-app-pricing-or-the-shopify-billing-api).

## Reviewer testing instructions

Paste these instructions into the Partner Dashboard only after verifying the
account and replacing the password placeholder in Shopify's private credentials
field. Never commit the password. These are prepared instructions, not evidence
that the login or production release is working.

- Login URL: https://tagioo.com/login
- Account email: shopify-review@tagioo.com
- Password: supply the verified reviewer password in the private credentials field.
- Use a dedicated Free reviewer workspace with a prepared tracking container,
  tracking domain and test GA4 destination. No external payment is required.

1. Install/open Tagioo in Shopify Admin on the review development store.
2. Sign in to the Tagioo reviewer account above. Open Setup Assistant and select
   the prepared reviewer container. Choose Shopify and generate a connection code.
3. Paste that code into the embedded Shopify app and connect the store. If a
   manual Custom Pixel was previously installed for this store, disable it before
   testing the app pixel to avoid duplicate events.
4. Open View or change Shopify plan in Shopify Admin. Test Free → Starter → Free
   using Shopify's development-store test approval. Decline a paid approval and
   confirm no paid entitlement is granted. No bKash, Nagad or Paddle payment is needed.
5. Open the Tagioo Billing view and verify all paid plan actions lead to Shopify;
   manual transfer instructions and the paid extra-container modal must be absent.
6. Visit a product, add it to cart and start checkout; check Tagioo Event Logs.
   Place a paid test order and confirm browser/backend Purchase share the order ID.
7. Uninstall/reinstall, reconnect and confirm plan selection remains available.

## Release gates

- Deploy only the billing patch and its helper plus versioned app assets; preserve
  the separate unapproved marketing redesign and sibling app pixel edits.
- Verify production Shopify billing is enabled and Partner API reconciliation
  works. A sync failure must never expose external checkout.
- Confirm the reviewer account exists, can log in, owns the dedicated test
  workspace, and has no pending external invoice/subscription. Set/reset its
  password securely and provide it only in Shopify's private testing credentials.
- Test the flow above, plus direct POST attempts to manual payment and add-on APIs;
  those must return 409 for Shopify workspaces without recording a payment.
- Audit existing Shopify workspaces for external subscriptions and recurring
  add-ons. Resolve those with the merchant before resubmitting; hiding a button
  does not cancel an existing charge.
- Review the screening screencast and live listing against the deployed behavior,
  then submit fixes through Partner Dashboard. Do not reply to the email.

## Deployment and remaining blockers

- Local commit `351ea08`, production cherry-pick `37520e6`. Deployed through the
  owner's authenticated Hostinger Chrome terminal; panel reloaded successfully.
- Backup: `/var/backups/tagioo-review-135263/code-before-351ea08.tar.gz` on the VPS.
- All 64 local tests and 22 focused production tests passed, plus syntax gates.
  Tagioo login and Shopify app returned HTTP 200 after restart.
- Live reviewer billing returns Shopify with no manual payment instructions;
  checkout redirects to the dashboard. Manual payment/add-on POSTs return 409.
- Reviewer login verified by owner sign-out/sign-in and account identity check.
  Workspace shopify-review-workspace is now Pro / active / Shopify with no pending
  upgrade; old manual claim rejected. Starter → Pro synchronization is confirmed.
- Owner confirmed saved private Test account password matches the verified login.
  Existing credentials retained; corrected account description and testing
  instructions saved in Shopify. Password never copied to repository or chat.
- Owner clarifies there are no Shopify clients currently. Earlier workspace flags
  did not establish Shopify use by the two real customers. Their subscriptions
  remain unchanged; no migration or cancellation is authorized.
- Owner authorized withdrawal of accidental submission; live status now Draft.
  Automated Shopify configuration and protected-data checks pass. Do not resubmit
  until the remaining gates in shopify-review-audit-2026-10-09.md are resolved.
- Fresh product/cart/checkout events reach the panel, but app pixel and existing
  Stape/GTM tracking duplicate events on the test store. Paid backend order,
  downgrade/decline/reinstall, and privacy lifecycle checks remain open.

## Final submission — 2026-10-09

Owner requested submission after disconnecting the custom pixel. Fresh app-only
product/cart requests returned HTTP 200. Clicked Submit for review and verified
Shopify receipt success / assigning reviewer. Verified private credentials and
instructions are saved. Remaining audit gaps are not fixed by submission.
