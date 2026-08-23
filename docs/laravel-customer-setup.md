# Laravel Setup

This guide connects a Laravel ecommerce website to Tagioo with Web GTM, Server
GTM, and reliable backend Purchase tracking. On supported cPanel hosting, the
standard installation does not require Composer, a terminal, Laravel code
changes, VPS access, or sharing a hosting password.

## What Tagioo tracks

- The generated Web GTM template tracks browser events such as PageView,
  ViewContent, AddToCart, and InitiateCheckout.
- The private cPanel Bridge reads completed Laravel orders and sends the
  authoritative backend Purchase event.
- The generated Server GTM template forwards events only to the destinations
  selected in Setup Assistant.

The backend Purchase path continues to work when a browser blocks tracking, a
payment provider redirects away, or the customer closes the confirmation page.

## Before you start

You need:

- a live Tagioo container and first-party tracking domain;
- the Laravel store URL;
- a Web Google Tag Manager container ID (`GTM-XXXXXXX`);
- cPanel access with **File Manager** and **Cron Jobs**;
- PHP 8.1 or newer on the cPanel Cron command line.

Add only the **Web GTM ID** to the website. The Server GTM container runs through
Tagioo and is not pasted into Laravel.

Never give Tagioo your website or hosting password. The private Bridge ZIP
already contains the tenant-scoped connection details required by the store.

## 1. Generate the GTM templates

1. Open **Setup Assistant** in Tagioo.
2. Select **Ecommerce → Laravel / Custom Ecommerce**.
3. Confirm the default currency and tracking domain.
4. Select only the destinations the store actually uses.
5. Enter the required IDs, access tokens, conversion labels, or test codes for
   those selected destinations.
6. Generate the Web and Server GTM files.

Tagioo does not add unselected Google Ads or TikTok destination tags to newly
generated files.

## 2. Import the Web and Server GTM files

1. In Web GTM, open **Admin → Import Container** and upload
   `tagioo-web-template.json`.
2. In Server GTM, open **Admin → Import Container** and upload
   `tagioo-server-template.json`.
3. For a first import into a clean workspace, choose **Merge**.
4. When updating an older Tagioo setup, choose
   **Merge → Overwrite conflicting tags, triggers, and variables**.
5. Check the import summary and make sure only one current Tagioo tag set
   remains.
6. Keep both containers in Preview mode until the complete test passes.

The generated Laravel Web tracker steps aside when the website already pushes
standard ecommerce events to the `dataLayer`; it does not need to create a
second copy of those storefront events.

## 3. Create the private Laravel Bridge

1. Return to the Laravel section in **Setup Assistant**.
2. Enter the public store URL, including `https://`.
3. Create the installation package.
4. Download `tagioo-cpanel-bridge.zip`.

The package belongs to one Tagioo tenant and store. Do not share it, reuse it on
another store, commit it to Git, or upload it to a public folder.

## 4. Install the Bridge with cPanel File Manager

1. Open **cPanel → File Manager**.
2. Go to the cPanel account home directory, one level above `public_html`.
3. Upload the private ZIP and choose **Extract**.
4. Confirm the new `tagioo-bridge` folder is outside `public_html`.
5. Open `README.txt` inside that folder and copy its complete Cron command.

The command normally resembles:

```text
/usr/local/bin/php /home/CPANEL_USERNAME/tagioo-bridge/bridge.php run
```

Use the exact PHP path and username supplied for that hosting account. Do not
copy another customer's path.

The Bridge does not edit Laravel files, run database migrations, or write to the
store database. It performs read-only `SELECT` queries to find new orders.

## 5. Add the once-per-minute Cron Job

1. Open **cPanel → Cron Jobs**.
2. Select **Once Per Minute**, or enter `*` in all five schedule fields.
3. Paste the complete command from `README.txt` into **Command**.
4. Save the Cron Job.
5. Wait up to two minutes.

For initial troubleshooting, append a private log file to the command:

```text
>> /home/CPANEL_USERNAME/tagioo-bridge/cron.log 2>&1
```

Remove or rotate that log after setup so it does not grow indefinitely.

If cPanel has no **Cron Jobs**, send the supplied command to the hosting company
and ask them to schedule it once per minute. Root or VPS access is not required,
but a file upload alone cannot run reliable backend tracking.

## 6. Confirm automatic store detection

Return to Tagioo and click **Check connection**. A successful connection shows
the detected order table and fields.

During detection, the Bridge sends schema metadata such as table and column
names. It does not send database credentials, passwords, complete customer
records, or raw historical orders.

### More than one Laravel application was found

If `cron.log` says:

```text
[Tagioo] ERROR: More than one Laravel app was found. Set laravel_root in config.php.
```

open `tagioo-bridge/config.php`, find the `laravel_root` line, and enter the full
path of the Laravel application serving the selected domain. The correct folder
contains the Laravel `artisan` file. For example:

