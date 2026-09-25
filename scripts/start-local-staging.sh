#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo 'Refusing local staging: this checkout has a .env file that server.js would load.' >&2
  exit 1
fi

node -e "const Database = require('better-sqlite3'); new Database(':memory:').close()" >/dev/null 2>&1 || {
  echo 'Use the Node version matching the installed better-sqlite3 build (Node 20 here).' >&2
  exit 1
}

staging_dir="$PWD/data/local-staging"
credentials="$staging_dir/credentials.env"
umask 077
mkdir -p "$staging_dir"
if [ ! -f "$credentials" ]; then
  {
    printf 'AUTH_USERNAME=staging-admin\n'
    printf 'AUTH_PASSWORD=%s\n' "$(openssl rand -hex 20)"
    printf 'AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'TAGIOO_DATA_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)"
  } > "$credentials"
fi
if ! grep -q '^TAGIOO_DATA_ENCRYPTION_KEY=' "$credentials"; then
  printf 'TAGIOO_DATA_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)" >> "$credentials"
fi

# Only explicit local values reach the process; inherited production secrets do not.
set -a
. "$credentials"
set +a
exec env -i PATH="$PATH" HOME="$HOME" \
  HOST=127.0.0.1 PORT=3101 DATA_DIR=./data/local-staging \
  AUTH_ENABLED=true AUTH_USERNAME="$AUTH_USERNAME" AUTH_PASSWORD="$AUTH_PASSWORD" AUTH_SECRET="$AUTH_SECRET" \
  TAGIOO_DATA_ENCRYPTION_KEY="$TAGIOO_DATA_ENCRYPTION_KEY" REQUIRE_STRONG_STAFF_PASSWORDS=true \
  PUBLIC_BASE_URL=http://127.0.0.1:3101 APP_URL=http://127.0.0.1:3101 \
  AUTO_LAUNCH_ENABLED=false AUTO_LAUNCH_CERTBOT=false CPANEL_BRIDGE_ENABLED=false \
  node server.js
