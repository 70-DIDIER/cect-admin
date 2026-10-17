# CECT — Déploiement exclusif à Didier (3 dépôts)

## Sources autorisées en déploiement

| Service | Dépôt source |
| --- | --- |
| API Laravel / métier | `70-DIDIER/cecet-api` |
| Site public + membres + Marchand | `70-DIDIER/CECT-frontend` |
| Back-office principal | `70-DIDIER/cect-admin` |

Les projets `Modsontech45/CECET` et `Modsontech45/CECT_admin` **ne doivent pas être utilisés dans les nouvelles releases actives**. Ne pas les détruire : les anciennes releases servent de secours temporaire.

## Constat au 17 octobre 2026

- Interface publique Didier déjà publiée : `/home/ubuntu/cect-current/frontend` -> `/home/ubuntu/cect-releases/frontend-didier-20261017T153942Z` (commit `c3a2756`).
- API sur `/var/www/cect-api`, dépôt Didier, état fonctionnel en staging.
- Administration encore composite : `/home/ubuntu/cect-current/admin` -> `/home/ubuntu/cect-releases/admin-didier-c02ce90-plus-modson-c72a268`. Le contenu pilote Modson doit être retiré par une release pure Didier.
- Nginx sert l'admin via le lien `/home/ubuntu/cect-current/admin` : aucune réécriture du backend n'est requise pour remplacer les fichiers.
- Agent AWS Remote Desktop Commander signalé hors ligne lors de la préparation de ce document. **La nouvelle release admin n'a pas été exécutée tant qu'il reste hors ligne.**

## Publication de l'administration Didier

Sur la machine AWS autorisée :

1. Vérifier la disponibilité de l'agent, l'état nginx/postgresql/php-fpm et l'accès API.
2. Vérifier le compte de service et les droits sur le chemin de publication.
3. Cloner `https://github.com/70-DIDIER/cect-admin.git` dans un nouveau dossier **indépendant** de l'ancienne source.
4. Depuis la racine clonée, exécuter :
   `CECT_STAGING_DEPLOY=YES VITE_API_URL=https://api.13-49-203-235.sslip.io bash scripts/deploy-didier-only-staging.sh`
5. Vérifier `readlink -f /home/ubuntu/cect-current/admin` : doit pointer vers une release `admin-didier-only-...`.
6. Vérifier que le nouveau répertoire **ne contient pas `pilot/`**.
7. Vérifier les endpoints `/admin`, `/admin/packs`, `/admin/configuration`, les bundles JS/CSS et l'API health.
8. Examiner `/etc/nginx/sites-enabled/cect-webapps` : si des règles dédiées `/pilot` subsistent, les désactiver avec sauvegarde, `nginx -t` puis reload ; en l'absence de règle, un accès à `/pilot` peut afficher le shell React admin par fallback, mais **aucun code pilote Modson ne doit être servi**.
9. Recette authentifiée avec comptes de staging : administration, création/édition de packs, RBAC, commandes Marchand, calculs et rapports. Respecter les règles financières, ne pas déclencher de paiement réel.

## Retour arrière

Le script enregistre et affiche la release précédente. Il restaure automatiquement le lien si les tests HTTP échouent. En cas de problème identifié ultérieurement, rétablir manuellement le lien symbolique `/home/ubuntu/cect-current/admin` vers la release antérieure, de manière atomique. Conserver les sauvegardes et ne pas supprimer PostgreSQL ni les historiques d'audit.

## Conditions de réussite

- Source du site public, de l'API et du back-office provenant uniquement des trois dépôts Didier.
- Aucune ressource de la branche pilote Modson servie en ligne ; éventuels anciens dossiers privés conservés uniquement pour rollback.
- Trois utilisateurs de recette, catalogue 25 packs (dont quatre publiés) et transactions simulées inchangés.
- Build TypeScript/Vite et Nginx HTTP/TLS vérifiés, tests de sécurité, tests métiers et parcours navigateur à documenter.
- La publication d'un frontend ne prouve pas à elle seule la conformité complète au cahier des charges.
