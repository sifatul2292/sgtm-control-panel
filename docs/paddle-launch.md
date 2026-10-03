# Paddle production launch

Paddle is Tagioo's global card rail. It runs alongside bKash/Nagad and Shopify
App Pricing; it does not replace either one. Keep `PADDLE_ENV=sandbox` until the
complete sandbox checklist passes.

## Paddle dashboard setup

1. Complete Paddle account and domain approval for `tagioo.com`.
2. Create recurring monthly products/prices for:
   - Starter — USD 30
   - Pro — USD 50
   - Enterprise — USD 100
3. Put the matching `pri_...` IDs in `PADDLE_PRICE_ID_STARTER`,
   `PADDLE_PRICE_ID_PRO`, and `PADDLE_PRICE_ID_ENTERPRISE`.
4. Create a client-side token for Paddle.js and set `PADDLE_CLIENT_TOKEN`.
5. Create a server API key with subscription write and customer portal session
   write permissions. Store it as `PADDLE_SANDBOX_API_KEY` or
   `PADDLE_LIVE_API_KEY` for the selected environment.
6. Create a notification destination:

   `https://tagioo.com/api/paddle/webhook`

   Subscribe it to `transaction.completed`, `subscription.updated`,
   `subscription.activated`, `subscription.resumed`, `subscription.past_due`,
   `subscription.canceled`, and `subscription.paused`.
7. Store that destination's endpoint secret as `PADDLE_WEBHOOK_SECRET`.

Never commit the API key or webhook secret. Client tokens and price IDs are
intended to be public, but keep environment-specific values in the VPS `.env`.

## Sandbox acceptance test

Use a throwaway non-Bangladesh Tagioo customer and complete all of these before
production:

1. Buy Starter and confirm exactly one Paddle payment is recorded, the tenant
   becomes active, and the container resumes.
2. Replay the same `transaction.completed` notification and confirm it is a
   no-op rather than a second payment or second activation.
3. Attempt a modified checkout where browser `custom_data.planName` does not
   match the purchased price. Confirm the signed Paddle price remains the plan
   authority.
4. Upgrade Starter to Pro and confirm Paddle charges the prorated difference;
   wait for the webhook and confirm Tagioo changes limits only afterward.
5. Downgrade Pro to Starter and confirm the signed subscription webhook applies
   the new limits and Paddle credits unused time on the next bill. Paddle item
   replacements apply immediately; `effective_from` is not supported for them.
6. Open **Manage card & invoices**, update the sandbox payment method, and
   download an invoice from Paddle's hosted portal.
7. Simulate `subscription.past_due` and confirm service remains active while
   Paddle dunning runs.
8. Cancel at period end and confirm Tagioo moves the tenant to a fresh Free
   cycle only when Paddle reports the subscription canceled.
9. Replay the canceled event and confirm the Free cycle is not reset.
10. Confirm invalid, modified, and older-than-five-minutes webhook signatures
    are rejected.

## Production switch

Production activation is an operator action, not a code deployment:

1. Create production products/prices, client token, API key, and notification
   destination.
2. Replace the sandbox values in the VPS `.env` with the production values.
3. Set `PADDLE_ENV=production`.
4. Reload PM2 with updated environment variables.
5. Run one real low-value purchase, portal visit, plan change, invoice check,
   and cancellation test before advertising card checkout broadly.

Rollback is one variable change: return `PADDLE_ENV` to `sandbox` with the
sandbox credentials still present, or clear `PADDLE_CLIENT_TOKEN` to hide card
checkout while leaving existing webhook records intact.
