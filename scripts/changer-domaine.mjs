/* ═══════════════════════════════════════════════════════════════════
   scripts/changer-domaine.mjs : passer Domi sur son propre nom de domaine

   Aujourd'hui le site vit à l'adresse https://levi-akoute.github.io/domi/
   (un sous-dossier « /domi/ » d'un site GitHub). Avec un nom de domaine
   (ex. https://domi.ci/), le site est à la RACINE : plus de « /domi/ ».

   Ce script remplace l'ancienne adresse par la nouvelle partout où elle est écrite :
     • les pages HTML (aperçus de partage og:url / og:image, adresse canonique) ;
     • sitemap.xml et robots.txt ;
     • la balise <base href="/domi/"> de 404.html (qui devient « / »).

   Utilisation (dans le dossier du projet) :
       node scripts/changer-domaine.mjs https://domi.ci
   Puis vérifier avec « git diff », et publier avec /commit.
   Le reste de la procédure (DNS, GitHub, Supabase) : docs/GUIDE_NOM_DE_DOMAINE.md
   ═══════════════════════════════════════════════════════════════════ */

import { promises as fs } from "node:fs"; // lire / écrire des fichiers
import path from "node:path"; // manipuler des chemins

const ANCIENNE = "https://levi-akoute.github.io/domi/"; // adresse actuelle (avec / final)
const RACINE = process.cwd(); // dossier du projet

// 1. Lire et contrôler la nouvelle adresse donnée sur la ligne de commande
let nouvelle = process.argv[2]; // ex. « https://domi.ci »
if (!nouvelle || !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/?$/i.test(nouvelle)) {
  console.error("Usage : node scripts/changer-domaine.mjs https://votre-domaine.ci");
  console.error("(l'adresse doit commencer par https:// et ne contenir que le nom de domaine)");
  process.exit(1); // arrêt avec erreur
}
if (!nouvelle.endsWith("/")) nouvelle += "/"; // on veut toujours un « / » final

// 2. Fichiers concernés : toutes les pages HTML + sitemap + robots
const fichiers = (await fs.readdir(RACINE)).filter((n) => n.endsWith(".html"));
fichiers.push("sitemap.xml", "robots.txt");

let total = 0; // nombre de remplacements effectués
for (const nom of fichiers) {
  const chemin = path.join(RACINE, nom);
  let texte = await fs.readFile(chemin, "utf8");
  const avant = texte;
  texte = texte.split(ANCIENNE).join(nouvelle); // remplace TOUTES les occurrences
  if (nom === "robots.txt") texte = texte.replace(/^Disallow: \/domi\//gm, "Disallow: /"); // chemins à la racine
  if (nom === "404.html") texte = texte.replace('<base href="/domi/" />', '<base href="/" />'); // 404 à la racine
  if (texte !== avant) {
    await fs.writeFile(chemin, texte);
    const n = avant.split(ANCIENNE).length - 1;
    total += n;
    console.log(`✔ ${nom} (${n} adresse(s))`);
  }
}
console.log(`\nTerminé : ${total} adresse(s) remplacée(s) par ${nouvelle}`);
console.log("Étapes suivantes : docs/GUIDE_NOM_DE_DOMAINE.md (DNS, GitHub Pages, Supabase).");
