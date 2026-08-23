# Connect a Laravel Store to Tagioo

You do not need to edit Laravel code, use Composer, find CSS selectors, or open
a terminal. On supported cPanel hosting, Tagioo creates a private bridge ZIP
that you install with **File Manager** and **Cron Jobs**.

## Before you start

You need:

- your Laravel store website address;
- your Web Google Tag Manager container ID (`GTM-XXXXXXX`);
- a live Tagioo container and tracking domain;
- cPanel access with **File Manager** and **Cron Jobs**.

Never give Tagioo your website or hosting password. The bridge package already
contains the private connection details for your store.

## 1. Generate and import the GTM templates

1. Add your **Web GTM ID** in your website's tracking or analytics settings.
   Do not put the Server GTM ID on the website.
2. Open **Setup Assistant** in Tagioo.
3. Select **Ecommerce → Laravel / Custom Ecommerce**.
4. Confirm the currency, tracking domain, and destinations you use.
5. Generate the files.
6. Import `web.json` into Web GTM and `server.json` into Server GTM with
   **Admin → Import Container → Merge**.
7. Keep both containers in Preview mode until your test is complete.

The JSON files use the same Tagioo Web and Server GTM architecture as the other
platforms. The Laravel bridge supplies reliable backend Purchase data to it.

## 2. Create your private Laravel Bridge

1. Return to the Laravel section in **Setup Assistant**.
2. Enter the public URL of your store, including `https://`.
3. Click **Create installation package**.
4. Download `tagioo-cpanel-bridge.zip`.

The package is unique to your Tagioo container. Do not upload it to a public
folder or share it with another store.

## 3. Install it with cPanel File Manager

1. Open **cPanel → File Manager**.
2. Open your cPanel home folder, one level above `public_html`.
3. Upload the ZIP and choose **Extract**.
4. Confirm the new `tagioo-bridge` folder is outside `public_html`.
5. Open the package's `README.txt`. It contains the exact Cron command for your
   package.

The bridge only reads Laravel order data. It does not edit Laravel source files,
run migrations, or write to the store database.

## 4. Add the Cron Job

1. Open **cPanel → Cron Jobs**.
2. Select **Once Per Minute** (or enter five stars in the schedule fields).
3. Paste the command from `README.txt`.
4. Replace `CPANEL_USERNAME` with the username shown in File Manager, if the
   command still contains that placeholder.
5. Save the Cron Job.

Wait up to two minutes, return to Tagioo, and click **Check connection**.
Tagioo will show the order table and fields it detected. No order records,
customer details, passwords, or database credentials are sent during detection.

If cPanel has no **Cron Jobs**, send the command from `README.txt` to the hosting
company and ask them to schedule it once per minute. A file upload alone cannot
run reliable backend tracking.

## 5. Review and activate

If Tagioo reports **Ready**, click **Activate tracking**. The first active run
checkpoints the store's current orders, so old orders are not imported.

If Tagioo reports **Needs mapping**, open **Advanced mapping** and select the
matching order table, order ID, total, status, and updated-time fields from the
detected lists. Select an items table only when your store has one. Save the
mapping and wait for the next connection check; then activate when it reports
Ready.

For a completely custom table name, select and save the table first. The next
Cron check reads that table's column names; then select its fields and save once
more. No database login is needed.

The bridge sends only orders whose status matches the paid-status list. Review
that list carefully for custom stores. `paid`, `completed`, `complete`,
`processing`, and `delivered` are included by default.

## 6. Complete one test order

1. Place one clearly marked test order through the normal checkout.
2. Move it to a configured paid status if your store requires manual payment
   confirmation.
3. Wait up to two minutes.
4. In Tagioo, click **Verify test order**.
5. Confirm the order ID, amount, currency, GA4 delivery, and any selected ad
   destinations before publishing both GTM containers.

Running the Cron repeatedly or refreshing the thank-you page does not create a
second Purchase for the same order: Tagioo deduplicates by store and order ID.

## Pause or remove it

Click **Pause tracking** in Tagioo to reject new bridge purchases immediately.
The bridge also receives the paused state on its next heartbeat. For a local
emergency stop, rename `disabled.flag.example` to `disabled.flag` in File
Manager, or disable the Cron Job.

Removing the `tagioo-bridge` folder and Cron Job removes the bridge. It does not
change the Laravel website.

## Browser events and backend Purchase

`web.json` detects common product views, cart actions, and checkout activity in
the browser. The cPanel Bridge reads completed orders from Laravel and sends the
authoritative Purchase event. This backend path is important when a browser
blocks tracking, a payment provider redirects away, or the buyer closes the
confirmation page.

## Troubleshooting

- **Not connected:** confirm the ZIP was extracted outside `public_html`, the
  Cron command points to the correct cPanel username/path, and the Cron is
  enabled.
- **Needs mapping:** use only the table and field names Tagioo detected. Do not
  enter a database password.
- **No test order:** confirm the order reached one of the configured paid
  statuses and wait for the next Cron run.
- **No Cron Jobs in cPanel:** ask the hosting provider to add the supplied
  command. No VPS or root access is required.
