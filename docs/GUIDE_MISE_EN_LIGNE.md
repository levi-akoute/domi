# Guide : mettre Domi en ligne (pas à pas)

Temps estimé : 20 à 30 minutes. Aucun serveur à gérer.

## 1. Créer la base de données (Supabase)
1. Créez un compte gratuit sur **supabase.com** → **New project**. Choisissez un nom, un mot de passe de base (gardez-le), et une région en Europe (la plus proche).
2. Attendez 1 à 2 minutes que le projet soit prêt.
3. Menu **SQL Editor** → **New query**.
   - *(Seulement si vous aviez déjà lancé l'ancien schéma v1)* : exécutez d'abord `database/00_nettoyage_ancienne_version.sql`.
   - Collez tout le contenu de `database/01_schema_supabase.sql` → **Run**. Message « Success » attendu.
   - *(Optionnel, pour tester)* collez `database/02_donnees_exemple.sql` → **Run** : 4 annonces fictives apparaissent.

## 2. Régler l'authentification
Menu **Authentication** → **Providers** (ou *Sign In / Providers*) → **Email** :
- **désactivez « Confirm email »** (obligatoire : les utilisateurs se connectent avec leur numéro, pas avec un vrai email) ;
- gardez « Enable Email provider » activé.
> L'interface de Supabase évolue : si le menu a un autre nom, cherchez l'option « Confirm email ».

## 3. Connecter le site à la base
1. Menu **Project Settings** → **API** (ou bouton **Connect**).
2. Copiez **Project URL** et la clé **anon / publishable** (⚠ jamais la clé `service_role`).
3. Ouvrez `js/config.js` et remplacez :
   ```js
   SUPABASE_URL: "https://xxxxxxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   SUPPORT_WHATSAPP: "225XXXXXXXXXX",   // votre numéro de support
   ```
La clé `anon` peut être publique : ce sont les règles de sécurité (RLS) du SQL qui protègent les données.

## 4. Afficher le site sur votre ordinateur
1. Extrayez **tout** le ZIP (clic droit → Extraire tout).
2. VS Code → **Fichier > Ouvrir le dossier** → choisissez `immo-ci`.
3. Installez l'extension **Live Server**, puis clic droit sur `index.html` → **Open with Live Server**. Le site s'ouvre sur `http://127.0.0.1:5500`.
Un bandeau orange « Base de données non configurée » signifie que l'étape 3 n'est pas faite.

## 5. Accéder à la partie administrateur
1. Sur le site : **Déposer une annonce → S'inscrire** avec VOTRE numéro (10 chiffres) et un mot de passe.
2. Dans Supabase → SQL Editor, ouvrez `database/03_creer_admin.sql`, remplacez `0700000000` par votre numéro, **Run**. Votre ligne s'affiche avec `role = admin`.
3. Sur le site : **Déconnexion**, puis **reconnexion** avec le même numéro → vous arrivez directement sur **`admin.html`** (aussi accessible via « Mon espace »).
La page admin n'est pas liée dans le menu public. Même si quelqu'un devine l'adresse, la base refuse toute action sans rôle admin.

## 6. Tester le parcours complet
1. Dans une fenêtre de navigation privée, créez un 2ᵉ compte (annonceur) et publiez une annonce avec photos.
2. Elle n'est pas visible du public : elle est « En validation ».
3. Dans l'admin : **Annonces → À valider → Approuver**. Elle apparaît dans le catalogue.
4. Testez aussi : signaler une annonce, demander la vérification (CNI), la valider côté admin (badge ✓ Vérifié).

## 7. Mettre le site sur Internet
1. Hébergement gratuit : **Netlify** (netlify.com/drop : glissez le dossier `immo-ci`), **Cloudflare Pages** ou **Vercel**. Vous obtenez une adresse en `https://...`.
2. Nom de domaine (.ci ou .com) : à acheter chez un registrar, puis à relier dans l'hébergeur.
3. Dans Supabase → **Authentication → URL Configuration** : mettez votre adresse finale dans *Site URL*.

## 8. Avant d'ouvrir au public
- [ ] Supprimer les annonces d'exemple : `delete from public.listings where description like '[EXEMPLE]%';`
- [ ] Remplacer l'image du hero (`index.html`, adresse Unsplash) par une vraie photo, idéalement placée dans `assets/img/`.
- [ ] Renseigner `SUPPORT_WHATSAPP` et compléter `conditions.html` et `confidentialite.html` (à faire valider ; loi ivoirienne sur les données personnelles, ARTCI).
- [ ] Publier 20 à 30 vraies annonces vérifiées pour que le site ne soit pas vide.
- [ ] Le projet Supabase gratuit peut être mis en pause après une période d'inactivité et n'offre pas de sauvegardes complètes : passez à un plan payant dès le lancement réel.

## Mot de passe oublié
Il n'y a pas d'envoi de SMS/email. L'utilisateur contacte votre WhatsApp support (page « Mot de passe oublié »). Vous exécutez `database/04_reinitialiser_mot_de_passe.sql` avec son numéro et un mot de passe temporaire ; il le change ensuite dans « Mon espace ».

## Problèmes fréquents
| Symptôme | Solution |
|---|---|
| Bandeau « Base de données non configurée » | Étape 3 : URL/clé dans `js/config.js`, puis rechargez (Ctrl+F5) |
| « Compte créé, mais Supabase exige une confirmation » | Étape 2 : désactiver *Confirm email* |
| « Invalid API key » | Mauvaise clé copiée : prenez la clé `anon` |
| Photos qui ne s'envoient pas | Relancer `01_schema_supabase.sql` (il crée les espaces de stockage) |
| Page admin « Accès réservé » | Étape 5 : le SQL n'a pas trouvé votre numéro, ou reconnectez-vous |
| Catalogue vide | Aucune annonce *approuvée* : lancez `02_donnees_exemple.sql` ou approuvez dans l'admin |

## Ce qui reste à faire plus tard
Favoris (la table existe, pas d'interface), carte des biens, recherche côté serveur au-delà de ~500 annonces, anti-spam (captcha) sur les signalements, notifications, envoi de SMS pour la récupération de mot de passe.
