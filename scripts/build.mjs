/* ═══════════════════════════════════════════════════════════════════
   scripts/build.mjs : fabrique la version PUBLIÉE du site (dossier dist/)

   Pourquoi ? Le code source de Domi est rempli de commentaires pour être
   compris et expliqué. Mais les visiteurs n'ont pas besoin de ces
   commentaires : ils alourdissent les pages (forfait mobile) et rendent
   le code très facile à lire avec « Inspecter ».

   Ce script prend le code source et produit dans dist/ une copie :
     • sans aucun commentaire ;
     • « minifiée » : espaces supprimés, noms de variables internes raccourcis ;
     • sans les dossiers database/, docs/, supabase/, scripts/ (inutiles au site).

   Lancement :  npm run build      (fait automatiquement par GitHub à chaque push)
   Test local : npm run build puis ouvrir dist/index.html avec Live Server.

   ⚠ La minification RALENTIT la lecture du code, elle ne la rend pas impossible.
   La vraie sécurité reste dans la base (règles RLS, fichiers database/).
   ═══════════════════════════════════════════════════════════════════ */

// ───────── Outils utilisés ─────────
import { promises as fs } from "node:fs"; // lire / écrire des fichiers
import path from "node:path"; // manipuler des chemins de fichiers
import { execSync } from "node:child_process"; // lancer une commande (git) depuis le script
import { transform } from "esbuild"; // minifie le JavaScript et le CSS (très rapide)
import { minify as minifyHtml } from "html-minifier-terser"; // minifie le HTML

// ───────── Réglages ─────────
const RACINE = process.cwd(); // dossier du projet (là où on lance la commande)
const SORTIE = path.join(RACINE, "dist"); // dossier produit
// Fichiers et dossiers publiés. Tout le reste (database, docs, supabase…) n'est PAS publié.
const A_COPIER = ["assets", "manifest.webmanifest", "robots.txt", "sitemap.xml"];
// Fichiers sources à ne jamais publier même s'ils sont dans js/
const EXCLUS = new Set(["config.exemple.js"]);

// Numéro de version : identifiant du commit Git (GitHub le fournit), sinon la date et l'heure.
// Il sert au service worker pour savoir qu'une nouvelle version est en ligne.
function version() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 8); // sur GitHub
  try {
    return execSync("git rev-parse --short HEAD").toString().trim(); // sur ton PC
  } catch {
    return Date.now().toString(36); // sans Git : la date encodée
  }
}

// ───────── Fonctions de minification ─────────
// JavaScript : esbuild supprime commentaires et espaces, raccourcit les noms internes.
const minJs = async (code) =>
  (
    await transform(code, {
      loader: "js", // le texte est du JavaScript
      minify: true, // active toutes les réductions
      target: "es2019", // reste compatible avec les téléphones un peu anciens
      legalComments: "none", // supprime même les commentaires de licence
    })
  ).code;

// CSS : même outil, en mode CSS.
const minCss = async (code) =>
  (await transform(code, { loader: "css", minify: true, legalComments: "none" })).code;

// HTML : supprime les commentaires <!-- --> et les espaces inutiles.
const minHtml = (code) =>
  minifyHtml(code, {
    removeComments: true, // supprime <!-- … -->
    collapseWhitespace: true, // réduit les suites d'espaces et de retours à la ligne
    conservativeCollapse: true, // garde UN espace là où il y en avait (évite de coller des mots)
    keepClosingSlash: true, // garde « /> » (pas indispensable, mais sans risque)
    minifyCSS: false, // pas de CSS dans le HTML (tout est dans style.css)
    minifyJS: false, // pas de JS dans le HTML (tout est dans js/)
  });

// ───────── Copie récursive d'un dossier ou d'un fichier ─────────
async function copier(source, destination) {
  const info = await fs.stat(source); // fichier ou dossier ?
  if (info.isDirectory()) {
    await fs.mkdir(destination, { recursive: true }); // crée le dossier de destination
    for (const nom of await fs.readdir(source)) {
      await copier(path.join(source, nom), path.join(destination, nom)); // copie chaque élément
    }
  } else {
    await fs.copyFile(source, destination); // copie simple du fichier
  }
}

// ───────── Programme principal ─────────
async function main() {
  const v = version();
  console.log(`Construction de Domi, version ${v}…`);

  // 1. Repartir d'un dossier dist/ vide
  await fs.rm(SORTIE, { recursive: true, force: true });
  await fs.mkdir(path.join(SORTIE, "js"), { recursive: true });
  await fs.mkdir(path.join(SORTIE, "css"), { recursive: true });

  // 2. Pages HTML (toutes celles à la racine du projet)
  for (const nom of await fs.readdir(RACINE)) {
    if (!nom.endsWith(".html")) continue; // on ne garde que les .html
    const html = await fs.readFile(path.join(RACINE, nom), "utf8");
    await fs.writeFile(path.join(SORTIE, nom), await minHtml(html));
  }

  // 3. Scripts JavaScript
  for (const nom of await fs.readdir(path.join(RACINE, "js"))) {
    if (!nom.endsWith(".js") || EXCLUS.has(nom)) continue;
    const js = await fs.readFile(path.join(RACINE, "js", nom), "utf8");
    await fs.writeFile(path.join(SORTIE, "js", nom), await minJs(js));
  }

  // 4. Service worker : on y inscrit le numéro de version, puis on minifie
  const sw = (await fs.readFile(path.join(RACINE, "sw.js"), "utf8")).replace("__VERSION__", v);
  await fs.writeFile(path.join(SORTIE, "sw.js"), await minJs(sw));

  // 5. Feuille de style
  const css = await fs.readFile(path.join(RACINE, "css", "style.css"), "utf8");
  await fs.writeFile(path.join(SORTIE, "css", "style.css"), await minCss(css));

  // 6. Fichiers copiés tels quels (images, manifeste, robots, sitemap)
  for (const element of A_COPIER) {
    await copier(path.join(RACINE, element), path.join(SORTIE, element));
  }

  // 7. Fichier vide « .nojekyll » : dit à GitHub Pages de publier les fichiers tels quels
  await fs.writeFile(path.join(SORTIE, ".nojekyll"), "");

  console.log("Terminé : le site publiable est dans dist/");
}

// Lance le programme ; en cas d'erreur, l'affiche et signale l'échec (code 1) à GitHub.
main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
