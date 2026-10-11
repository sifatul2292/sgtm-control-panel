# Meta Pixel + CAPI: how to check for duplicate purchases

One customer buys once. Your browser sends a purchase, and your server sends another. That can be the right setup—as long as Meta can tell they describe the same sale. This guide shows you what to inspect when the numbers look inflated.

Start with a single known purchase. Tagioo's generated tracking workflow includes browser and server configuration, but verification still matters when an existing website has other pixels or plugins installed.

## Map the two paths before changing anything

Write down which code sends the browser purchase and which integration sends the server purchase. Confirm that both are intended for the same Meta destination. Also list native store integrations and older CAPI tools that might still be active.

If a native integration manages its own browser and server pair, do not assume a new unrelated pair will share its identifiers. First decide which implementation owns the purchase event.

## Use one identity for one business action

For the paired purchase, inspect the browser event ID and the server event ID. Check the event name too. The corresponding paths must identify the same action; separately generated random IDs are a common reason that two signals look like two different events.

Tagioo's tracking code is designed to pass event-specific IDs into its generated browser pixel flow. That design is useful only if the imported configuration, event source and active website tags still agree. Verify the actual payload rather than assuming an old template is current.

## Distinguish order identity from amount

Choose a test order with a known reference and inspect its details in Purchase Inspector. Never infer event identity from equal values. Two independent orders can both be worth $49, while a retry of one order should preserve that order's identity.

An order reference and a destination event ID can be related without being identical fields. Record the relationship your implementation uses so a reviewer can follow it across logs and diagnostics.

## Test repeat actions deliberately

Repeat the conditions most likely to resend a purchase: refresh the confirmation page, revisit it if permitted, or examine a documented backend retry. Inspect whether the implementation creates a new ID or preserves the original one.

Do not deliberately resend customer events into production to experiment. Use a controlled test environment or the destination's supported test workflow. Keep access tokens and personal payload data out of the shared evidence.

## Separate three kinds of duplicate evidence

Several incoming requests in Tagioo show that the server received several requests. Multiple fired tags in GTM show that the configuration ran several senders. A counted duplicate in Meta concerns the destination's treatment of the signals. These observations are related, but they are not interchangeable.

Check the paired fields, active tag inventory and destination diagnostics together. If the same event is sent by two unrelated integrations, fix the ownership overlap instead of hiding duplicate requests in a dashboard.

## Finish with a verification note

Record the order reference, browser ID, server ID, event names, destination and observed diagnostic result. For Meta's current requirements, consult its [Pixel and server event deduplication documentation](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/) before publishing changes.

Continue with the [WooCommerce purchase checklist](/blog/woocommerce-purchase-tracking-checklist) for an end-to-end test, or [Tagioo documentation](/docs) for the supported setup path. A successful deduplication check is evidence about one tested implementation, not a guarantee of better ROAS.
