# Avant le lancement : ce que Levi doit faire lui-même

Liste des actions indispensables avant de présenter Domi comme un site fini. Claude a déjà fait tout ce qui est
technique (v7, 2026-11-17, voir `CHANGELOG.md`). Ce qui reste ici demande **tes informations ou tes accès**.

Coche au fur et à mesure.

## 1. Compléter les pages légales ✅ fait le 2026-11-18

Éditeur : AKOUTE Levi Koffi Nagnon, Gagnoa, suppordomi@gmail.com. Valeurs par défaut : tribunaux ivoiriens
compétents, signalements gardés 12 mois, Supabase « peut être hors de Côte d'Ivoire ».
**Reste pour plus tard** : numéro RCCM (si entreprise), numéro de déclaration ARTCI (emplacement prêt en commentaire
dans `confidentialite.html`), email `contact@ton-domaine` avec le nom de domaine, région Supabase exacte.

Ancienne procédure, gardée pour mémoire :

Les passages à remplir sont **surlignés en jaune** sur le site (balise `<mark class="a-completer">`).
Le script de publication les compte et affiche un avertissement tant qu'il en reste.
Pour les trouver : chercher `a-completer` dans `confidentialite.html` et `conditions.html`.

| Fichier | Information à mettre |
|---|---|
| les deux | Ton nom et prénom (ou le nom de ton entreprise si tu en crées une) |
| les deux | La ville (Yamoussoukro ?) |
| les deux | Une adresse email de contact pour Domi (idéalement `contact@ton-domaine` après l'achat du domaine) |
| `conditions.html` | Forme juridique et numéro RCCM, seulement si tu crées une entreprise (sinon supprime la phrase) |
| `conditions.html` | Ville des tribunaux compétents |
| `confidentialite.html` | Durée de conservation des signalements (12 mois conseillé) |
| `confidentialite.html` | Région de ton projet Supabase (Supabase › Project Settings › General › Region) |
| `confidentialite.html` | Numéro de déclaration ARTCI, une fois obtenu (sinon supprime la phrase en attendant) |

Une fois rempli : retire la balise `<mark class="a-completer">` autour du texte (garde le texte), mets à jour la
date « Dernière mise à jour », puis publie avec `/commit`.

⚠ Ces textes sont des modèles sérieux, mais Claude n'est pas juriste. Si Domi devient une activité commerciale,
fais-les relire par un juriste.

## 2. Exécuter le fichier SQL 10 dans Supabase ✅ fait (vérifié en ligne le 2026-11-18)

`database/10_suppression_pieces_identite.sql` : SQL Editor › coller › Run. Le résultat doit afficher une ligne
`verif_files_delete_admin`.

Sans lui, la validation d'un badge marche quand même, mais la pièce d'identité n'est pas supprimée et l'admin voit
le message « Document non supprimé : exécutez database/10… ». Or la politique de confidentialité promet cette
suppression.

Ensuite, dans l'admin, onglet Vérifications : clique sur « Effacer le document » pour chaque ancienne demande déjà
traitée qui garde encore sa pièce.

## 2 bis. Corrections de l'audit de sécurité (10 minutes) ⚠ IMPORTANT, DANS CET ORDRE

1. **SQL** : `database/11_audit_securite.sql` › SQL Editor › coller tout › Run. Le résultat doit être
   **vide** (aucune ligne). S'il y a des lignes, les montrer à Claude.
2. **Edge Function** : Supabase › Edge Functions › `reinitialiser-mot-de-passe` › Code › remplacer tout par le
   contenu de `supabase/functions/reinitialiser-mot-de-passe/index.ts` › Deploy. (Pas avant l'étape 1 : la
   nouvelle version utilise les fonctions créées par le fichier 11.)
3. **Test** : sur le site, « Mot de passe oublié » avec ton numéro → le code arrive → change le mot de passe
   → reconnecte-toi.
4. **Réglage des mots de passe** : Supabase › Authentication › Providers › Email (ou Sign In / Providers) ›
   *Minimum password length* = **8**, et exiger lettres + chiffres si l'option est proposée. Sans ce réglage,
   quelqu'un qui passe par l'API peut se créer un mot de passe de 6 caractères.
5. **Compte admin** : un mot de passe long et unique (12 caractères ou plus), jamais utilisé ailleurs.

## 2 ter. Exécuter le fichier SQL 12 (v7.2, 2 minutes)

`database/12_a_la_une.sql` : Supabase › SQL Editor › New query › coller tout › Run.
La dernière requête doit afficher 2 lignes (`protect_a_la_une_trigger`, `lock_role_trigger`).
Sans ce fichier le site marche, mais les boutons « À la une » de l'admin affichent une erreur.

## 2 quater. Exécuter le fichier SQL 13 (v7.3, 2 minutes) ⚠ APRÈS la publication

1. Publier la v7.3 (`/commit`) et attendre que le site en ligne soit à jour (onglet Actions en vert).
2. Exécuter le fichier 12 s'il ne l'est pas encore (le 13 refuse de s'exécuter sans lui).
3. `database/13_annonces_confidentielles.sql` : Supabase › SQL Editor › New query › coller tout › Run.
   La dernière requête doit afficher 5 lignes (3 fonctions et 2 règles).

⚠ Pas avant la publication : l'ancien site lit la table directement, il n'afficherait plus aucune annonce.
Tant que ce fichier n'est pas exécuté, le site marche comme avant (numéros encore lisibles avec F12) et la
console du navigateur montre une erreur 404 sans gravité sur `annonces_publiques`.

**Voir à tout moment ce qui est installé** : `database/99_verifier_installation.sql` (lecture seule, ne
modifie rien). Une ligne par fichier : ✅ installé, ❌ manque (avec le détail), ➖ ponctuel.

## 3. Supprimer les annonces d'exemple ✅ fait le 2026-11-18 (gardé pour mémoire)

Les 4 annonces fictives de `02_donnees_exemple.sql` sont **en ligne aujourd'hui** (photos de banque d'images,
numéro 0700000000). Présenter le site avec elles, c'est montrer de fausses annonces sur un site qui promet des
« annonces contrôlées ». Dans le SQL Editor :

```sql
delete from public.listings where description like '[EXEMPLE]%';
```

Puis publie quelques **vraies** annonces (les tiennes, celles de propriétaires que tu connais) pour que le site
ne soit pas vide le jour de la présentation.

## 4. Vérifier le numéro du support

Le bouton « Écrire au support » ouvre WhatsApp vers le numéro réglé dans `js/config.js` (`SUPPORT_WHATSAPP`).
Envoie-toi un message de test depuis le site pour vérifier qu'il arrive bien sur le bon téléphone.

## 5. Savoir supprimer un compte (demande d'un utilisateur)

La politique de confidentialité promet une suppression sous 30 jours. Procédure :

1. Vérifie que la demande vient bien du numéro du compte (message WhatsApp depuis ce numéro).
2. Supabase › Authentication › Users › cherche le compte › **Delete user**. La base supprime en cascade son
   profil, ses annonces, ses avis et ses demandes de vérification ; ses signalements deviennent anonymes.
3. Supabase › Storage : supprime le dossier portant l'identifiant de l'utilisateur dans `annonces` (ses photos)
   et dans `verifications` (s'il en reste un).
4. Réponds à la personne que c'est fait.

## 6. Déclaration à l'ARTCI (à prévoir)

La loi ivoirienne 2013-450 demande de déclarer les traitements de données personnelles à l'ARTCI, et Domi traite
des pièces d'identité. Renseigne-toi sur la procédure (www.artci.ci, rubrique protection des données). Ce n'est
pas bloquant pour une présentation à des proches, mais ça l'est pour une ouverture large au public.

## 7. Nom de domaine

Suivre `docs/GUIDE_NOM_DE_DOMAINE.md` (une commande pour changer toutes les adresses du site, puis les réglages DNS,
GitHub et Supabase).

## Ce qui n'est PAS bloquant (à faire plus tard)

- Messages d'erreur affichés sous chaque champ des formulaires (aujourd'hui : bulles du navigateur + message en haut).
- Polices hébergées sur le site au lieu de Google Fonts (plus rapide, plus respectueux de la vie privée).
- En-têtes de sécurité avancés (X-Frame-Options, HSTS) : impossibles sur GitHub Pages, il faudrait passer par
  Cloudflare. HSTS est déjà actif sur `github.io`.
- Test sur un vrai iPhone (Safari) : les tests automatiques ont été faits avec le moteur de Chrome/Edge seulement.
- `favicon.ico` pour les très vieux navigateurs (les navigateurs actuels utilisent déjà le SVG et les PNG).
