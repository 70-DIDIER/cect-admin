#!/usr/bin/env bash
# CECT demo deployment: execute with the authorized ubuntu service account.
# No sudo, no DB modification, and no bypass of mTLS on /superadmin.
set -euo pipefail
umask 027

SOURCE=/tmp/cect-mtls-implementation/cect-admin
ACTIVE=/home/ubuntu/cect-current/admin
RELEASES=/home/ubuntu/cect-releases
ADMIN_URL=https://admin.13-49-203-235.sslip.io
API_URL=https://api.13-49-203-235.sslip.io

test -d "$SOURCE/.git" || { echo "Missing checkout: $SOURCE" >&2; exit 1; }
test -L "$ACTIVE" || { echo "Missing active release symlink" >&2; exit 1; }
OLD="$(readlink "$ACTIVE")"
test -s "$OLD/index.html" || { echo "Invalid previous release" >&2; exit 1; }

cd "$SOURCE"
git checkout custum
git pull --ff-only origin custum
VITE_API_URL="$API_URL" VITE_SUPERADMIN_PATH_MODE=true npm run build
test -s dist/index.html
PACK_FILE="$(find dist/assets -maxdepth 1 -name 'PacksPage-*.js' -printf '%f\n' | head -1)"
test -n "$PACK_FILE" || { echo "Packs module missing in build" >&2; exit 1; }
VERSION="$(git rev-parse --short HEAD)"
NEW="$RELEASES/admin-packs-v55-$VERSION-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$NEW"
cp -a "$OLD/." "$NEW/"
cp -a dist/. "$NEW/"
setfacl -R -m u:www-data:rX "$NEW"

http() {
  curl --noproxy '*' -ks --max-time 8 -o /dev/null -w '%{http_code}' "$1" || true
}
# Fail closed even before publishing.
test "$(http "$ADMIN_URL/connexion")" = 200 || exit 1
test "$(http "$ADMIN_URL/superadmin/connexion")" = 403 || exit 1
test "$(http "$API_URL/api/v1/health")" = 200 || exit 1
test "$(http "$ADMIN_URL/assets/$PACK_FILE")" = 404 || true # New asset isn't exposed until publication.

ln -s "$NEW" /home/ubuntu/cect-current/admin.stage
mv -Tf /home/ubuntu/cect-current/admin.stage "$ACTIVE"
INDEX_ASSET="$(grep -o 'assets/index-[^" ]*' "$NEW/index.html" | head -1)"
GOOD=true
for check in "$ADMIN_URL/connexion:200" "$ADMIN_URL/superadmin/connexion:403" "$ADMIN_URL/api/v1/superadmin/status:403" "$API_URL/api/v1/health:200" "$ADMIN_URL/$INDEX_ASSET:200" "$ADMIN_URL/assets/$PACK_FILE:200"; do
  URL="${check%:*}"
  EXPECTED="${check##*:}"
  CODE="$(http "$URL")"
  echo "$URL -> $CODE (expected $EXPECTED)"
  if [[ "$CODE" != "$EXPECTED" ]]; then GOOD=false; fi
done
if [[ "$GOOD" != true ]]; then
  ln -s "$OLD" /home/ubuntu/cect-current/admin.rollback
  mv -Tf /home/ubuntu/cect-current/admin.rollback "$ACTIVE"
  echo "ERROR: deployment reverted to $OLD" >&2
  exit 1
fi
echo "SUCCESS: deployed $NEW"
echo "ROLLBACK: $OLD"
