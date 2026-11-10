# Domi : plateforme de location de logements (v6)

Site statique (HTML, CSS, JavaScript) + base Supabase, hébergé sur GitHub Pages :
https://levi-akoute.github.io/domi/

## Documentation

| Document | Pour quoi faire |
|----------|-----------------|
| `docs/COMPRENDRE_LE_CODE.md` | Comprendre l'architecture, chaque fichier, la sécurité |
| `docs/GUIDE_MISE_A_JOUR.md` | Installer la v6 (SQL 09, fonction serveur, publication automatique) |
| `docs/SECURITE.md` | Ce qui est protégé, la question « Inspecter », réglages Supabase |
| `docs/GUIDE_MOT_DE_PASSE_OUBLIE.md` | Activer la récupération du mot de passe par code email |
| `docs/GUIDE_MISE_EN_LIGNE.md` | Première installation complète |
| `CHANGELOG.md` | Historique des versions |

## Repères

- Base de données : `database/01` à `09`, à exécuter dans l'ordre dans Supabase → SQL Editor.
- Fonction serveur : `supabase/functions/reinitialiser-mot-de-passe/index.ts`.
- Configuration : `js/config.js` (URL et clé **anon** uniquement, jamais la clé `service_role`).
- Couleurs : variables en haut de `css/style.css`. Logo : `MARK` dans `js/utils.js` et `assets/img/`.
- Mise en forme du code : `npx prettier --write .` (réglages dans `.prettierrc.json`).
- Publication : `git push` → GitHub Actions lance `npm run build` et publie `dist/` (version minifiée).
- Application installable : `manifest.webmanifest` + `sw.js` (service worker) + `offline.html`.
- Support : WhatsApp (numéro réglé dans `js/config.js`).
