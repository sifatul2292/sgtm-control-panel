# Tagioo VPS Setup

This guide sets up a fresh VPS for:

- Public site: `https://tagioo.com`
- Dashboard login: `https://tagioo.com/login`
- App hostname: `https://app.tagioo.com`
- Customer CNAME target: `bd.tagioo.com`

## DNS

Create these records at your domain DNS provider:

```text
A      tagioo.com       147.79.67.213
A      app.tagioo.com   147.79.67.213
A      bd.tagioo.com    147.79.67.213
```

Customers will create:

```text
CNAME  server.customer.com  bd.tagioo.com
```

## Install Server Packages

```bash
sudo apt update
sudo apt install -y git curl nginx certbot python3-certbot-nginx ca-certificates gnupg
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Install Node.js 20 and PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Log out and back in after adding the user to the Docker group, or use `AUTO_LAUNCH_USE_SUDO=true`.

## Clone The App

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/sifatul2292/sgtm-control-panel.git tagioo
cd /var/www/tagioo
npm install
cp .env.example .env
```

## Configure `.env`

Edit `/var/www/tagioo/.env`:

```bash
nano /var/www/tagioo/.env
```

Recommended production values:

```bash
PORT=3100
HOST=127.0.0.1

AUTH_ENABLED=true
AUTH_USERNAME=admin
AUTH_PASSWORD=replace-with-a-strong-password
AUTH_SECRET=replace-with-openssl-rand-hex-32

SERVICE_NAME=Tagioo
PUBLIC_BASE_URL=https://tagioo.com
CUSTOMER_SUPPORT_EMAIL=support@tagioo.com

PROVISION_DNS_TARGET=bd.tagioo.com
PROVISION_OUTPUT_DIR=./data/provisioning

AUTO_LAUNCH_ENABLED=true
AUTO_LAUNCH_REQUIRE_DNS=true
AUTO_LAUNCH_CERTBOT=true
AUTO_LAUNCH_CERTBOT_EMAIL=admin@tagioo.com
AUTO_LAUNCH_USE_SUDO=true
NGINX_SITES_AVAILABLE_DIR=/etc/nginx/sites-available
NGINX_SITES_ENABLED_DIR=/etc/nginx/sites-enabled

LOCAL_WORKER_ID=tagioo-bdix-1
LOCAL_WORKER_NAME="Tagioo BDIX Worker 1"
LOCAL_WORKER_REGION="Bangladesh BDIX"
LOCAL_WORKER_PUBLIC_HOST=bd.tagioo.com
LOCAL_WORKER_IP=147.79.67.213
LOCAL_WORKER_MAX_CONTAINERS=200
LOCAL_WORKER_CPU_CORES=1
LOCAL_WORKER_MEMORY_GB=4
LOCAL_WORKER_DISK_GB=50

DEFAULT_CONTAINER_MEMORY_MB=512
DEFAULT_CONTAINER_CPU_LIMIT=0.50

DATA_DIR=./data
HISTORY_RETENTION_DAYS=90

TRACKING_HOSTS=tagioo.com,app.tagioo.com,bd.tagioo.com
SSL_DOMAIN=tagioo.com
SSL_PORT=443
```

Generate a strong secret:

```bash
openssl rand -hex 32
```

## Passwordless Sudo For Auto Launch

If `AUTO_LAUNCH_USE_SUDO=true`, allow the app user to run only the required commands without a password.

```bash
sudo visudo -f /etc/sudoers.d/tagioo
```

Add this, replacing `deployuser` with your Linux username:

```text
deployuser ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/docker, /usr/bin/docker-compose, /usr/bin/cp, /usr/bin/ln, /usr/bin/rm, /usr/bin/mkdir, /usr/sbin/nginx, /usr/bin/systemctl, /usr/bin/certbot
```

## Start With PM2

```bash
cd /var/www/tagioo
pm2 start server.js --name tagioo
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`.

## Nginx For Tagioo App

Create the main Nginx site:

```bash
sudo nano /etc/nginx/sites-available/tagioo.com
```

Paste:

```nginx
server {
    listen 80;
    server_name tagioo.com www.tagioo.com app.tagioo.com bd.tagioo.com;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/tagioo.com /etc/nginx/sites-enabled/tagioo.com
sudo nginx -t
sudo systemctl reload nginx
```

Issue SSL:

```bash
sudo certbot --nginx -d tagioo.com -d www.tagioo.com -d app.tagioo.com -d bd.tagioo.com
```

## Deploy Updates

```bash
cd /var/www/tagioo
git pull origin main
npm install
pm2 restart tagioo
```

## First Customer Test

1. Open `https://tagioo.com/login`.
2. Log in as owner.
3. Create a customer login.
4. Log in as the customer.
5. Create a container with:
   - Website: `https://customer-domain.com`
   - Tracking subdomain: `server.customer-domain.com`
   - Container config from GTM server container settings
6. Customer DNS must point:

```text
CNAME  server.customer-domain.com  bd.tagioo.com
```

If DNS is ready, Tagioo should move the container toward `http_live` or `live`.
