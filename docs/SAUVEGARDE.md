# Sauvegarder Domi chaque semaine

L'offre gratuite de Supabase ne fait **aucune sauvegarde**. Si une annonce est effacée par erreur, ou si une
commande SQL abîme des données, rien ne permet de revenir en arrière. Le script `scripts/sauvegarder.mjs` copie
tout ce qui compte sur ton PC. Il ne modifie aucune donnée : il se connecte, lit, puis se déconnecte.

## Ce qui est copié

| Fichier | Contenu |
|---|---|
| `profils.json` | profils : nom, prénom, téléphone, rôle, badge |
| `annonces.json` | toutes les annonces, même masquées ou refusées |
| `avis.json` | avis |
| `signalements.json` | signalements |
| `demandes-badge.json` | demandes de badge : décision et date, sans le document |
| `resume.txt` | résumé : date et nombre de lignes de chaque fichier |
| dossier `photos` | photos des annonces, communes à toutes les sauvegardes |

**Pas copiés :**
- les **pièces d'identité** : la page Confidentialité promet qu'elles sont supprimées après la vérification ;
- les **mots de passe** : personne ne peut les lire, même toi ;
- les codes « mot de passe oublié » : temporaires, inutiles à garder ;
- les **favoris** : chacun est seul à pouvoir lire les siens, même l'admin n'y a pas accès ;
- la liste des comptes de connexion : les profils contiennent déjà le nom et le numéro de chacun ;
- les **vidéos** : trop lourdes (jusqu'à 20 Mo chacune). L'annonceur garde l'original sur son téléphone.

La structure de la base (tables, règles de sécurité) n'a pas besoin d'être copiée : les fichiers `database/01` à
`14` la recréent.

## Pourquoi ton compte admin, et pas la clé `service_role`

Le script se connecte comme toi sur la page de connexion, puis lit ce que tu peux lire dans la page admin. Il a donc
**exactement tes droits**, rien de plus. La clé `service_role`, elle, ignore toutes les règles de sécurité de la base :
elle ne doit jamais se trouver dans `.env` (règle de `CLAUDE.md`). Si tu avais ajouté une ligne
`DOMI_SUPABASE_SECRET_KEY`, supprime-la : le script te le rappelle.

## À faire une seule fois : tes identifiants admin

1. Ouvre le fichier `.env` à la racine du workspace (`jarvis-starter-kit\.env`).
2. Ajoute ces deux lignes, avec le numéro et le mot de passe de ton **compte admin** :

   ```
   DOMI_ADMIN_TELEPHONE=
   DOMI_ADMIN_MOT_DE_PASSE=
   ```

3. Si ton mot de passe commence ou finit par une espace, mets-le entre guillemets. Enregistre le fichier.

Ne mets ce mot de passe nulle part ailleurs. Choisis-le long (12 caractères ou plus) et jamais utilisé sur un autre
site. Si tu le changes sur le site, change-le aussi dans `.env`.

Le script ne l'affiche jamais, ne l'écrit jamais dans une sauvegarde, et ne l'envoie qu'à ton projet Supabase.

## Chaque semaine : lancer la sauvegarde

Dans le terminal de VS Code, dans le dossier du projet :

```powershell
npm run sauvegarder
```

Ça prend une minute ou deux. La première fois, un peu plus : toutes les photos sont copiées. Ensuite, seulement
les nouvelles, ce qui économise aussi le quota de transfert gratuit de Supabase. À la fin, le script ferme sa session :
ton navigateur et ton téléphone restent connectés.

Le script vérifie que toutes les annonces visibles sur le site sont bien dans la copie. S'il en manque, il s'arrête et
n'enregistre rien.

## Où sont les sauvegardes

Dans `Documents\Sauvegardes Domi` :

```
Sauvegardes Domi\
  2026-11-22_21h30\   une sauvegarde par lancement, avec resume.txt
  2026-11-29_20h05\
  photos\             les photos, communes à toutes les sauvegardes
```

- **Les sauvegardes de plus de 3 semaines sont effacées** à chaque lancement. Avec un lancement par semaine,
  aucune copie ne dépasse donc 4 semaines. C'est voulu : la page Confidentialité promet qu'un compte supprimé
  disparaît en 30 jours, sauvegardes comprises. Les photos qui ne servent plus à aucune sauvegarde sont effacées
  aussi. Si un jour tu arrêtes les sauvegardes, efface toi-même le dossier.
- **Une copie hors du PC** protège contre le vol ou la panne : copie le dossier sur une clé USB de temps en
  temps, et efface de la clé les copies de plus de 4 semaines.
- **Autre dossier** : ajoute `DOMI_DOSSIER_SAUVEGARDE=D:\Mes sauvegardes` dans `.env`. Le script refuse un
  dossier situé dans le projet, car il pourrait partir sur GitHub.

⚠ Ces fichiers contiennent des **données personnelles** (noms, numéros de téléphone). Ne les envoie à personne et
ne les mets jamais sur GitHub.

## Si un jour il faut restaurer

Ne touche à rien dans Supabase et demande à Claude. Avec le dossier de sauvegarde, il prépare la remise en place
(par exemple, remettre une annonce effacée par erreur), et tu la vérifies avant de l'exécuter.

## Messages possibles

| Message | Que faire |
|---|---|
| « identifiants admin absents » | faire l'étape « À faire une seule fois » |
| « numéro ou mot de passe admin refusé » | vérifie les deux lignes dans `.env` (essaie-les sur le site) |
| « trop d'essais de connexion » | attends quelques minutes, puis relance |
| « ce compte n'est pas administrateur » | mets le numéro de ton compte admin |
| « copie incomplète » | relance ; si ça continue, montre le message à Claude |
| « DOMI_SUPABASE_SECRET_KEY n'est plus utilisée » | supprime cette ligne de `.env` |
| « DANGER : une clé secrète est écrite dans js/config.js » | remets la clé anon dans `js/config.js`, puis demande à Claude comment changer la clé secrète |
| « pas de réponse de … » | vérifie Internet, puis relance |
| « ⚠ la table … n'existe pas dans la base » | un fichier SQL n'a pas été exécuté : lance `database/99_verifier_installation.sql` |
| « ⚠ … photo(s) non copiée(s) » | relance plus tard : seules les photos manquantes seront téléchargées |
| « ⚠ table(s) de la base pas dans la sauvegarde » | une nouvelle table existe : demande à Claude de l'ajouter au script |
