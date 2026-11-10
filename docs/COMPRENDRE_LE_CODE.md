# Comprendre le code de Domi (v5)

Ce document explique comment le site fonctionne, du navigateur jusqu'à la base de données.
Lisez-le dans l'ordre : chaque partie s'appuie sur la précédente.

---

## 1. Vue d'ensemble

Domi est un **site statique** (HTML, CSS, JavaScript, sans outil de build) relié à **Supabase**, qui
fournit trois services :

| Service Supabase | Rôle dans Domi |
|------------------|----------------|
| **Base de données** (PostgreSQL) | annonces, profils, avis, signalements… |
| **Authentification** | connexion par numéro de téléphone + mot de passe |
| **Stockage** | photos des annonces (public) et pièces d'identité (privé) |
| **Edge Functions** | code serveur : récupération du mot de passe |

Le site est hébergé gratuitement par **GitHub Pages** : chaque `git push` met le site à jour.

```
Navigateur du visiteur                         Supabase
┌──────────────────────────┐                  ┌───────────────────────────┐
│ index.html, annonces.html│                  │ Base PostgreSQL           │
│   ↓ chargent             │   requêtes HTTPS │   + règles RLS (sécurité) │
│ js/*.js ─────────────────┼─────────────────►│ Authentification          │
│   (clé anon, publique)   │                  │ Stockage (photos)         │
└──────────────────────────┘                  │ Edge Function (mdp)       │
                                              └───────────────────────────┘
```

**La règle d'or de la sécurité** : tout le JavaScript tourne chez le visiteur, qui peut le lire et le
modifier (touche F12). La vraie protection est donc **dans la base**, avec les règles RLS (Row Level
Security) écrites dans `database/*.sql`. Les filtres en JavaScript servent au confort, jamais à la sécurité.

---

## 2. L'ordre de chargement des scripts

Chaque page charge les mêmes fichiers, **dans cet ordre** :

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/..."></script> <!-- window.supabase -->
<script src="js/config.js"></script>   <!-- window.IMMOCI_CONFIG : URL, clé, communes -->
<script src="js/utils.js"></script>    <!-- window.ImmoUtils : outils + menu + favoris -->
<script src="js/storage.js"></script>  <!-- window.ImmoStorage : TOUTES les requêtes -->
<script src="js/auth.js"></script>     <!-- window.ImmoAuth : connexion, utilisateur courant -->
<script src="js/annonces.js"></script> <!-- script propre à la page -->
```

Chaque fichier dépose un objet sur `window` que les suivants utilisent. C'est une **architecture en
couches** : les pages ne parlent jamais directement à Supabase, elles passent par `ImmoStorage`.

### Le motif IIFE

```js
(function () {
  const C = window.IMMOCI_CONFIG || {}; // variable PRIVÉE au fichier
  // ...
  window.ImmoUtils = { money, escapeHtml /* … */ }; // seule chose partagée
})();
```

La fonction s'exécute immédiatement et enferme ses variables : deux fichiers peuvent déclarer `const C`
sans conflit.

### Pourquoi `utils.js` peut utiliser `ImmoAuth` chargé après lui

`renderChrome()` (qui dessine le menu) est lancé sur l'événement `DOMContentLoaded`, déclenché quand
**toute** la page et tous les scripts sont lus. À ce moment, `auth.js` est chargé.

---

## 3. Les fichiers JavaScript

| Fichier | Page(s) | Rôle |
|---------|---------|------|
| `config.js` | toutes | Réglages : URL Supabase, clé anon, numéro du support, communes |
| `utils.js` | toutes | Icônes, format des prix, `escapeHtml`, `safeUrl`, favoris, menu et pied de page |
| `storage.js` | toutes | Toutes les requêtes vers la base, l'envoi des photos, l'appel à l'Edge Function |
| `auth.js` | toutes | Inscription, connexion, utilisateur courant, garde des pages privées |
| `home.js` | index | Carrousel de l'accueil |
| `annonces.js` | index, annonces, favoris | Carte d'annonce, catalogue et filtres, dernières annonces |
| `favoris.js` | favoris | Charge et affiche les annonces favorites |
| `detail.js` | maison-detail | Fiche complète, galerie, contact, signalement, avis |
| `publier.js` | publier | Formulaire de publication et de modification |
| `dashboard.js` | dashboard-proprietaire | Espace annonceur : statistiques, annonces, badge, sécurité |
| `admin.js` | admin | Administration en onglets |
| `connexion.js` | connexion | Onglets connexion / inscription |
| `recovery.js` | mot-de-passe-oublie | Récupération du mot de passe en 2 étapes |
| `support.js` | support | Liens WhatsApp du support |

---

## 4. Parcours d'un visiteur

1. **Accueil** (`index.html`) : `annonces.js` appelle `ImmoStorage.getAnnonces()`, garde les annonces
   disponibles et les transforme en cartes HTML avec `card(a)`.
2. **Catalogue** (`annonces.html`) : toutes les annonces sont chargées **une seule fois**, puis filtrées
   dans le navigateur (`filtered()`). Chaque changement de filtre réaffiche instantanément, sans
   nouvelle requête. Les filtres sont recopiés dans l'adresse (`?commune=Cocody&budget=150000`) : on peut
   partager une recherche.
3. **Fiche** (`maison-detail.html?id=…`) : `getAnnonce(id)`, compteur de vue (une fois par session),
   bouton WhatsApp qui ouvre `wa.me/225XXXXXXXXXX` et compte le clic.
4. **Favoris** : le cœur appelle `ImmoUtils.Favoris.toggle(id)`, qui range l'identifiant dans le
   `localStorage` du navigateur (pas besoin de compte).

### Ce que fait `getAnnonces()`

```js
L().select("*")
  .eq("moderation", "approuvee")            // validées
  .gte("confirmee_le", limiteFraicheur())   // confirmées il y a moins de 45 jours
  .order("created_at", { ascending: false })
  .limit(500);
