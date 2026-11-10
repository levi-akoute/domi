# CHANGELOG : Domi, site de location de maisons

## v5.0 (2026-11-10)

### Sécurité
- Liens `javascript:` bloqués (vidéo, images) côté site (`safeUrl`) et côté base (`06_securite.sql`).
- Notes et nombre d'avis protégés : un propriétaire ne peut plus les modifier.
- Audit des 31 `innerHTML` : toutes les données utilisateur passent par `escapeHtml`.

### Nouvelles fonctionnalités
- Mot de passe oublié en autonomie : code à 6 chiffres par email (Edge Function + Brevo).
- Email de récupération à l'inscription et dans « Mon espace ».
- Favoris sans compte, page `favoris.html`.
- Catalogue : budget minimum et maximum, chambres, propriétaires vérifiés, visite vidéo, tri par note
  ou par fraîcheur, filtres conservés dans l'adresse (recherche partageable).
- Modération mixte : publication immédiate pour les propriétaires vérifiés.
- Masquage automatique d'une annonce signalée par 3 sources.
- Fraîcheur : rappel à 30 jours, annonce masquée du public après 45 jours sans confirmation.
- Espace annonceur : taux de contact, cartes par annonce, alertes de fraîcheur.
- Fiche : somme à prévoir à l'entrée (avance + caution), nombre de photos, favori.

### Design et finitions
- Nouveau logo (maison + repère de localisation), icônes d'application, image d'aperçu WhatsApp.
- Administration en onglets avec vue d'ensemble, compteurs, recherche, tableaux lisibles sur mobile.
- Filtres du catalogue en panneau sur mobile ; prix visible sur les cartes compactes.
- Page 404, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `noindex` sur les pages privées.
- Code reformaté (Prettier) et commenté ; documentation `docs/COMPRENDRE_LE_CODE.md`.

## v4.1 « navigation » (2026-11-06)
- Version importée depuis `mes projets/mes projets creation de site/Domi-v4.1-navigation/immo-ci/` le 2026-11-09.
- Stack : HTML, CSS, JavaScript + Supabase (scripts SQL dans `database/`).
- Configuration : copier `js/config.exemple.js` en `js/config.js` et y renseigner l'URL et la clé anon Supabase.
