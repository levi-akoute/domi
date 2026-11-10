# Guide : installer la mise à jour v6

Ordre conseillé : **la base d'abord, puis la fonction serveur, puis le site.**

## 1. Base de données (Supabase → SQL Editor → New query)

Si ce n'est pas déjà fait, exécutez dans l'ordre `06`, `07`, `08` (voir `CHANGELOG.md`, v5). Puis :

| Fichier | Ce qu'il fait | Résultat attendu |
|---------|---------------|------------------|
| `database/09_securite_renforcee.sql` | Limites anti-abus, numéro verrouillé, tailles maximales | **Aucune ligne** (sinon : annonces à corriger, voir le commentaire du fichier) |

## 2. Fonction « mot de passe oublié » (à redéployer)

Le code de `supabase/functions/reinitialiser-mot-de-passe/index.ts` a été renforcé (appels limités au
site, comparaison sécurisée, ménage automatique). Supabase → **Edge Functions** →
`reinitialiser-mot-de-passe` → **Code** → remplacez tout par le nouveau contenu → **Deploy**.

Quand vous aurez un nom de domaine : ajoutez le secret `SITE_ORIGINS` (ex. `https://domi.ci`).

## 3. Site : nouvelle façon de publier

⚠ **Ne publiez plus par « Add file → Upload files »** : les fichiers et dossiers qui commencent par un
point (`.github/`, `.gitignore`…) ne passent pas, et la publication automatique ne fonctionnerait pas.
Utilisez `git push` (ou `/commit` avec Claude).

Depuis la v6, GitHub publie une **version compacte** du site (sans commentaires, voir `docs/SECURITE.md`) :

1. Envoyez le code sur GitHub (`git push`).
2. **Une seule fois** : GitHub → dépôt `domi` → **Settings** → **Pages** → *Build and deployment* →
   **Source : GitHub Actions**.
3. Onglet **Actions** du dépôt : la publication « Publier le site » doit devenir verte (1 à 2 minutes).
4. Ouvrez le site et faites **Ctrl+F5**.

Pour tester la version compacte sur votre PC : `npm install` (une fois), puis `npm run build`, puis
ouvrez `dist/index.html` avec Live Server.

## 4. Vérifications après mise en ligne

- [ ] Le site s'affiche normalement (accueil, catalogue, fiche, connexion)
- [ ] Clic droit → « Afficher le code source » : le code est compact et sans commentaires
- [ ] Sur téléphone Android (Chrome) : menu ⋮ → **Installer l'application** est proposé, ou le bandeau
      « Installer Domi » apparaît
- [ ] Sur iPhone (Safari) : le bouton « Installer l'appli » du menu explique la marche à suivre
- [ ] Mode avion après une première visite : la page « Pas de connexion » s'affiche proprement
- [ ] Mot de passe oublié : un code arrive toujours par email