```

En SQL : `SELECT * FROM listings WHERE moderation='approuvee' AND confirmee_le >= … ORDER BY
created_at DESC LIMIT 500`.

---

## 5. Parcours d'un propriétaire

1. **Inscription** : le numéro devient un identifiant interne `0700000000@immoci.app` (Supabase exige
   un email). Le trigger SQL `handle_new_user` crée le profil. **Ne changez jamais `EMAIL_DOMAIN`** : tous
   les comptes existants ne pourraient plus se connecter.
2. **Publication** : les photos sont compressées dans le navigateur (WebP, 1280 px) puis envoyées dans
   le dossier `annonces/<id-utilisateur>/`. La règle de stockage refuse tout autre dossier.
3. **Modération mixte** (trigger `protect_listing`, `database/08`) :
   - propriétaire **vérifié** → annonce publiée immédiatement ;
   - **non vérifié** → « en attente » jusqu'à la validation de l'admin.
4. **Fraîcheur** : sans « Confirmer à jour » pendant 30 jours, un rappel s'affiche ; à 45 jours,
   l'annonce disparaît du catalogue public (réglages `JOURS_RAPPEL` et `JOURS_MASQUAGE` dans `utils.js`).

---

## 6. La sécurité, couche par couche

| Menace | Protection | Où |
|--------|------------|-----|
| Injection de code dans un titre ou une description | `escapeHtml()` avant tout `innerHTML` | `utils.js` |
| Lien `javascript:` dans la vidéo | `safeUrl()` + contrainte SQL `^https?://` | `utils.js`, `06_securite.sql` |
| Un utilisateur se donne le rôle admin | trigger `protect_profile` | `01_schema_supabase.sql` |
| Un propriétaire valide sa propre annonce ou truque ses vues | trigger `protect_listing` | `06`, `08` |
| Un propriétaire truque ses notes | `protect_listing` remet les anciennes valeurs | `06_securite.sql` |
| Lecture des annonces non validées d'autrui | règle RLS `listing_read` | `01_schema_supabase.sql` |
| Accès aux pièces d'identité | bucket privé + lien signé de 5 minutes | `01`, `storage.js` |
| Vol de la clé `service_role` | elle n'existe que dans l'Edge Function, jamais dans le site | `supabase/functions/` |
| Deviner qui est inscrit via « mot de passe oublié » | réponse identique que le numéro existe ou non | Edge Function |

### Pourquoi la clé dans `config.js` peut être publique

C'est la clé **anon** : elle donne exactement les droits d'un visiteur anonyme, ni plus ni moins. Ce
sont les règles RLS qui décident ce qu'un visiteur peut lire ou écrire. La clé `service_role`, elle,
ignore toutes les règles : elle ne doit **jamais** apparaître dans le site.

---

## 7. La base de données (fichiers `database/`)

| Fichier | Contenu |
|---------|---------|
| `01_schema_supabase.sql` | Tables, triggers, règles RLS, stockage |
| `02_donnees_exemple.sql` | Annonces fictives pour tester |
| `03_creer_admin.sql` | Donner le rôle admin à un compte |
| `04_reinitialiser_mot_de_passe.sql` | Réinitialisation manuelle (solution de secours) |
| `05_avis.sql` | Avis et notes |
| `06_securite.sql` | **v5** : liens `javascript:` bloqués, notes protégées |
| `07_mot_de_passe_oublie.sql` | **v5** : email de récupération, table des codes |
| `08_moderation_mixte.sql` | **v5** : publication directe des vérifiés, masquage après 3 signalements |

### Les tables principales

```
profiles (1) ──< listings (N) ──< reviews (N)
    │                  └────────< reports (N)
    └──< verification_requests (N)
password_resets : codes de récupération (inaccessible depuis le site)
```

### Le « laissez-passer » `immoci.bypass`

Les fonctions internes (compteur de vues, recalcul des notes, masquage automatique) doivent modifier
des colonnes protégées. Elles activent `set_config('immoci.bypass','1',true)` le temps d'une
transaction : `protect_listing` les laisse passer. Le site ne peut pas l'activer lui-même, car il
n'exécute pas de SQL libre.

---

## 8. Pistes pour aller plus loin

- **Modules ES** (`import` / `export`) à la place des objets sur `window` : dépendances explicites.
- **Pagination côté serveur** (`.range()`) quand il y aura plusieurs centaines d'annonces.
- **Tests automatiques** des règles RLS (essayer d'écrire ce qui doit être refusé).
- **Carte** des logements (Leaflet + OpenStreetMap, gratuit).
