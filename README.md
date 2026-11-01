# Domi — plateforme de location immobilière (v3, nouvelle identité)

Site statique (HTML/CSS/JS) + base Supabase. **Même base de données et même `js/config.js` que la v2 : aucune nouvelle procédure.**

## Mise à jour depuis la v2
1. Gardez votre fichier **`js/config.js`** (il contient vos clés). Ne le remplacez pas.
2. Remplacez tout le reste du dossier par celui de ce zip.
3. Ctrl+F5 dans le navigateur.

## Changer le nom du site
Dans VS Code : **Ctrl+Maj+H** → rechercher `Domi` → remplacer par le nouveau nom → *Remplacer tout*. Ne modifiez pas `EMAIL_DOMAIN` dans `config.js` (identifiant interne des comptes).
Le logo est dans `js/utils.js` (constante `MARK`) et `assets/img/favicon.svg`. Les couleurs sont les variables en haut de `css/style.css`.

## Mise en route, base de données, admin
Voir `docs/GUIDE_MISE_EN_LIGNE.md` (inchangé).
