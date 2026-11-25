/* ═══════════════════════════════════════════════════════════════════
   scripts/sauvegarder.mjs : copie de sécurité de Domi sur ce PC

   Pourquoi : l'offre gratuite de Supabase ne fait AUCUNE sauvegarde.
   Une annonce effacée par erreur ou une mauvaise commande SQL serait
   perdue pour toujours. Ce script copie sur ton ordinateur :
     • les tables (profils, annonces, avis, signalements, demandes de
       badge), en fichiers JSON lisibles ;
     • les photos des annonces (à chaque fois, seulement les nouvelles).
   Il ne copie JAMAIS les pièces d'identité : la page Confidentialité
   promet qu'elles sont supprimées après la vérification.

   Connexion : il utilise TON COMPTE ADMIN (numéro et mot de passe, dans
   .env), comme la page admin.html. Il a donc exactement tes droits sur le
   site, rien de plus. La clé « service_role », qui ignore toutes les
   règles de sécurité de la base, n'est jamais utilisée.
   Il ne modifie aucune donnée : il se connecte, lit, puis se déconnecte.

   Rangement (par défaut : Documents\Sauvegardes Domi) :
       2026-11-22_21h30\   une sauvegarde par lancement (+ resume.txt)
       photos\             les photos, communes à toutes les sauvegardes
   Les sauvegardes de plus de 3 semaines sont effacées à chaque lancement.
   Lancé chaque semaine, le script ne garde donc aucune copie plus de 4 semaines :
   la page Confidentialité promet qu'un compte supprimé disparaît en 30 jours.

   Utilisation (dans le dossier du projet), une fois par semaine :
       npm run sauvegarder
   Avant la première fois : mettre le numéro et le mot de passe admin dans
   .env (mode d'emploi complet : docs/SAUVEGARDE.md).
   ═══════════════════════════════════════════════════════════════════ */

import { existsSync, promises as fs, readFileSync } from "node:fs"; // lire / écrire des fichiers
import os from "node:os"; // dossier personnel de l'utilisateur
import path from "node:path"; // manipuler des chemins
import { fileURLToPath } from "node:url"; // retrouver le dossier de ce script

// ───────── Réglages ─────────
const PROJET = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); // dossier du projet
const DUREE_JOURS = 21; // 3 semaines (lancé chaque semaine : aucune copie ne dépasse 4 semaines)
const PAGE = 1000; // lignes demandées par requête (Supabase en renvoie 1 000 au plus)
const EN_MEME_TEMPS = 4; // photos téléchargées en même temps
const MOTIF = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})(?:_\d+)?$/; // nom d'un dossier de sauvegarde

// Tables copiées : nom dans la base, fichier produit, ordre de lecture (pour lire page par page sans trou).
// Ce sont les tables que la page admin affiche : les règles de la base (RLS) laissent l'admin tout y lire.
const TABLES = [
  { table: "profiles", fichier: "profils.json", tri: "id" },
  { table: "listings", fichier: "annonces.json", tri: "id" },
  { table: "reviews", fichier: "avis.json", tri: "id" },
  { table: "reports", fichier: "signalements.json", tri: "id" },
  { table: "verification_requests", fichier: "demandes-badge.json", tri: "id" },
];
// Volontairement PAS copiées : les codes « mot de passe oublié » (temporaires) et les favoris
// (chacun est seul à pouvoir lire les siens : même l'admin n'y a pas accès).
const IGNOREES = ["password_resets", "favorites"];

// Remplis par chargerReglages() puis seConnecter()
let URL_SB = ""; // adresse du projet Supabase
let CLE_PUBLIQUE = ""; // clé « anon » du site (publique)
let ENTETES = {}; // en-têtes HTTP de la session admin (jamais affichés, jamais enregistrés)
let RACINE = ""; // dossier des sauvegardes
let PREFIXE_PHOTOS = ""; // début de l'adresse publique d'une photo d'annonce

// ───────── 1. Réglages et contrôles ─────────

// Lit les variables demandées dans le fichier .env le plus proche (il est à la racine du workspace).
// Le contenu du .env n'est JAMAIS affiché.
function lireEnv(noms) {
  for (let dossier = PROJET; ; dossier = path.dirname(dossier)) {
    const fichier = path.join(dossier, ".env");
    if (existsSync(fichier)) {
      const trouvees = {};
      for (const ligne of readFileSync(fichier, "utf8").split(/\r?\n/)) {
        const m = ligne.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/); // forme NOM=valeur
        if (m && noms.includes(m[1])) trouvees[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2"); // sans guillemets
      }
      return trouvees;
    }
    if (path.dirname(dossier) === dossier) return {}; // racine du disque atteinte : pas de .env
  }
}

