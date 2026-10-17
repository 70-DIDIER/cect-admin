#!/usr/bin/env bash
# Publie exclusivement l'interface d'administration de 70-DIDIER/cect-admin.
# Le site public (70-DIDIER/CECT-frontend) et l'API (70-DIDIER/cecet-api)
# restent en place. Le pilote Modson n'est PAS inclus dans cette release.
set -Eeuo pipefail

if [[ "${CECT_STAGING_DEPLOY:-}" != "YES" ]]; then
  echo "Déploiement refusé : CECT_STAGING_DEPLOY=YES requis." >&2
  exit 2
fi

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINK="${CECT_ADMIN_LINK:-/home/ubuntu/cect-current/admin}"
RELEASES="${CECT_ADMIN_RELEASES:-/home/ubuntu/cect-releases}"
LARAVEL_ENV="${CECT_LARAVEL_ENV_FILE:-/var/www/cect-api/.env}"
ADMIN_URL="${CECT_ADMIN_ORIGIN:-https://admin.13-49-203-235.sslip.io}"
API_URL="${VITE_API_URL:-https://api.13-49-203-235.sslip.io}"
FRONT_URL="${CECT_PUBLIC_ORIGIN:-https://13-49-203-235.sslip.io}"

if [[ ! -r "$LARAVEL_ENV" ]] || ! grep -Eq '^APP_ENV=staging$' "$LARAVEL_ENV"; then
  echo "Déploiement refusé : APP_ENV=staging non confirmé." >&2
  exit 2
fi
if [[ "$ADMIN_URL" != https://* || "$API_URL" != https://* || "$FRONT_URL" != https://* ]]; then
  echo "HTTPS obligatoire." >&2
  exit 2
fi
if [[ ! -L "$LINK" ]]; then
  echo "L'administration actuelle n'est pas un lien symbolique : intervention manuelle nécessaire." >&2
  exit 2
fi
OLD="$(readlink -f "$LINK")"
[[ -s "$OLD/index.html" ]] || { echo "Impossible de vérifier l'ancienne release." >&2; exit 2; }
for tool in git npm curl rsync flock; do command -v "$tool" >/dev/null || exit 2; done
[[ "$(git -C "$SOURCE" config --get remote.origin.url)" == "https://github.com/70-DIDIER/cect-admin.git" ]] || {
  echo "Déploiement refusé : la source doit être le dépôt Didier cect-admin." >&2
  exit 2
}
curl --fail --silent --show-error --max-time 12 "$API_URL/api/v1/health" >/dev/null
curl --fail --silent --show-error --max-time 12 "$FRONT_URL/" >/dev/null

mkdir -p "$(dirname "$LINK")" "$RELEASES"
exec 9>"$(dirname "$LINK")/.cect-admin-deploy.lock"
flock -n 9 || { echo "Autre déploiement admin en cours." >&2; exit 2; }

cd "$SOURCE"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  # Dépôt Didier sans lockfile versionné à l'origine : générer un lockfile local.
  npm install --no-audit --no-fund
fi
VITE_API_URL="$API_URL" VITE_SIMULATE_PAYMENT=false npm run build
[[ -s dist/index.html && -s dist/logos/CECT_logo_64.png ]] || {
  echo "Build Didier incomplet." >&2
  exit 1
}
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE="$RELEASES/admin-didier-only-$STAMP"
mkdir "$RELEASE"
rsync -a dist/ "$RELEASE/"
[[ ! -e "$RELEASE/pilot" ]] || { echo "Le build contient encore /pilot." >&2; exit 1; }
grep -q '/logos/CECT_logo_64.png' "$RELEASE/index.html" || {
  echo "Favicon Didier absent." >&2
  exit 1
}
COMMIT="$(git rev-parse HEAD)"
printf 'source=70-DIDIER/cect-admin\ncommit=%s\nutc=%s\n' "$COMMIT" "$STAMP" > "$RELEASE/.cect-release-info"
find "$RELEASE" -type d -exec chmod 755 {} +
find "$RELEASE" -type f -exec chmod 644 {} +

SWITCHED=0
rollback() {
  if [[ "$SWITCHED" == 1 ]]; then
    echo "Contrôle échoué : restauration de $OLD" >&2
    ln -s "$OLD" "$(dirname "$LINK")/.admin-rollback-$STAMP"
    mv -Tf "$(dirname "$LINK")/.admin-rollback-$STAMP" "$LINK"
  fi
}
trap rollback ERR

ln -s "$RELEASE" "$(dirname "$LINK")/.admin-next-$STAMP"
mv -Tf "$(dirname "$LINK")/.admin-next-$STAMP" "$LINK"
SWITCHED=1

# Contrôles sur les vrais domaines servis par Nginx.
curl --fail --silent --show-error --max-time 15 -H 'Cache-Control: no-cache' "$ADMIN_URL/admin?deploy=$STAMP" |
  cmp -s - "$RELEASE/index.html"
for url in "$ADMIN_URL/admin" "$ADMIN_URL/admin/packs" "$ADMIN_URL/admin/configuration" "$ADMIN_URL/logos/CECT_logo_64.png"; do
  curl --fail --silent --show-error --max-time 12 -o /dev/null "$url"
done
while read -r asset; do
  [[ -z "$asset" ]] && continue
  [[ -s "$RELEASE$asset" ]] || { echo "Asset local absent : $asset" >&2; false; }
  curl --fail --silent --show-error --max-time 12 -o /dev/null "$ADMIN_URL$asset"
done < <(grep -oE '/assets/[^"]+\.(js|css)' "$RELEASE/index.html" | sort -u)

curl --fail --silent --show-error --max-time 12 "$API_URL/api/v1/health" >/dev/null
curl --fail --silent --show-error --max-time 12 "$FRONT_URL/" >/dev/null
trap - ERR
echo "DIDIER_ADMIN_DEPLOYED=$RELEASE"
echo "PREVIOUS_RELEASE_RETAINED=$OLD"
echo "SOURCE_COMMIT=$COMMIT"
echo "Pilot Modson removed from active admin release; historical release retained for rollback."
echo "L'authentification et les opérations financières nécessitent une recette E2E distincte."
