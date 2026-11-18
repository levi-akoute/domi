# Passer Domi sur son propre nom de domaine

Aujourd'hui : `https://levi-akoute.github.io/domi/`. Demain, par exemple : `https://domi.ci/`.
Le site reste hébergé gratuitement sur GitHub Pages : on lui donne seulement une nouvelle adresse.

Compte environ 1 heure de manipulations, puis jusqu'à 24 heures d'attente pour que le DNS se propage.

## 1. Acheter le domaine

- `.ci` : chez un bureau d'enregistrement agréé par NIC.ci (liste sur nic.ci). Plus local, souvent plus cher.
- `.com` : chez n'importe quel bureau d'enregistrement (Namecheap, OVH, Porkbun…), environ 10 à 15 $ par an.

Prends aussi la version `www` (elle est incluse avec le domaine, rien à acheter en plus).

## 2. Changer les adresses dans le code (1 commande)

Dans le dossier du projet :

```powershell
node scripts/changer-domaine.mjs https://domi.ci
```

Le script remplace `https://levi-akoute.github.io/domi/` partout (pages HTML, `sitemap.xml`, `robots.txt`) et
corrige la page 404 (`<base href="/">`). Vérifie avec `git diff`, puis publie avec `/commit`.

Bonus : à la racine d'un vrai domaine, `robots.txt` devient enfin lu par Google (sur `github.io/domi/` il était ignoré).

## 3. Régler le DNS chez le bureau d'enregistrement

Dans la zone DNS de ton domaine, ajoute :

| Type | Nom | Valeur |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | levi-akoute.github.io |

Supprime les anciens enregistrements A ou CNAME « parking » du bureau d'enregistrement s'il y en a.
Ces adresses sont celles de la documentation officielle de GitHub Pages ; vérifie-les sur
docs.github.com (« Managing a custom domain for your GitHub Pages site ») au moment de le faire.

## 4. Régler GitHub

1. **Vérifier le domaine** (protège contre le vol de domaine) : GitHub › ta photo › Settings › Pages ›
   « Add a domain », puis ajoute l'enregistrement TXT demandé dans ton DNS.
2. Dépôt `levi-akoute/domi` › Settings › Pages › **Custom domain** : `domi.ci` › Save.
   (Le site est publié par GitHub Actions : pas besoin de fichier CNAME.)
3. Attends que la vérification DNS passe au vert, puis coche **Enforce HTTPS**. Toutes les adresses `http://`
   seront redirigées vers `https://` automatiquement. Le certificat est gratuit (Let's Encrypt) et renouvelé tout seul.
4. L'ancienne adresse `levi-akoute.github.io/domi/` redirigera vers le nouveau domaine.

## 5. Régler Supabase

1. Authentication › URL Configuration › **Site URL** : `https://domi.ci`.
2. Edge Functions › Secrets : ajoute `SITE_ORIGINS` = `https://domi.ci,https://www.domi.ci`
   (sinon la fonction « Mot de passe oublié » refusera les demandes venant du nouveau domaine).

## 6. Email et Brevo (recommandé)

Crée une adresse `contact@domi.ci` (souvent proposée par le bureau d'enregistrement, ou Zoho Mail gratuit), mets-la
dans les pages légales, et authentifie le domaine dans Brevo (enregistrements DKIM/SPF fournis par Brevo) :
les codes de récupération arriveront moins souvent dans les spams.

## 7. Google

Google Search Console › ajouter la propriété `https://domi.ci` › valider › Sitemaps › envoyer `sitemap.xml`.

## 8. Vérifications finales

- [ ] `http://domi.ci` redirige vers `https://domi.ci`
- [ ] `https://www.domi.ci` fonctionne
- [ ] Une adresse inexistante affiche la page 404 de Domi, avec son style
- [ ] Connexion, publication d'une annonce, mot de passe oublié : tout fonctionne
- [ ] Un lien partagé sur WhatsApp affiche l'image et le titre de Domi