// Rôle inscrit dans une clé Supabase de type JWT (« anon » ou « service_role ») ; "" sinon.
function roleJwt(cle) {
  try {
    return JSON.parse(Buffer.from(cle.split(".")[1], "base64url").toString("utf8")).role || "";
  } catch {
    return "";
  }
}

// Numéro nettoyé, comme sur le site (js/auth.js) : 10 chiffres, sans l'indicatif 225 ; "" si invalide
function normaliser(telephone) {
  let chiffres = telephone.replace(/\D/g, "");
  if (chiffres.length === 13 && chiffres.startsWith("225")) chiffres = chiffres.slice(3);
  return /^\d{10}$/.test(chiffres) ? chiffres : "";
}

// Prépare les réglages et renvoie les identifiants de connexion (ou arrête avec un message clair)
function chargerReglages() {
  // Une variable déjà définie dans l'environnement (même vide) passe avant le .env.
  const noms = [
    "DOMI_ADMIN_TELEPHONE",
    "DOMI_ADMIN_MOT_DE_PASSE",
    "DOMI_DOSSIER_SAUVEGARDE",
    "DOMI_SUPABASE_SECRET_KEY", // ancienne méthode, abandonnée : on vérifie seulement qu'elle n'est plus là
  ];
  const env = noms.every((n) => n in process.env) ? {} : lireEnv(noms);
  const reglage = (n) => (n in process.env ? process.env[n] : env[n]) || "";

  // Fichier public du site : adresse du projet et clé publique (anon)
  let config;
  try {
    config = readFileSync(path.join(PROJET, "js", "config.js"), "utf8");
  } catch {
    throw new Error("fichier js/config.js introuvable.");
  }
  const lire = (nom) => (config.match(new RegExp(`${nom}\\s*:\\s*"([^"]+)"`)) || [])[1] || "";

  // DOMI_SUPABASE_URL : fausse base sur CE PC, seulement pour tester le script. Toute autre adresse est
  // refusée : le mot de passe admin ne doit partir que vers le vrai projet Supabase.
  const adresseTest = process.env.DOMI_SUPABASE_URL || "";
  if (adresseTest && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(adresseTest))
    throw new Error("DOMI_SUPABASE_URL sert seulement aux tests sur ce PC (http://127.0.0.1).");
  URL_SB = (adresseTest || lire("SUPABASE_URL")).replace(/\/+$/, "");
  CLE_PUBLIQUE = lire("SUPABASE_ANON_KEY");
  RACINE = path.resolve(
    reglage("DOMI_DOSSIER_SAUVEGARDE").trim() ||
      path.join(os.homedir(), "Documents", "Sauvegardes Domi")
  );
  PREFIXE_PHOTOS = `${URL_SB}/storage/v1/object/public/annonces/`;

  // Contrôles, avant tout échange avec Supabase
  if (!(adresseTest || /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(URL_SB)) || !CLE_PUBLIQUE)
    throw new Error("adresse ou clé publique Supabase introuvable dans js/config.js.");
  if (roleJwt(CLE_PUBLIQUE) === "service_role" || CLE_PUBLIQUE.startsWith("sb_secret_"))
    throw new Error(
      "DANGER : une clé secrète est écrite dans js/config.js, donc visible par tout le monde. " +
        "Remets la clé anon dans js/config.js, puis demande à Claude comment changer la clé secrète."
    );
  const motDePasse = reglage("DOMI_ADMIN_MOT_DE_PASSE"); // tel quel : un mot de passe peut contenir des espaces
  if (!reglage("DOMI_ADMIN_TELEPHONE").trim() || !motDePasse)
    throw new Error(
      "identifiants admin absents : ajoute DOMI_ADMIN_TELEPHONE=... et DOMI_ADMIN_MOT_DE_PASSE=... dans le fichier .env (voir docs/SAUVEGARDE.md)."
    );
  const telephone = normaliser(reglage("DOMI_ADMIN_TELEPHONE"));
  if (!telephone)
    throw new Error("DOMI_ADMIN_TELEPHONE doit contenir 10 chiffres (exemple : 0700000000).");
  const relatif = path.relative(PROJET, RACINE);
  const dehors =
    relatif === ".." || relatif.startsWith(`..${path.sep}`) || path.isAbsolute(relatif);
  if (!dehors)
    throw new Error(
      `le dossier de sauvegarde (${RACINE}) est dans le projet : il risquerait de partir sur GitHub. Choisis un dossier en dehors.`
    );

  return {
    email: `${telephone}@${lire("EMAIL_DOMAIN") || "immoci.app"}`, // identifiant interne, comme sur le site
    motDePasse,
    ancienneCle: !!reglage("DOMI_SUPABASE_SECRET_KEY").trim(), // seulement « présente ou non »
  };
}

