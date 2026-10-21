# CECT Admin — Portail de gestion et de supervision

**Branche de travail : `custum` (70-DIDIER/cect-admin).** L'espace public/membres se trouve dans [CECT-frontend](https://github.com/70-DIDIER/CECT-frontend/tree/custum) ; l'API Laravel dans [cecet-api](https://github.com/70-DIDIER/cecet-api/tree/custum).

> **Reproduire la plateforme CECT en local :** [Guide d'installation et de parité fonctionnelle des trois dépôts](https://github.com/70-DIDIER/cecet-api/blob/custum/docs/REPRODUCTION_LOCALE_CECT.md). Le guide explique PostgreSQL, les paramètres métier versionnés, les contrôles de conformité et le Superadmin mTLS. Il est indispensable avant toute proposition.

## Stack et architecture

React 18, TypeScript, Vite et Tailwind. Console réservée à l'Administrateur, la Comptabilité et au Superadmin, selon les permissions de l'API. Fonctions : pilotage, adhérents, packs/quota/cashback, pays de réception, opérations YEM, validations, paiements, finance, équipe, paramètres, exports, audit, sécurité Superadmin. Le rôle interne `Validateur` a été supprimé de notre modèle métier (responsabilités transférées à Comptabilité).

La branche `custum` comprend la page de gestion des **pays de réception** sur `/admin/pays`. Le cashback est paramétré essentiellement au niveau des versions de packs ; ne pas réintroduire l'ancien menu de `main` en écrasant les changements.

## Préparer le projet

Node.js **22** et npm, l'API CECT locale sur le port 8000, PostgreSQL côté backend. Depuis un répertoire parent du workspace :

```bash
git clone --branch custum https://github.com/70-DIDIER/cect-admin.git
cd cect-admin
cp .env.example .env
npm install
npm run dev
```

Configuration `.env` **uniquement locale** :

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPERADMIN_PATH_MODE=false
VITE_STAFF_GUARDIAN_ENABLED=false
```

Interface : `http://localhost:5174/connexion` ; après authentification et permissions, `/admin`, `/admin/packs`, `/admin/pays`, `/admin/configuration`. Le serveur Vite démarre sur **5174 en port strict**. L'API doit autoriser `http://localhost:5174` dans CORS/Sanctum. Les cookies de session, CSRF et l'OTP sont gérés par l'API, pas par un faux compte de frontend.

Le dépôt ne contient actuellement **pas** de `package-lock.json` suivi dans Git : `npm install` est nécessaire et la résolution des dépendances peut varier. Ne pas promettre un build identique octet pour octet sans lockfile. Une PR contrôlée pourra ensuite en introduire un.

## Deux profils à distinguer

**Démo locale simple (non équivalente à la sécurité staging) :** backend sur `127.0.0.1`, `SUPERADMIN_MTLS_ENABLED=false`, `STAFF_GUARDIAN_LOGIN_ENABLED=false`; UI ordinaire. Utiliser **uniquement des comptes fictifs locaux** et des identifiants de démo spécifiques. Cela permet de travailler sur l'interface et les parcours métiers, **pas** de tester la protection Superadmin de production/staging.

**Parité Superadmin sécurisée :** le serveur de référence bloque `/superadmin/connexion` sans certificat client valide (HTTP 403). Pour le reproduire, construire un Nginx HTTPS **local**, avec une **CA de test indépendante**, certificat navigateur, CRL, preuve FastCGI sur la même origine, utilisateur Superadmin local sans secrets réels, puis activer `SUPERADMIN_MTLS_ENABLED=true` et compiler l'administration avec les paramètres appropriés :

```bash
VITE_SUPERADMIN_PATH_MODE=true npm run build
```

**Attention :** cette option n'installe **ni** Nginx **ni** mTLS ; elle ne fait qu'activer la logique de routage côté client. **Il est interdit de contourner le serveur mTLS avec un simple flag Vite ou de copier les certificats et le fichier `.cectkey` réels.** Références :
- [Sécurité et configuration Superadmin](https://github.com/70-DIDIER/cecet-api/blob/custum/docs/SECURITE_SUPERADMIN_MTLS.md)
- [Nginx mTLS — exemple](https://github.com/70-DIDIER/cecet-api/blob/custum/deploy/nginx/cect-superadmin-mtls.conf.example)
- [Mode chemin sur hôte admin](https://github.com/70-DIDIER/cecet-api/blob/custum/deploy/nginx/cect-superadmin-path-mtls.snippet.conf)

Le flux Guardian (authentification du personnel) est commandé par **une configuration backend et un flag frontend coordonnés** ; ne pas activer l'un sans l'autre.

## Tests et contributions

```bash
npm run lint
npm run build
node scripts/test-superadmin-key-crypto.cjs
```

Puis tester au navigateur : authentification ordinaire, permissions, restrictions, affichage des paramètres et packs, modification locale contrôlée des pays, puis refus d'accès Superadmin non certifié si le profil mTLS est configuré. Les contrôles GitHub Actions des derniers commits `custum` étaient en échec lors de l'audit initial ; une PR doit contenir un relevé de tests réellement exécutés.

Créer les propositions sur `feat/ma-proposition` depuis `custum`, ouvrir une **pull request vers `custum`**, documenter comportement avant/après et impact sur l'API et les autres interfaces. Ne pas déployer sur le serveur sans revue.

## Staging observé le 21/10/2026

Serveur : console sur `https://admin.13-49-203-235.sslip.io`, release active alors nommée `admin-superadmin-merchant-pricing-v511-20261020`. Page de connexion ordinaire 200 ; accès `/superadmin/connexion` sans certificat 403. **Le hash du code ayant produit cette release n'a pas été attesté.** La branche `custum` peut avoir évolué depuis ce build ; appliquer et tester les différences, ne jamais affirmer qu'un simple clone donne exactement les octets servis.

**Ne jamais versionner :** les fichiers `.env`, mots de passe, OTP, certificats utilisateur, autorités privées, clés `.cectkey`, historiques financiers réels ou dumps de PostgreSQL.
