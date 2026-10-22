#!/bin/sh
# Build the WordPress.org submission zip from the repo's single-file plugin.
# Output: packages/tagioo-woocommerce-wporg/tagioo-for-woocommerce.zip
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
slug=tagioo-for-woocommerce
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir "$tmp/$slug"
cp "$root/tagioo-woocommerce.php" "$tmp/$slug/$slug.php"
cp "$here/readme.txt" "$tmp/$slug/readme.txt"

plugin_ver=$(sed -n 's/^ \* Version: *//p' "$tmp/$slug/$slug.php" | tr -d '[:space:]')
stable=$(sed -n 's/^Stable tag: *//p' "$tmp/$slug/readme.txt" | tr -d '[:space:]')
if [ "$plugin_ver" != "$stable" ]; then
  echo "Version mismatch: plugin $plugin_ver, readme Stable tag $stable" >&2
  exit 1
fi

rm -f "$here/$slug.zip"
(cd "$tmp" && zip -qrX "$here/$slug.zip" "$slug")
echo "Built $here/$slug.zip (v$plugin_ver)"