```php
'laravel_root' => '/home/CPANEL_USERNAME/example-app',
```

Do not guess if several folders contain `artisan`; confirm the document root in
cPanel **Domains** or ask the hosting provider which Laravel folder serves the
domain.

## 7. Review Advanced mapping

If Tagioo shows **Needs mapping**, open **Advanced mapping** and review:

- orders table;
- public Order ID;
- order total and status;
- created and updated timestamps;
- items table and item-to-order reference;
- product ID, product name, item price, and quantity;
- valid paid or accepted order statuses.

For **Order ID**, prefer the customer-facing invoice or order number, such as
`invoice_id`, `invoice_number`, `invoice_no`, `order_number`, or `order_no`.
Use the internal database `id` only when it is also the number shown to the
customer.

For COD stores, a newly placed order can be valid before delivery. Include the
actual status stored for that order. Depending on the application, that may be a
word such as `pending` or a numeric value such as `1`.

Save the mapping and wait for the next Cron run. A custom table may require one
save to discover its columns and a second save to select those columns.

## 8. Activate tracking

When the mapping is correct, click **Activate tracking**. The first active run
checkpoints existing orders, so historical orders are not imported as new
purchases.

Create the test order only after activation.

## 9. Complete one test order

1. Start Preview mode for both Web GTM and Server GTM.
2. If testing Meta, open **Events Manager → Test events**, select **Website**,
   enter the same test event code configured in Tagioo, and clear old activity.
3. Open a fresh store tab and complete one normal journey: page, product, cart,
   checkout, and order.
4. Make sure the order reaches a status included in the mapping.
5. Do not repeatedly refresh the thank-you page.
6. Wait up to two minutes for the Cron Job.
7. Click **Verify test order** in Tagioo.
8. Confirm the public Order ID, amount, currency, items, and selected
   destinations.

Publish both GTM containers only after the Tagioo verification and destination
tests pass.

## 10. Verify Meta deduplication

Meta Test Events normally shows both a **Browser** and **Server** row for an
event. That is expected. They represent one logical event only when:

- the event names match;
- the Event IDs match exactly; and
- Meta marks one copy as **Deduplicated**.

For Laravel Purchase, the Event ID should be the mapped customer-facing Order
ID. For browser funnel events, Tagioo IDs normally begin with `tagioo-`.

An Event ID beginning with another prefix, such as `ob3_plugin-set_`, comes from
another script on the Laravel website. It is not generated by Tagioo. Different
IDs cannot be deduplicated into one event.

## Existing Meta or TikTok tracking

Use one browser-event owner. Keep the website's normal ecommerce `dataLayer`
pushes, but disable older GTM tags or hard-coded calls that send the same events
directly, including:

```javascript
fbq('track', ...)
fbq('trackCustom', ...)
ttq.track(...)
```

Meta's automatically logged events, such as `SubscribedButtonClick`, are
separate from Tagioo. Disable Meta automatic event tracking in Events Manager if
the store does not want those events.

## Pause or remove the Bridge

- Click **Pause tracking** in Tagioo to reject new Bridge purchases.
- Disable the Cron Job for an immediate local stop.
- If supplied by the package, rename `disabled.flag.example` to `disabled.flag`
  for a local emergency stop.
- Delete the Cron Job and `tagioo-bridge` folder to remove the integration.

These actions do not edit or remove the Laravel website.

## Security checklist

- Keep `tagioo-bridge`, its ZIP, `config.php`, logs, and secrets outside
  `public_html`.
- Never publish the package or secret in screenshots, tickets, source control,
  or public downloads.
- Rotate the Bridge secret in Tagioo if it is exposed.
- Do not send database passwords to Tagioo; the Bridge boots the local Laravel
  application and uses its existing database connection.

## Troubleshooting

- **Not connected:** confirm the ZIP is extracted outside `public_html`, the
  Cron is enabled, and the command uses the correct PHP path and cPanel username.
- **`HTTP 0` or `HTTP 502`:** leave the Cron enabled so local retry safety can
  resend temporary failures, then check the latest log and Tagioo container
  status.
- **Needs mapping:** review every required field and click **Save mapping and
  detect again**. Do not enter a database password.
- **No test order:** confirm tracking was activated before the order, the order
  reached an accepted status, and at least one Cron run has completed.
- **Wrong Purchase ID:** map the public invoice/order column instead of the
  internal database `id`, then reactivate and create a new test order.
- **Duplicate browser events:** search the Laravel layouts, GTM containers, and
  third-party scripts for another Meta Pixel or direct `fbq()`/`ttq()` sender.
- **Browser and Server do not deduplicate:** compare event name and Event ID on
  both rows. They must match exactly.
- **No Cron Jobs in cPanel:** ask the hosting provider to schedule the command
  once per minute.
- **Bridge log keeps growing:** remove the `>> cron.log 2>&1` suffix after the
  integration is stable, or arrange log rotation.
