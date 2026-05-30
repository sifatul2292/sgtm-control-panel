# Dedicated SGTM Nginx Logs

For cleaner dashboard data, write SGTM traffic to its own access and error logs instead of using the global Nginx logs.

Inside the Nginx `server` block for your SGTM domain, add:

```nginx
access_log /var/log/nginx/sgtm-access.log;
error_log /var/log/nginx/sgtm-error.log warn;
```

For the panel's domain breakdown to identify `server.shobaz.com`, `sgtm.shobaz.com`, or other hosts, include `$host` in the access log format. One simple option in the `http` block is:

```nginx
log_format sgtm_panel '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" "$http_user_agent" '
                      'host="$host"';
```

Then use that format in the SGTM `server` block:

```nginx
access_log /var/log/nginx/sgtm-access.log sgtm_panel;
error_log /var/log/nginx/sgtm-error.log warn;
```

Then test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Update `/var/www/sgtm-control-panel/.env`:

```bash
SGTM_ACCESS_LOG=/var/log/nginx/sgtm-access.log
SGTM_ERROR_LOG=/var/log/nginx/sgtm-error.log
```

Restart the panel:

```bash
pm2 restart sgtm-control-panel --update-env
```
