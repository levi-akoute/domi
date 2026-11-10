# Guide : activer « Mot de passe oublié » par code email

Temps estimé : 20 à 30 minutes. Coût : 0 F (offre gratuite Brevo, 300 emails par jour).

## Comment ça marche

```
Utilisateur                 Site (navigateur)              Supabase (serveur)                 Brevo
    │ saisit son numéro  ──►  recovery.js  ──── appelle ──► Edge Function
    │                                                        │ cherche l'email de récupération
    │                                                        │ crée un code, garde son empreinte
    │ ◄──────────────── email avec le code ───────────────── │ ──── demande l'envoi ──────────► envoie
    │ saisit code + mot de passe ──► recovery.js ──────────► │ vérifie le code (10 min, 5 essais)
    │                                                        │ change le mot de passe (service_role)
```

Pourquoi une Edge Function ? Changer le mot de passe de quelqu'un qui n'est pas connecté exige la clé
`service_role`. Cette clé donne tous les droits : elle ne doit **jamais** être dans le site (tout le
monde peut lire le code d'un site). L'Edge Function tourne chez Supabase : la clé y reste cachée.

## 1. Base de données

Supabase → **SQL Editor** → **New query** → collez `database/07_mot_de_passe_oublie.sql` → **Run**.
Résultat attendu : une ligne `email_recuperation | text`.

## 2. Compte Brevo (envoi des emails)

1. Créez un compte gratuit sur **brevo.com**.
2. Menu **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender**.
   Nom : `Domi`. Email : l'adresse qui enverra les codes (par exemple votre Gmail).
   Brevo envoie un code de confirmation à cette adresse : validez-le.
3. Menu **SMTP & API** → onglet **API Keys** → **Generate a new API key** → nom `domi`.
   Copiez la clé (elle commence par `xkeysib-`). Elle ne s'affiche qu'une fois.

> Quand vous aurez votre nom de domaine, créez une adresse `contact@votre-domaine` et authentifiez le
> domaine dans Brevo : les emails arriveront moins souvent dans les spams.

## 3. Edge Function

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom de la fonction : `reinitialiser-mot-de-passe` (exactement, avec les tirets).
3. Effacez le code d'exemple et collez tout le contenu de
   `supabase/functions/reinitialiser-mot-de-passe/index.ts` → **Deploy function**.
4. **Edge Functions** → **Secrets** (ou *Manage secrets*) → ajoutez :

   | Nom | Valeur |
   |-----|--------|
   | `BREVO_API_KEY` | la clé `xkeysib-...` |
   | `BREVO_SENDER_EMAIL` | l'adresse validée à l'étape 2 |

   `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase :
   ne les ajoutez pas.

## 4. Tester

1. Connectez-vous avec un compte de test → **Mon espace** → **Sécurité du compte** → enregistrez votre
   email de récupération.
2. Déconnectez-vous → **Mot de passe oublié ?** → saisissez le numéro du compte.
3. Vous recevez un email « 123456 est votre code Domi » (regardez aussi dans les spams).
4. Saisissez le code et un nouveau mot de passe → connectez-vous avec.

## En cas de problème

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| « Le service de récupération est momentanément indisponible » | La fonction n'est pas déployée, ou son nom est différent | Vérifiez le nom exact `reinitialiser-mot-de-passe` |
| Même message, fonction bien déployée | Vérification JWT refusée | Edge Functions → la fonction → **Details** → désactivez **Enforce JWT verification** (sans risque : la fonction ne dépend pas de l'utilisateur connecté), puis **Save** |
| Message « un code vient d'être envoyé » mais aucun email | Secrets Brevo absents ou expéditeur non validé | Edge Functions → la fonction → **Logs** : le message d'erreur Brevo y est affiché |
| Aucun email après 3 essais | Limite volontaire : 3 codes par heure et par compte | Attendre une heure |

## Sécurité : ce qui est déjà prévu

- Le site répond **la même chose** que le numéro existe ou non (impossible de deviner qui est inscrit).
- Le code n'est jamais stocké en clair, seulement son empreinte SHA-256.
- Code valable 10 minutes, 5 essais maximum, 3 envois par heure, un seul code actif à la fois.
- La table `password_resets` est inaccessible depuis le site (RLS sans aucune règle).
- Les utilisateurs **sans** email de récupération gardent le support WhatsApp comme solution de secours
  (`database/04_reinitialiser_mot_de_passe.sql`).
