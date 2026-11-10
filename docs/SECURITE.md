# Sécurité de Domi : ce qui est protégé, et comment

## La question « Inspecter » : ce qu'il faut comprendre

**Tout ce qu'un navigateur affiche, il doit d'abord le recevoir.** Le HTML, le CSS et le JavaScript de
n'importe quel site (Facebook, Jumia, votre banque) sont donc lisibles avec « Inspecter ». Aucun site
au monde ne peut l'empêcher. Bloquer le clic droit ou la touche F12 ne sert à rien : on contourne ces
blocages en deux secondes, et ils gênent les vrais utilisateurs.

La bonne approche, celle des professionnels :

1. **Ne rien mettre de secret dans le site.** Domi n'en contient aucun : la clé `anon` de `config.js` est
   publique par conception (elle donne les droits d'un visiteur anonyme, rien de plus).
2. **Mettre la sécurité côté serveur**, là où « Inspecter » ne voit rien :
   - les règles RLS de la base (`database/*.sql`) décident qui peut lire ou écrire quoi ;
   - la clé `service_role` n'existe que dans l'Edge Function, sur les serveurs de Supabase.
3. **Rendre le code publié difficile à lire** (minification), ce qui décourage la copie facile.

### Ce que voit quelqu'un qui « inspecte » Domi en ligne

| Avant (v5) | Maintenant (v6, via GitHub Actions) |
|-----------|-------------------------------------|
| Code lisible, avec tous les commentaires | Code compacté sur quelques lignes, **aucun commentaire**, noms internes raccourcis |
| Fichiers SQL et documentation accessibles depuis le site | `database/`, `docs/`, `supabase/` **ne sont plus publiés** sur le site |
| Pages 2 fois plus lourdes | Pages 2 fois plus légères (forfait mobile des visiteurs) |

⚠ **Limite honnête** : le dépôt GitHub `levi-akoute/domi` est **public**, donc le code source commenté
reste lisible sur github.com. Pour le cacher, il faudrait un dépôt privé. Sur le plan gratuit de GitHub,
un dépôt privé ne peut pas être publié avec GitHub Pages. Les alternatives gratuites qui acceptent un
dépôt privé : Cloudflare Pages, Netlify ou Vercel. C'est une décision à prendre plus tard, par exemple au
moment d'acheter le nom de domaine.

## Les protections en place

### Dans le navigateur (pages et JavaScript)

| Menace | Protection | Où |
|--------|------------|-----|
| Code malveillant injecté dans une annonce (XSS) | `escapeHtml()` sur tout texte + **CSP** qui interdit tout script non autorisé | `js/utils.js`, `<head>` de chaque page |
| Lien `javascript:` dans une vidéo | `safeUrl()` + contrainte SQL | `js/utils.js`, `database/06` |
| Librairie Supabase modifiée sur le CDN | Empreinte **SRI** : le navigateur refuse un fichier modifié | balise `<script>` de chaque page |
| Domi affiché dans un cadre invisible (clickjacking) | Le site sort de tout cadre automatiquement | `js/utils.js` (section 1) |
| Escroquerie « collez ce code dans la console » | Grand avertissement dans la console | `js/utils.js` (section 1) |
| Fuite de l'adresse complète vers d'autres sites | Politique de référent stricte | `<head>` de chaque page |
| Pages privées dans Google | `noindex` sur admin, tableau de bord, publier… | `<head>` |

### Dans la base (Supabase)

| Menace | Protection | Fichier |
|--------|------------|---------|
| Lire les données d'un autre utilisateur | Règles RLS sur toutes les tables | `01` |
| Se donner le rôle admin ou le badge vérifié | Trigger `protect_profile` | `01`, `09` |
| Changer son numéro de téléphone (identité) | Trigger `protect_profile` | `09` |
| Valider sa propre annonce, truquer vues ou notes | Trigger `protect_listing` | `06`, `08` |
| Inonder le site de fausses annonces | 10 annonces par jour et par compte | `09` |
| Inonder de signalements (robot) | 1 par utilisateur et par annonce, 20 par heure et par annonce, 60 par minute au total | `09` |
| Spam de demandes de vérification | Une seule demande en attente par compte | `09` |
| Textes géants, faux formats | Tailles maximales et formats vérifiés | `09` |
| Appeler une fonction interne | Droit d'exécution retiré | `09` |

### Mot de passe oublié (Edge Function)

Code à 6 chiffres tiré de façon cryptographique, stocké uniquement sous forme d'empreinte SHA-256,
valable 10 minutes, 5 essais maximum, 3 envois par heure, comparaison à temps constant, réponse
identique que le numéro existe ou non, appels acceptés uniquement depuis le site (CORS).

## Réglages à faire vous-même dans Supabase (tableau de bord)

Ces réglages ne peuvent pas être faits par du code dans le dépôt :

1. **Authentication → Providers → Email** : vérifier que *Confirm email* est désactivé (obligatoire pour
   Domi) et régler **Minimum password length = 8**.
2. **Authentication → Rate Limits** : garder les limites par défaut (elles freinent les essais de mots de
   passe en série).
3. **Authentication → URL Configuration** : *Site URL* = `https://levi-akoute.github.io/domi/`.
4. **Project Settings → API** : ne jamais copier la clé `service_role` ailleurs que dans les secrets d'une
   Edge Function.
5. **Plus tard (recommandé)** : activer un CAPTCHA (*Authentication → Attack Protection*, Cloudflare
   Turnstile, gratuit) contre les inscriptions par robots. Cela demande une petite modification du
   formulaire d'inscription, qu'on pourra faire ensemble.

## Ce qui ne peut pas être fait sur GitHub Pages

Certaines protections exigent des « en-têtes HTTP » que GitHub Pages ne permet pas de configurer
(`X-Frame-Options`, `Strict-Transport-Security` personnalisé, CSP complète avec `frame-ancestors`).
La protection anti-cadre est donc faite en JavaScript. Avec Cloudflare Pages ou Netlify, on pourra
ajouter ces en-têtes dans un simple fichier `_headers`.
