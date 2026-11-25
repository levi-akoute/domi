# CHANGELOG : Domi, site de location de maisons

## v8.0 « visites, carte et vidéos » (2026-11-24)

### Visites et partage
- Bouton « Planifier une visite » : jour (les 7 prochains), moment, visite sur place ou en appel vidéo. La demande part
  sur WhatsApp, déjà écrite, avec le rappel « ne payez rien avant d'avoir visité ». Bouton aussi dans la barre du bas
  sur téléphone.
- Partage : WhatsApp, Facebook et « Copier le lien » (remplace l'ancien bouton unique). Visible seulement pour une
  annonce publiée.

### Photos plus légères dans les listes
- Chaque photo est envoyée en deux tailles : grande (1 280 px) et miniature (480 px, environ 4 fois plus légère,
  mesuré). Les listes utilisent la miniature ; une ancienne photo sans miniature retombe sur la grande.

### Carte et itinéraire
- L'annonceur place une épingle (sa position ou à la main). Les visiteurs voient une zone d'environ 300 m, jamais le
  point exact (même avec F12). Le point exact est donné au clic sur « Itinéraire », si l'annonceur l'accepte, et ouvre
  Google Maps. La carte (OpenStreetMap, Leaflet rangé dans le projet) ne se charge qu'au clic.
- Une épingle déplacée renvoie l'annonce d'un compte non vérifié en validation.

### Vidéos
- Vidéo de 2 à 3 minutes envoyée sur Domi (plus de lien TikTok, YouTube…). Elle est réduite dans le téléphone
  (854 px, 0,8 Mbit/s au maximum : 18 Mo au plus pour 3 minutes) avant l'envoi, avec une fenêtre d'avancement et un bouton « Annuler ».
- Fiche : la vidéo joue dans la page après un appui, rien n'est téléchargé avant. Une photo choisie arrête la vidéo.
- Suppression : la vidéo et l'annonce disparaissent ensemble.

### Admin
- Panneau « Espace utilisé » : poids des photos, vidéos et pièces d'identité par rapport à 1 Go gratuit.
- Lien « Emplacement exact » sur chaque annonce (pour vérifier l'épingle).

### Base de données
- `database/14_carte_videos.sql` : quota de 400 photos (miniatures), colonnes latitude, longitude et itineraire,
  `annonces_publiques` renvoie la zone, `itineraire_annonce`, dossier `videos`, `espace_utilise`.
  ⚠ Après une relance du fichier 11 ou 13, relancer le 14. Testé dans un PostgreSQL local (35 contrôles) : une faille
  trouvée et corrigée (position à moitié remplie).

### Pages légales
- Confidentialité et conditions mises à jour (vidéo, épingle, OpenStreetMap, Google Maps).

## v7.4 « sauvegardes » (2026-11-23)

### Pourquoi
- L'offre gratuite de Supabase ne fait aucune sauvegarde : une annonce effacée par erreur, ou une mauvaise
  commande SQL, était perdue pour toujours.

### Ajouté
- `scripts/sauvegarder.mjs` (`npm run sauvegarder`) : copie sur le PC les tables (profils, annonces, avis,
  signalements, demandes de badge) et les photos des annonces (seulement les nouvelles à chaque fois). Jamais les
  pièces d'identité. Aucune donnée modifiée.
- Connexion avec le compte admin (numéro et mot de passe dans `.env`) : mêmes droits que la page admin, jamais la clé
  `service_role`. Le script ferme sa propre session à la fin.
- Les sauvegardes de plus de 3 semaines sont effacées à chaque lancement : lancé chaque semaine, le script ne
  garde aucune copie plus de 4 semaines (promesse « compte supprimé en 30 jours »).
- Garde-fous : refuse un compte non admin et une copie incomplète, n'envoie le mot de passe qu'au projet Supabase,
  s'arrête si une clé secrète est écrite dans `js/config.js`, refuse un dossier de sauvegarde situé dans le projet,
  ne laisse jamais une sauvegarde à moitié faite.
- `docs/SAUVEGARDE.md` : mode d'emploi.
- Testé contre une fausse base Supabase locale (53 contrôles), et avec les vraies règles SQL dans un PostgreSQL local :
  l'admin lit bien toutes les lignes des 5 tables (13 contrôles).

### Modifié
- `confidentialite.html` (section 5) : mention des copies de sauvegarde, de leur durée et de ce qu'elles ne
  contiennent pas.
- `docs/GUIDE_MISE_EN_LIGNE.md` : passer à l'offre payante n'est plus nécessaire au lancement.
- `docs/AVANT_LANCEMENT.md` : étape 8 (sauvegarde) et rappel dans la suppression d'un compte.
- `README.md` : commande de sauvegarde, et fichiers SQL `01` à `13` (au lieu de `09`).

## v7.3 « annonces confidentielles » (2026-11-21)

### Ce qu'un curieux voit avec F12 (Inspecter)
- Avant : la base renvoyait TOUTES les colonnes des annonces publiées. Une seule requête donnait le
  numéro de tous les annonceurs, et chaque annonce montrait ses vues, ses clics WhatsApp, son repère,
  ses dates et l'identifiant de son propriétaire.
- `database/13_annonces_confidentielles.sql` : les visiteurs lisent les annonces par la fonction
  `annonces_publiques()`, qui ne renvoie que ce que le site affiche. La table complète n'est plus
  lisible que par son propriétaire et l'admin. Même principe pour les avis (`avis_publics`) :
  l'identifiant de l'auteur ne sort plus.
- Le numéro de l'annonceur n'est plus dans la page. Il est demandé au clic sur « Contacter sur
  WhatsApp » ou « Appeler », une annonce à la fois (`contacter_annonce`, qui compte aussi le clic).
  Si le navigateur bloque l'ouverture de WhatsApp, un message invite à toucher de nouveau le bouton.
- Le champ « Repère » n'est plus public (texte d'aide du formulaire corrigé).
- Le site fonctionne avant ET après l'exécution du fichier 13 (repli automatique sur l'ancienne table).
- `database/99_verifier_installation.sql` (lecture seule) : une ligne par fichier SQL, ✅ installé ou
  ❌ manque, pour voir d'un coup ce qui a été exécuté dans Supabase.
