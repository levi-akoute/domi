# CHANGELOG : Domi, site de location de maisons

## v7.0 « pré-lancement » (2026-11-17)

Tout ce qui est indispensable avant de présenter le site et d'acheter le nom de domaine.
Ce qui reste à faire par Levi (informations personnelles, SQL, annonces d'exemple) : `docs/AVANT_LANCEMENT.md`.

### Pages légales
- `confidentialite.html` réécrite d'après ce que le code fait réellement : données collectées, utilité et durée
  de chaque donnée, stockage dans le navigateur (pas de cookie publicitaire, donc pas de bandeau), prestataires
  (Supabase, Brevo, GitHub Pages, Google Fonts, jsDelivr, WhatsApp), droits et marche à suivre pour la suppression, ARTCI.
- `conditions.html` complétée : éditeur, compte, règles de publication, interdictions, sanctions, contenus, droit ivoirien.
- Les informations que seul Levi connaît sont surlignées en jaune (`.a-completer`) ; `npm run build` les compte.

### Pièces d'identité supprimées après décision
- `database/10_suppression_pieces_identite.sql` : l'admin peut supprimer les fichiers du bucket `verifications`,
  fonction `forget_verification_document`.
- Admin : valider ou refuser une demande supprime aussitôt la pièce ; bouton « Effacer le document » pour les anciennes.

### Référencement et partage
- Titre unique (moins de 60 caractères) et description unique (moins de 155) sur chaque page ; avant, les
  14 pages avaient la même description.
- `og:url`, `link rel="canonical"`, `twitter:title` et `twitter:description` ; `noindex` sur les favoris.

### Anti-spam
- Champ piège invisible (honeypot) et chronomètre sur l'inscription et le signalement d'annonce
  (`protectForm` / `botCheck` dans `js/utils.js`). Les limites en base (database/09) restent la vraie protection.

### Mobile et accessibilité (audit automatique à 375 px et 1280 px)
- Corrigé : la page d'une annonce défilait horizontalement sur téléphone (646 px au lieu de 375), comme
  « Mot de passe oublié » (448 px). Cause : colonnes de grille sans `min-width: 0` et boutons sans retour à la ligne.
- Contraste WCAG AA : « 01…05 » des conseils et « 404 » en orange foncé (2,7:1 → plus de 4,5:1).
- Pastilles « Disponible » et « Vérifié » agrandies sur mobile (9,9 px → 11 px).
- Zones tactiles : points du carrousel 24 × 24 px, croix 40 × 40 px, listes de recherche 44 px de haut.
- Liens : aucun lien brisé (pages, images, scripts, liens externes).

### Nom de domaine
- `scripts/changer-domaine.mjs` : remplace l'adresse du site partout en une commande.
- `docs/GUIDE_NOM_DE_DOMAINE.md` : DNS, GitHub Pages (HTTPS forcé), Supabase, Brevo, Google Search Console.

## v6.0 (2026-11-10)

### Application installable (PWA)
- Service worker `sw.js` (stratégie « réseau d'abord ») et page `offline.html` hors connexion.
- Bouton « Installer l'appli » (menu et pied de page), bandeau sur téléphone, aide pour iPhone.
- Manifeste complété : raccourcis (Annonces, Favoris, Mon espace), orientation, catégories.

### Sécurité
- Politique de sécurité du contenu (CSP) sur toutes les pages ; plus aucun JavaScript ni style dans le HTML.
- Empreinte SRI sur la librairie Supabase, politique de référent stricte.
- Protection anti-clickjacking et avertissement anti-arnaque dans la console.
- `database/09_securite_renforcee.sql` : limites anti-spam (annonces, signalements, vérifications),
  numéro de téléphone verrouillé, tailles maximales, fonction interne protégée.
- Edge Function : appels limités au site (CORS), comparaison à temps constant, ménage des vieux codes.
- Favoris : identifiants vérifiés avant envoi à la base.
- Publication par GitHub Actions d'une version minifiée sans commentaires (`scripts/build.mjs`) ;
  `database/`, `docs/` et `supabase/` ne sont plus publiés sur le site. Voir `docs/SECURITE.md`.

### Code commenté
- Tous les fichiers JavaScript, le CSS (réorganisé en 22 sections, sans couches contradictoires,
  classes inutilisées retirées) et les 15 pages HTML sont commentés ligne par ligne ou bloc par bloc.
- Correction : l'attribut `hidden` ne cachait pas les éléments ayant un `display` imposé (flèches du plein écran).

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
