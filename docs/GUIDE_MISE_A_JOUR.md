# Guide : installer cette mise à jour (v4)

Le zip ne contient PAS `js/config.js` (votre fichier avec vos clés reste donc intact) mais un modèle `js/config.exemple.js`.

## 1. Base de données (Supabase) — une seule action
Supabase → votre projet → **SQL Editor → New query** → collez le contenu de `database/05_avis.sql` → **Run** (cliquez « Run this query » si un avertissement apparaît). Résultat attendu : « Success ». Cela crée les avis et les notes. Sans cette étape, le site fonctionne mais la section Avis reste masquée.

## 2. Fichiers du site
1. Extrayez le zip. Copiez TOUT le contenu du dossier `immo-ci` extrait dans votre dossier de projet, en choisissant « Remplacer les fichiers ».
2. Vérifiez que `js/config.js` existe et contient votre URL et votre clé. S'il n'existe pas : copiez `config.exemple.js` en `config.js` et remplissez-le (URL et clé : Supabase → Project Settings → API Keys).
3. Le numéro du support (+225 05 44 40 88 52) est déjà intégré au code ; il peut aussi être défini dans `config.js` (`SUPPORT_WHATSAPP: "2250544408852"`).

## 3. Test en local
VS Code → clic droit sur `index.html` → Open with Live Server → Ctrl+F5.

## 4. GitHub
Votre dépôt → **Add file → Upload files** → glissez le CONTENU du dossier du projet (index.html, css, js, assets, database, docs…) → **Commit changes**. Attendez 1 à 3 minutes, puis Ctrl+F5 sur le lien du site.