- Limite honnête : un programmeur peut encore demander les numéros annonce par annonce, comme sur
  tous les sites d'annonces. Mais il n'y a plus de liste complète en une requête.

### Vérifié dans Edge (2026-11-21)
- 14 scénarios avec le vrai code du site et une base simulée (avant et après le fichier 13), plus la
  vraie base en lecture seule : catalogue, accueil, favoris, page annonce (ordinateur et téléphone),
  annonce déjà louée, en attente, plus disponible, ouverture bloquée, version construite.
- Aucun numéro, repère, nombre de vues ni identifiant dans la page avant le clic ; une seule demande
  de numéro par page ; 0 erreur console (hors le 404 attendu tant que le fichier 13 n'est pas exécuté).

## v7.2 « vitrine photo et À la une » (2026-11-21)

### Accueil
- Les 3 bannières de texte sont supprimées. Titre, recherche et bandeau « Ne payez rien avant
  d'avoir visité le logement » sont FIXES ; seules des photos d'annonces défilent (vitrine).
- Ordinateur : bloc en deux parties (texte et recherche à gauche, photos 4:3 à droite).
  Téléphone : titre, photos, recherche, bandeau.
- Vitrine : 6 photos au maximum, « À la une » d'abord puis les dernières annonces ; photos de
  moins de 800 px écartées (floues en grand) ; 5 s par photo ; arrêt dès qu'on touche ;
  bouton pause / lecture ; pause au survol. Aucune bonne photo : bannière fixe de secours.
- « Vous avez un bien à louer ? » descend en bas de l'accueil (bloc vert).

### « À la une » (mise en avant)
- `database/12_a_la_une.sql` : colonne `a_la_une_jusqu_au` (date de fin, fin automatique),
  modifiable seulement par un admin, propriétaires vérifiés seulement, 93 jours au maximum.
- Admin › Annonces : colonne « À la une » (7 jours, 30 jours, +7 j, +30 j, Retirer), filtre
  « À la une », alerte si la photo est trop petite pour la vitrine.
- Étiquette « À la une » sur la vitrine et les cartes ; en tête de l'accueil et de la page
  Annonces (tri par défaut), dans un ordre tiré au hasard à chaque visite.

### Corrections
- Le point actif du carrousel s'affichait en grosse pilule orange (44 × 24 px au lieu de 30 × 10 px) :
  son « background » annulait le réglage de la v7 (zone tactile agrandie). Défaut présent depuis la v7.
- Petites cartes sur téléphone : étiquettes « Vidéo » et « À la une » compactes, elles ne se touchent pas.

### Vérifié dans Edge (2026-11-21)
- 14 scénarios (ordinateur 1280 et 950 px, tablette 820 px, téléphone 375 px ; vitrine pleine,
  1 photo, photos trop petites, aucune annonce ; vraies annonces en source et en version construite ;
  catalogue ; admin) : 0 erreur console, aucune page plus large que l'écran.
- Défilement toutes les 5 s, pause, arrêt au toucher, glissement ; avec « animations réduites »
  (Windows ou téléphone), la vitrine démarre en pause (bouton ▶).

### Sécurité
- `database/12` verrouille les rôles : plus personne ne peut changer un rôle depuis le site,
  même un admin. Seul le SQL Editor de Supabase le peut.

## v7.1 « audit de sécurité » (2026-11-18)

Audit complet : code SQL, Edge Function et JavaScript, historique Git (aucun secret), tests en ligne en
visiteur anonyme (toutes les données sensibles bien protégées). 12 failles trouvées, aucune critique,
toutes corrigées. Détail et gravité : `docs/SECURITE.md`. À faire par Levi : `docs/AVANT_LANCEMENT.md` (2 bis).

- `database/11_audit_securite.sql` : essais des codes de récupération atomiques (prise de contrôle de compte
  par requêtes simultanées), numéro du profil lié à l'identifiant de connexion, dates fixées par le serveur
  (limites anti-spam contournables), signalements par comptes jetables neutralisés, quotas de stockage,
  photos limitées au stockage Domi, vidéos limitées aux plateformes connues, numéro de contact changé →
  revalidation, chemin des pièces d'identité contrôlé, liste publique des photos fermée, droits des fonctions.
- Edge Function `reinitialiser-mot-de-passe` : utilise les fonctions verrouillées, déconnecte tous les
  appareils après un changement de mot de passe, n'affiche plus les messages d'erreur techniques.
- CSP de toutes les pages : seul le fichier exact de la librairie Supabase et notre projet Supabase sont
  autorisés (scripts, connexions, images) ; CSP stricte sur `offline.html`.
- Anti-cadre (clickjacking) : page cachée si elle est affichée dans le cadre d'un autre site, même « sandbox ».
- Photos effacées du stockage avec l'annonce et lors de leur remplacement.
- Formulaire de publication : lien vidéo vérifié, avertissement « visible publiquement » sur le repère.
- Vérifié dans Edge après correction : 12 pages, 0 erreur console, photos et annonces chargées.

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
