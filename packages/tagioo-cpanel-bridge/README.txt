TAGIOO CPANEL BRIDGE
====================

This package is for a Laravel store on shared cPanel hosting. It does not need
Terminal, SSH, Composer, a database migration, or changes to checkout code.

IMPORTANT SAFETY RULES
----------------------
1. Upload the tagioo-bridge folder to your cPanel HOME folder, outside public_html.
2. Do not place config.php inside a public website folder.
3. The bridge reads orders with SELECT queries only. It never edits store tables.
4. The first run skips every existing order. Only later paid orders are sent.
5. Rename disabled.flag.example to disabled.flag at any time for an instant stop.

INSTALL WITH CPANEL FILE MANAGER
-------------------------------
1. Download this ZIP from Tagioo.
2. Open cPanel > File Manager and go to your home folder (one level above public_html).
3. Upload the ZIP and click Extract. You should have: tagioo-bridge/bridge.php
4. In File Manager, set config.php permission to 0600 if your host allows it.
5. Open cPanel > Cron Jobs.
6. Add a Once Per Minute cron command:

   /usr/local/bin/php /home/CPANEL_USERNAME/tagioo-bridge/bridge.php run

   Replace CPANEL_USERNAME with the username shown in cPanel File Manager.
   If your host shows a different PHP command, select that PHP 8.1+ command.
7. Return to Tagioo and click Check connection. Confirm the automatically detected
   fields, click Activate tracking, then complete one new paid test order.

SAFE CHECK (OPTIONAL)
---------------------
If your cPanel has Terminal, this command checks the connection without sending:

   php /home/CPANEL_USERNAME/tagioo-bridge/bridge.php doctor

If automatic Laravel discovery fails, edit config.php in File Manager and set
laravel_root to the full folder containing the artisan file. If order columns are
custom, use Advanced mapping in the Tagioo dashboard; do not edit PHP code.
