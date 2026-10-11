# Why your store, GA4 and ad reports show different sales numbers

Your store shows 100 orders, GA4 shows 84 purchases and your ad platform shows 62 conversions. Those example numbers don’t tell you where the problem is. First, check whether the reports count the same thing. Then trace a few orders that seem to be missing.

Use a structured investigation before changing budgets or replacing your tracking stack.

## Agree on the comparison first

Choose the same date range and timezone. Decide whether you are comparing all orders, completed orders, recorded purchase events or conversions credited to advertising. Record how refunds, cancellations, taxes and shipping affect each number.

Advertising attribution is not a complete order ledger. GA4 and advertising reports can also assign credit differently. Google's [attribution reports documentation](https://support.google.com/google-ads/answer/1722023) is a useful starting point for understanding those reporting distinctions.

## Check the business system

Treat your order or lead-management system as evidence that the business action occurred. Pick a few concrete references from the apparent gap and establish their state and timestamp.

For leads, separate an accepted enquiry from a qualified lead and a won customer. Counting every submit-button click as a lead can produce the opposite problem: the ad report looks strong while the sales team receives little useful demand.

## Find the incoming event

Search the relevant Tagioo container for the chosen purchase or inspect its event logs. Confirm that you selected the correct tracking domain and reporting period.

If no request exists, investigate the source: event generation, browser trigger, supported backend integration or network delivery. If a request exists, inspect its data and move forwards. Do not keep editing the source once evidence points to a later stage.

## Inspect processing and acceptance

Use GTM preview to inspect the client, resulting event and destination tags. Then check the destination's own diagnostics. Incoming receipt, successful tag execution, destination acceptance and attributed conversion are different checkpoints.

Make a simple table for your investigation: business reference, source result, incoming request, tag result and destination result. Mark unknowns honestly. A row with an unknown destination result is more useful than labelling it a recovered conversion without proof.

## Rule out duplicates and mismatched values

Review retries and overlapping implementations. Extra requests can inflate event counts without representing extra sales. Compare transaction references instead of merging events by amount or approximate time.

For revenue differences, inspect the value definition. A purchase including delivery charges will not match a sales report that excludes them. Also verify currency and whether refunds are handled in the report you are comparing.

## Measure the repair, not a promise

Once you find the fault, record the change and repeat the same controlled test. Compare a suitable period before and after, noting changes in traffic, campaigns and store behavior. More reported events may reflect improved measurement rather than more actual revenue.

To evaluate marketing performance, use real sales, advertising cost and margin alongside platform reports. Tracking gives you stronger evidence for decisions; it does not substitute for those decisions.

Start with [Tagioo's setup checklist](/blog/tagioo-server-side-tracking-setup), then use the [purchase checklist](/blog/woocommerce-purchase-tracking-checklist) to reproduce one complete journey. If you need more incoming-event capacity, compare [plans](/pricing) after estimating your workload.
