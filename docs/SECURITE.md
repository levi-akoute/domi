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
Depuis la v7.1, les essais et les envois sont comptés dans la base de façon atomique (fonctions
`reset_creer`, `reset_essai`, `reset_terminer`), et un changement de mot de passe déconnecte tous les appareils.

## Audit de sécurité du 2026-11-18 (v7.1)

Méthode : lecture de tout le code (SQL, Edge Function, JavaScript), recherche de secrets dans les 14
commits de l'historique Git, tests en conditions réelles sur le site en ligne en tant que visiteur
anonyme (lectures uniquement), vérification dans le navigateur après correction.

**Ce qui tenait déjà** : aucune table sensible lisible par un visiteur (profils, codes, pièces
d'identité, signalements : réponse vide en production), bucket des pièces d'identité fermé, fonctions
admin refusées, aucune faille XSS (tout le texte est échappé, CSP sans script inline), aucun secret dans
l'historique Git (seule la clé publique `anon`), service worker sans cache des données, GitHub Actions
avec droits minimaux.

| # | Gravité | Faille | Correction |
|---|---|---|---|
| 1 | Élevée | Codes de récupération : essais lus puis écrits en deux temps. Des requêtes simultanées contournaient la limite de 5 essais → prise de contrôle d'un compte possible | Essai compté avant comparaison, en une opération verrouillée (`reset_essai`) ; sessions coupées après changement |
| 2 | Moyenne | Numéro du profil envoyé à part de l'identifiant de connexion : un pirate pouvait « prendre » le numéro d'une personne (elle ne pouvait plus s'inscrire) et l'afficher sur son compte | Numéro lu dans l'identifiant de connexion ; inscription hors format refusée |
| 3 | Moyenne | Dates de création modifiables : limite de 10 annonces/jour et limites des signalements contournables, annonce épinglée en tête pour toujours | Dates fixées par le serveur (annonces, signalements, avis, demandes) |
| 4 | Moyenne | 3 comptes jetables suffisaient à masquer n'importe quelle annonce | Seuls les comptes de plus de 7 jours comptent ; 5 sources pour un propriétaire vérifié |
| 5 | Moyenne | Envoi illimité de fichiers : stockage gratuit (1 Go) saturable par un seul compte | Quotas : 150 fichiers / 60 Mo (photos), 5 fichiers / 25 Mo (pièces), 2 Mo par photo |
| 6 | Moyenne | Photos acceptant n'importe quelle adresse (traceur d'adresse IP des visiteurs, photos volées) ; lien vidéo vers n'importe quel site (faux site de paiement) | Photos obligatoirement dans le dossier de l'annonceur sur le stockage Domi ; vidéos limitées aux grandes plateformes ; CSP `img-src` restreinte |
| 7 | Moyenne | Numéro de contact d'une annonce publiée modifiable sans nouvelle validation (même vérifié), et certains champs (avance, caution…) hors revalidation | Numéro changé → toujours revalidé ; tous les champs comptent |
| 8 | Faible | Demande de vérification pouvant désigner le fichier d'une autre personne | Chemin forcé dans le dossier du demandeur |
| 9 | Faible | Liste publique de toutes les photos du stockage (identifiants des annonceurs, photos d'annonces refusées) | Liste réservée à l'annonceur et à l'admin (les photos restent affichées) |
| 10 | Faible | Photos jamais supprimées avec l'annonce (contraire à la politique de confidentialité) | Suppression des photos avec l'annonce et lors de leur remplacement |
| 11 | Faible | CSP trop large : tout jsDelivr et tous les projets Supabase autorisés (canal de fuite en cas d'injection) | CSP limitée au fichier exact de la librairie et à notre projet ; anti-cadre renforcé (page cachée même dans un cadre « sandbox ») |
| 12 | Faible | Champ « Repère ou adresse » téléchargeable par tous alors que le site ne l'affiche pas | Avertissement dans le formulaire (décision à prendre : l'afficher ou le rendre privé) |

**Risques acceptés (connus, faible impact)** : compteurs de vues et de clics gonflables par un robot ;
un numéro de téléphone peut être utilisé à l'inscription sans être celui de la personne (il faudrait une
vérification par SMS, payante) ; on peut savoir si un numéro est inscrit (message d'inscription), mais les
numéros des annonces sont publics de toute façon.

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
