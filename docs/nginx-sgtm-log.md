# Dedicated SGTM Nginx Logs

For cleaner dashboard data, write SGTM traffic to its own access and error logs instead of using the global Nginx logs.

Inside the Nginx `server` block for your SGTM domain, add:

```nginx
access_log /var/log/nginx/sgtm-access.log;
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
