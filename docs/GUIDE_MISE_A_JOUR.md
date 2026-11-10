# Guide : installer la mise à jour v5

Ordre conseillé : **la base d'abord, le site ensuite**. Ainsi, dès que le nouveau site est en ligne,
tout ce dont il a besoin existe déjà dans Supabase.

## 1. Base de données (Supabase → SQL Editor → New query)

Exécutez ces trois fichiers **dans l'ordre**, un par un (coller → **Run**) :

| Fichier | Ce qu'il fait | Résultat attendu |
|---------|---------------|------------------|
| `database/06_securite.sql` | Bloque les liens `javascript:`, protège les notes | 2 lignes : `listings_image_http`, `listings_video_http` |
| `database/07_mot_de_passe_oublie.sql` | Email de récupération + table des codes | 1 ligne : `email_recuperation \| text` |
| `database/08_moderation_mixte.sql` | Publication directe des vérifiés, masquage après 3 signalements | 1 ligne : `auto_hide_reported_trigger` |

Lisez chaque fichier avant de l'exécuter : chaque bloc est commenté.
Si Supabase affiche « This query has destructive operations », cliquez **Run this query** : il s'agit
des `drop … if exists` qui remplacent proprement les anciennes versions.

## 2. Récupération du mot de passe (facultatif mais recommandé)

Suivez `docs/GUIDE_MOT_DE_PASSE_OUBLIE.md` (compte Brevo + Edge Function, 20 à 30 minutes).
Sans cette étape, le site fonctionne : la page « Mot de passe oublié » renvoie alors vers le support
WhatsApp, comme avant.

## 3. Site

Le dossier est relié à GitHub : la mise en ligne se fait par `git push` (ou via `/commit` avec Claude).
GitHub Pages republie le site en 1 à 3 minutes. Faites ensuite **Ctrl+F5** sur le site.

## 4. Vérifications après mise en ligne

- [ ] L'accueil et le catalogue affichent les annonces, avec le nouveau logo
- [ ] Le cœur ajoute une annonce aux favoris, la page **Favoris** la montre
- [ ] Les filtres (budget, chambres…) fonctionnent et restent dans l'adresse de la page
- [ ] **Mon espace** : statistiques, taux de contact, bloc « Email de récupération »
- [ ] **Administration** : onglets, compteurs rouges, recherche
- [ ] Partager un lien du site sur WhatsApp affiche l'image d'aperçu Domi (WhatsApp peut garder
      l'ancien aperçu en mémoire quelques heures)