// ───────── 2. Échanges avec Supabase ─────────

// Envoie une requête (60 secondes maximum) ; une panne réseau devient un message clair.
async function demander(adresse, entetes = {}, options = {}) {
  try {
    return await fetch(adresse, {
      ...options,
      headers: entetes,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    const cause = e.name === "TimeoutError" ? "délai dépassé" : "connexion impossible";
    throw new Error(
      `pas de réponse de ${new URL(adresse).host} (${cause}). Vérifie Internet, puis relance.`
    );
  }
}

// Demande du JSON à Supabase avec la session admin. Un refus devient une erreur qui garde le code HTTP.
async function lireJson(adresse) {
  const rep = await demander(adresse, ENTETES);
  let texte;
  try {
    texte = await rep.text();
  } catch {
    throw new Error(`réponse coupée par ${new URL(adresse).host}. Vérifie Internet, puis relance.`);
  }
  if (!rep.ok) {
    const erreur = new Error(`Supabase a répondu ${rep.status} : ${texte.slice(0, 200)}`);
    erreur.statut = rep.status;
    throw erreur;
  }
  return JSON.parse(texte);
}

// Ferme la session ouverte par ce script, et seulement elle : « scope=local » laisse connectés ton
// navigateur et ton téléphone. Un échec ici ne gêne pas la sauvegarde (la session expire seule).
async function seDeconnecter() {
  try {
    await demander(`${URL_SB}/auth/v1/logout?scope=local`, ENTETES, { method: "POST" });
  } catch {}
  ENTETES = {}; // le jeton est oublié
}

// Ouvre une session avec le compte admin, comme la page de connexion du site.
async function seConnecter({ email, motDePasse }) {
  const rep = await demander(
    `${URL_SB}/auth/v1/token?grant_type=password`,
    { apikey: CLE_PUBLIQUE, "content-type": "application/json" },
    { method: "POST", body: JSON.stringify({ email, password: motDePasse }) }
  );
  if (rep.status === 429)
    throw new Error("trop d'essais de connexion : attends quelques minutes, puis relance.");
  if (rep.status >= 400 && rep.status < 500)
    throw new Error(
      "numéro ou mot de passe admin refusé. Vérifie DOMI_ADMIN_TELEPHONE et DOMI_ADMIN_MOT_DE_PASSE dans le fichier .env."
    );
  if (!rep.ok) throw new Error(`connexion impossible (Supabase a répondu ${rep.status}).`);
  const session = await rep.json();
  if (!session.access_token || !session.user?.id)
    throw new Error("connexion impossible (réponse inattendue de Supabase).");
  ENTETES = { apikey: CLE_PUBLIQUE, Authorization: `Bearer ${session.access_token}` };

  // Un compte non admin ne lirait que SES données : la sauvegarde serait incomplète sans le dire.
  let role;
  try {
    role = (await lireJson(`${URL_SB}/rest/v1/profiles?select=role&id=eq.${session.user.id}`))[0]
      ?.role;
  } catch (e) {
    await seDeconnecter();
    throw e;
  }
  if (role !== "admin") {
    await seDeconnecter();
    throw new Error(
      "ce compte n'est pas administrateur : il ne verrait que ses propres données. Mets le numéro de ton compte admin dans .env."
    );
  }
}

// Nombre d'annonces publiques (lues comme un visiteur), pour vérifier que la copie est complète.
// null si la fonction n'existe pas (fichier 13 non exécuté).
async function compterPubliques() {
  let total = 0;
  for (;;) {
    let lot;
    try {
      lot = await lireJson(
        `${URL_SB}/rest/v1/rpc/annonces_publiques?select=id&order=id&limit=${PAGE}&offset=${total}`
      );
    } catch (e) {
      if (e.statut === 404) return null;
      throw e;
    }
    if (lot.length === 0) return total;
    total += lot.length;
  }
}

// Lit une table entière, page par page. Renvoie null si la table n'existe pas (fichier SQL non exécuté).
async function lireTable({ table, tri }) {
  const lignes = [];
  for (;;) {
    const params = new URLSearchParams({
      select: "*",
      order: tri,
      limit: String(PAGE),
      offset: String(lignes.length),
    });
    let lot;
    try {
      lot = await lireJson(`${URL_SB}/rest/v1/${table}?${params}`);
    } catch (e) {
      if (e.statut === 404) return null; // table inconnue de la base
      throw e;
    }
    if (lot.length === 0) return lignes; // page vide : tout est lu
    lignes.push(...lot);
  }
}

// Tables de la base absentes de TABLES (par exemple ajoutées par une future version du site).
// Simple contrôle : selon les réglages de Supabase, cette liste peut être refusée à un compte admin.
async function tablesOubliees() {
  try {
    const description = await lireJson(`${URL_SB}/rest/v1/`); // description automatique de l'API
    const connues = new Set([...TABLES.map((t) => t.table), ...IGNOREES]);
    return Object.keys(description.definitions || {}).filter((nom) => !connues.has(nom));
  } catch {
    return []; // contrôle impossible : la sauvegarde continue
  }
}

// ───────── 3. Photos ─────────

// Chemins (« dossier/fichier ») des photos d'annonces rangées dans NOTRE stockage. Les autres adresses sont ignorées.
function cheminsPhotos(annonces) {
  const chemins = new Set();
  for (const a of annonces || []) {
    for (const adresse of [a.image, ...(Array.isArray(a.images) ? a.images : [])]) {
      if (typeof adresse !== "string" || !adresse.startsWith(PREFIXE_PHOTOS)) continue; // photo hors de notre stockage
      let chemin;
      try {
        chemin = decodeURIComponent(adresse.slice(PREFIXE_PHOTOS.length).split(/[?#]/)[0]);
      } catch {
        continue; // adresse mal formée
      }
      // Seule forme acceptée : « identifiant/nom.webp » (bloque « ../ » et tout autre dossier)
      if (/^[\w-]+\/[\w-]+(\.[\w-]+)*$/.test(chemin)) chemins.add(chemin);
    }
  }
  return chemins;
}

// Télécharge les photos absentes du PC. Une photo ne change jamais (chaque envoi crée un nouveau
// fichier) : une photo déjà copiée n'est pas retéléchargée, ce qui économise le quota de Supabase.
async function copierPhotos(chemins, dossierPhotos) {
  const bilan = { nouvelles: 0, deja: 0, echecs: [] };
  const aFaire = [];
  for (const chemin of chemins) {
    if (existsSync(path.join(dossierPhotos, ...chemin.split("/")))) bilan.deja++;
    else aFaire.push(chemin);
  }
  async function copier(chemin) {
    const cible = path.join(dossierPhotos, ...chemin.split("/"));
    try {
      // Adresse publique : la session admin n'est PAS envoyée
      const rep = await demander(
        PREFIXE_PHOTOS + chemin.split("/").map(encodeURIComponent).join("/")
      );
      if (!rep.ok) {
        bilan.echecs.push(`${chemin} (erreur ${rep.status})`);
        return;
      }
      const octets = Buffer.from(await rep.arrayBuffer());
      await fs.mkdir(path.dirname(cible), { recursive: true });
      await fs.writeFile(`${cible}.part`, octets); // d'abord un fichier provisoire…
      await fs.rename(`${cible}.part`, cible); // …qui prend son vrai nom une fois complet
      bilan.nouvelles++;
    } catch (e) {
      bilan.echecs.push(`${chemin} (${e.message})`);
    }
  }
  for (let i = 0; i < aFaire.length; i += EN_MEME_TEMPS)
    await Promise.all(aFaire.slice(i, i + EN_MEME_TEMPS).map(copier));
  return bilan;
}

// ───────── 4. Ménage ─────────

// Date d'un dossier de sauvegarde d'après son nom (null si ce n'est pas un dossier du script).
function dateDuDossier(nom) {
  const m = nom.match(MOTIF);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

// Efface les sauvegardes de plus de 3 semaines. Ne touche qu'aux dossiers créés par ce script (nom daté).
async function effacerAnciennes() {
  const limite = Date.now() - DUREE_JOURS * 86_400_000;
  const effacees = [];
  for (const nom of await fs.readdir(RACINE)) {
    const date = dateDuDossier(nom);
    if (date && date.getTime() < limite) {
      await fs.rm(path.join(RACINE, nom), { recursive: true, force: true });
      effacees.push(nom);
    }
  }
  return effacees;
}

// Efface les photos qu'aucune sauvegarde restante n'utilise (annonce supprimée depuis longtemps…).
// Prudence : si une sauvegarde est illisible, aucune photo n'est effacée (renvoie -1).
async function effacerPhotosInutiles(dossierPhotos) {
  if (!existsSync(dossierPhotos)) return 0;
  const utiles = new Set();
  for (const nom of await fs.readdir(RACINE)) {
    if (!MOTIF.test(nom)) continue;
    try {
      const annonces = JSON.parse(
        await fs.readFile(path.join(RACINE, nom, "annonces.json"), "utf8")
      );
      for (const chemin of cheminsPhotos(annonces)) utiles.add(chemin);
    } catch {
      return -1;
    }
  }
  let effacees = 0;
  for (const dossier of await fs.readdir(dossierPhotos)) {
    const plein = path.join(dossierPhotos, dossier);
    if (!(await fs.stat(plein)).isDirectory()) continue;
    for (const fichier of await fs.readdir(plein)) {
      if (utiles.has(`${dossier}/${fichier}`)) continue;
      await fs.rm(path.join(plein, fichier), { recursive: true, force: true });
      effacees++;
    }
    if ((await fs.readdir(plein)).length === 0) await fs.rmdir(plein); // dossier devenu vide
  }
  return effacees;
}

// ───────── 5. Programme principal ─────────

const deux = (n) => String(n).padStart(2, "0"); // 7 → « 07 »
const ecrireJson = (fichier, donnees) =>
  fs.writeFile(fichier, `${JSON.stringify(donnees, null, 2)}\n`, "utf8");

// Copie les données et les photos dans le dossier provisoire, puis lui donne son vrai nom.
// Renvoie ce qu'il faut signaler à la fin.
async function copierTout(provisoire, nom) {
  const resume = [
    `Sauvegarde de Domi du ${nom.replace("_", " à ")}`,
    `Projet Supabase : ${URL_SB}`,
    "",
  ];
  // 1. Tables. On compte d'abord les annonces que voit un visiteur : la copie doit les contenir toutes.
  const publiques = await compterPubliques();
  let annonces = [];
  for (const def of TABLES) {
    const lignes = await lireTable(def);
    await ecrireJson(path.join(provisoire, def.fichier), lignes ?? []);
    if (def.table === "listings") annonces = lignes ?? [];
    if (lignes === null) {
      console.log(
        `  ⚠ ${def.fichier} : la table « ${def.table} » n'existe pas dans la base (fichier SQL pas exécuté ?)`
      );
      resume.push(`${def.fichier} : table « ${def.table} » absente de la base`);
    } else {
      console.log(`  ✔ ${def.fichier} : ${lignes.length} ligne(s)`);
      resume.push(`${def.fichier} : ${lignes.length} ligne(s) (table ${def.table})`);
    }
  }
  const approuvees = annonces.filter((a) => a.moderation === "approuvee").length;
  if (publiques !== null && approuvees < publiques)
    throw new Error(
      `copie incomplète : ${approuvees} annonce(s) publiée(s) copiée(s), mais le site en montre ${publiques}. Relance ; si ça continue, montre ce message à Claude.`
    );
  const oubliees = await tablesOubliees();

  // 2. Photos des annonces (dossier commun « photos »)
  const photos = await copierPhotos(cheminsPhotos(annonces), path.join(RACINE, "photos"));
  console.log(`  ✔ photos : ${photos.nouvelles} nouvelle(s), ${photos.deja} déjà copiée(s)`);
  resume.push(
    `photos : ${photos.nouvelles + photos.deja} photo(s) d'annonces, dans le dossier « photos » à côté`,
    "",
    "Pas copié : les pièces d'identité (supprimées après la vérification), les mots de passe, les codes",
    "« mot de passe oublié », les favoris, les vidéos, la liste des comptes de connexion.",
    "",
    "ATTENTION : ce dossier contient des données personnelles (noms, numéros de téléphone).",
    "Ne le partage avec personne et ne le mets jamais sur GitHub.",
    `Le script l'effacera automatiquement quand il aura plus de ${DUREE_JOURS / 7} semaines.`
  );
  await fs.writeFile(path.join(provisoire, "resume.txt"), `${resume.join("\r\n")}\r\n`, "utf8");
  await fs.rename(provisoire, path.join(RACINE, nom)); // sauvegarde complète : elle prend son vrai nom
  return { photos, oubliees };
}

async function principal() {
  const identifiants = chargerReglages();
  console.log("Sauvegarde de Domi (lecture seule : aucune donnée n'est modifiée)");
  console.log(`  Projet  : ${URL_SB}`);
  console.log(`  Dossier : ${RACINE}\n`);
  if (identifiants.ancienneCle)
    console.log(
      "  ⚠ DOMI_SUPABASE_SECRET_KEY n'est plus utilisée : supprime cette ligne de ton .env (clé trop puissante).\n"
    );

  // Connexion d'abord : si elle échoue, rien n'est créé sur le PC
  await seConnecter(identifiants);
  console.log("  ✔ connecté avec le compte admin");
  let nom;
  let bilan;
  try {
    await fs.mkdir(RACINE, { recursive: true });
    // Restes d'une sauvegarde interrompue (coupure de courant, fenêtre fermée) : on les efface.
    for (const reste of await fs.readdir(RACINE))
      if (reste.startsWith("en-cours_"))
        await fs.rm(path.join(RACINE, reste), { recursive: true, force: true });

    // Nom du dossier : date et heure (ex. 2026-11-22_21h30), avec _2, _3… si on relance dans la même minute
    const maintenant = new Date();
    const jour = `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
    const heure = `${deux(maintenant.getHours())}h${deux(maintenant.getMinutes())}`;
    nom = `${jour}_${heure}`;
    for (let i = 2; existsSync(path.join(RACINE, nom)); i++) nom = `${jour}_${heure}_${i}`;
    // Dossier provisoire, renommé à la toute fin : jamais de sauvegarde à moitié faite
    const provisoire = path.join(RACINE, `en-cours_${nom}`);
    await fs.mkdir(provisoire);
    try {
      bilan = await copierTout(provisoire, nom);
    } catch (e) {
      await fs.rm(provisoire, { recursive: true, force: true }); // pas de sauvegarde à moitié faite
      throw e;
    }
  } finally {
    await seDeconnecter(); // toujours, même après une erreur
  }

  // Ménage, seulement après une sauvegarde réussie
  const effacees = await effacerAnciennes();
  const inutiles = await effacerPhotosInutiles(path.join(RACINE, "photos"));
  if (effacees.length)
    console.log(
      `  ✔ sauvegarde(s) de plus de ${DUREE_JOURS / 7} semaines effacée(s) : ${effacees.join(", ")}`
    );
  if (inutiles > 0) console.log(`  ✔ ${inutiles} photo(s) qui ne servaient plus effacée(s)`);
  if (inutiles < 0)
    console.log("  ⚠ ménage des photos sauté : une sauvegarde du dossier est illisible");

  // Points d'attention
  const { photos, oubliees } = bilan;
  if (photos.echecs.length) {
    console.log(
      `\n  ⚠ ${photos.echecs.length} photo(s) non copiée(s). Relance plus tard : seules les manquantes seront téléchargées.`
    );
    for (const echec of photos.echecs.slice(0, 5)) console.log(`     - ${echec}`);
  }
  if (oubliees.length)
    console.log(
      `\n  ⚠ table(s) de la base pas dans la sauvegarde : ${oubliees.join(", ")}. Demande à Claude de les ajouter au script.`
    );

  console.log(`\nTerminé : ${path.join(RACINE, nom)}`);
  console.log(
    "Rappel : ce dossier contient des données personnelles. Ne le partage pas, ne le mets jamais sur GitHub."
  );
}

try {
  await principal();
} catch (e) {
  console.error(`\n✖ Sauvegarde ratée : ${e.message}`);
  process.exitCode = 1; // signale l'échec (utile si la sauvegarde est lancée automatiquement)
}
