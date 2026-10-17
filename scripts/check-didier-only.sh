#!/usr/bin/env bash
# Contrôle de provenance des trois composants actifs de la plateforme CECT.
# Lecture seule. Ne change aucune table, release ni configuration.
set -Eeuo pipefail

API=/var/www/cect-api
FRONT=/home/ubuntu/cect-source/frontend-didier
ADMIN=/home/ubuntu/cect-source/cect-admin-didier-only
LINKS=/home/ubuntu/cect-current
LEGACY=/home/ubuntu/cect-migration-20261015
EXPECTED_API=https://github.com/70-DIDIER/cecet-api.git
EXPECTED_FRONT=https://github.com/70-DIDIER/CECT-frontend.git
EXPECTED_ADMIN=https://github.com/70-DIDIER/cect-admin.git

assert_git_origin() {
  local source=$1 url=$2 actual
  actual="$(git -C "$source" remote get-url origin)"
  [[ "$actual" == "$url" ]] || {
    echo "SOURCE_INTERDITE $source $actual" >&2
    exit 1
  }
  [[ -z "$(git -C "$source" status --porcelain)" ]] || {
    echo "MODIFICATIONS_LOCALES_NON_VALIDEES $source" >&2
    exit 1
  }
  printf 'DIDIER_REPO_OK %s -> %s (%s)\n' "$source" "$actual" "$(git -C "$source" rev-parse --short HEAD)"
}

assert_git_origin "$API" "$EXPECTED_API"
assert_git_origin "$FRONT" "$EXPECTED_FRONT"
# package-lock.json absent du dépôt historique peut être généré à l'installation ;
# n'inspecter ici que les changements des fichiers suivis par Git pour l'admin.
admin_remote="$(git -C "$ADMIN" remote get-url origin)"
[[ "$admin_remote" == "$EXPECTED_ADMIN" ]] || { echo "SOURCE_ADMIN_INTERDITE $admin_remote" >&2; exit 1; }
[[ -z "$(git -C "$ADMIN" diff --name-only)" ]] || { echo "SOURCE_ADMIN_MODIFIEE" >&2; exit 1; }
echo "DIDIER_REPO_OK $ADMIN -> $EXPECTED_ADMIN ($(git -C "$ADMIN" rev-parse --short HEAD))"

[[ -L "$LINKS/frontend" && -L "$LINKS/admin" ]] || { echo "LIENS_RELEASES_MANQUANTS" >&2; exit 1; }
active_front="$(readlink -f "$LINKS/frontend")"
active_admin="$(readlink -f "$LINKS/admin")"
case "$(basename "$active_front")" in frontend-didier-*|frontend-5f4f2b6*) ;; *) echo "FRONTEND_LEGACY $active_front" >&2; exit 1;; esac
case "$(basename "$active_admin")" in admin-didier-only-*|admin-c02ce90*) ;; *) echo "ADMIN_LEGACY $active_admin" >&2; exit 1;; esac
[[ -f "$active_front/index.html" && -f "$active_admin/index.html" ]] || { echo "RELEASE_HTML_ABSENT" >&2; exit 1; }
[[ ! -e "$active_admin/pilot" ]] || { echo "PILOT_MODSON_ACTIF" >&2; exit 1; }

for p in "$LEGACY/CECET" "$LEGACY/CECT_admin" \
 "$LEGACY/publish-four-repos.sh" "$LEGACY/rollback-four-repos.sh" \
 "/home/ubuntu/cect-releases/frontend-modson-7d1ca9d-fourrepos" \
 "/home/ubuntu/cect-releases/admin-didier-c02ce90-plus-modson-c72a268"; do
  [[ ! -e "$p" ]] || { echo "ANCIEN_DEPOT_REACTIVABLE $p" >&2; exit 1; }
done

[[ "$(systemctl show -p WorkingDirectory --value cect-queue.service)" == "$API" ]] || {
 echo "WORKER_API_NON_DIDIER" >&2
 exit 1
}
for uri in \
 https://13-49-203-235.sslip.io/ \
 https://admin.13-49-203-235.sslip.io/admin \
 https://api.13-49-203-235.sslip.io/api/v1/health; do
 curl -fsS --max-time 12 -o /dev/null "$uri"
 echo "HTTPS_OK $uri"
done

[[ "$(curl -fsS --max-time 12 https://admin.13-49-203-235.sslip.io/admin | sha256sum | cut -d' ' -f1)" == "$(sha256sum "$active_admin/index.html" | cut -d' ' -f1)" ]] || {
 echo "NGINX_ADMIN_RELEASE_MISMATCH" >&2
 exit 1
}
[[ "$(curl -fsS --max-time 12 https://13-49-203-235.sslip.io/ | sha256sum | cut -d' ' -f1)" == "$(sha256sum "$active_front/index.html" | cut -d' ' -f1)" ]] || {
 echo "NGINX_FRONTEND_RELEASE_MISMATCH" >&2
 exit 1
}

echo "DIDIER_ONLY_VERIFIED"
echo "ACTIVE_FRONTEND=$active_front"
echo "ACTIVE_ADMIN=$active_admin"
