/* ═══════════════════════════════════════════════════════════════════
   sw.js : le « service worker » de Domi (application installable)

   Qu'est-ce que c'est ? Un petit script que le navigateur fait tourner
   EN ARRIÈRE-PLAN, séparément de la page. Il se place entre le site et
   Internet : chaque fois que la page demande un fichier, il peut décider
   de le prendre sur Internet ou dans une réserve locale (le « cache »).

   Ce qu'il apporte à Domi :
     1. il rend le site INSTALLABLE sur téléphone (avec manifest.webmanifest) ;
     2. il affiche une page « Pas de connexion » au lieu d'une erreur ;
     3. il accélère l'affichage des fichiers déjà visités.

   Stratégie choisie : « réseau d'abord ». On essaie TOUJOURS Internet en
   premier, pour que les visiteurs voient immédiatement chaque mise à jour.
   Le cache ne sert que si Internet ne répond pas.

   ⚠ Les données (annonces, comptes) viennent de Supabase, un autre site :
   ce script ne les touche JAMAIS. Il ne gère que les fichiers de Domi.
   ═══════════════════════════════════════════════════════════════════ */

// Nom de la réserve. « __VERSION__ » est remplacé automatiquement à chaque
// publication (scripts/build.mjs) : une nouvelle version = une nouvelle réserve.
const CACHE = "domi-__VERSION__";

// Fichiers mis en réserve dès l'installation, pour que la page hors ligne s'affiche bien.
const ESSENTIELS = [
  "./", // la page d'accueil
  "./index.html", // la page d'accueil (nom complet)
  "./offline.html", // la page « Pas de connexion »
  "./css/style.css", // la feuille de style
  "./assets/img/favicon.svg", // le logo
  "./assets/img/icon-192.png", // l'icône de l'application
];

// ───────── 1. Installation ─────────
// Événement « install » : déclenché une seule fois, quand le navigateur découvre ce script.
self.addEventListener("install", (event) => {
  // waitUntil : « ne considère pas l'installation terminée tant que ceci n'est pas fini »
  event.waitUntil(
    caches
      .open(CACHE) // ouvre (ou crée) la réserve
      .then((cache) => cache.addAll(ESSENTIELS)) // télécharge et range les fichiers essentiels
      .then(() => self.skipWaiting()) // active la nouvelle version sans attendre la fermeture des onglets
  );
});

// ───────── 2. Activation ─────────
// Événement « activate » : la nouvelle version prend le relais. On supprime les anciennes réserves.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys() // liste toutes les réserves existantes
      .then((noms) =>
        Promise.all(
          noms
            .filter((nom) => nom.startsWith("domi-") && nom !== CACHE) // les anciennes versions de Domi…
            .map((nom) => caches.delete(nom)) // …sont supprimées
        )
      )
      .then(() => self.clients.claim()) // prend immédiatement le contrôle des pages ouvertes
  );
});

// ───────── 3. Interception des requêtes ─────────
// Événement « fetch » : déclenché à CHAQUE fichier demandé par la page.
self.addEventListener("fetch", (event) => {
  const req = event.request; // la requête (adresse, méthode…)
  const url = new URL(req.url); // l'adresse découpée en morceaux

  // On ne s'occupe que des lectures (GET) sur le site lui-même.
  // Supabase, Google Fonts, le CDN, WhatsApp : on laisse passer sans rien faire.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // respondWith : « c'est moi qui fournis la réponse »
  event.respondWith(
    fetch(req) // 1) on essaie Internet
      .then((reponse) => {
        // Si la réponse est bonne, on en garde une copie dans la réserve pour plus tard.
        // clone() : une réponse ne se lit qu'une fois, il en faut une pour la page et une pour la réserve.
        if (reponse.ok) {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copie));
        }
        return reponse; // la page reçoit la réponse d'Internet
      })
      .catch(async () => {
        // 2) Internet ne répond pas : on cherche dans la réserve.
        const enReserve = await caches.match(req);
        if (enReserve) return enReserve; // trouvé : on l'affiche
        // 3) Rien en réserve et c'est une PAGE : on affiche la page « Pas de connexion ».
        if (req.mode === "navigate") return caches.match("./offline.html");
        // 4) Sinon (image, script…) : réponse vide « service indisponible ».
        return new Response("", { status: 503, statusText: "Hors ligne" });
      })
  );
});
