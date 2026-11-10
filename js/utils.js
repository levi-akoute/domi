/* ═══════════════════════════════════════════════════════════════════
   utils.js : la boîte à outils partagée par TOUTES les pages

   Contenu :
     1. protections générales (anti-clickjacking, avertissement console)
     2. réglages de fraîcheur des annonces
     3. icônes SVG
     4. mise en forme (prix, dates, chambres) et sécurité (escapeHtml, safeUrl)
     5. raccourcis (qs, getParam), messages (showMessage, toast)
     6. support WhatsApp
     7. favoris (gardés dans le navigateur)
     8. images de secours (si une photo ne se charge pas)
     9. application installable (PWA) : service worker + bouton « Installer »
    10. en-tête (menu) et pied de page, construits sur chaque page

   Ordre de chargement : config.js → utils.js → storage.js → auth.js → script de la page
   Expose : window.ImmoUtils
   ═══════════════════════════════════════════════════════════════════ */

// (function () { … })(); s'appelle une IIFE : une fonction exécutée immédiatement.
// Tout ce qui est déclaré dedans reste PRIVÉ à ce fichier (pas de conflit de noms
// avec les autres fichiers). Seul window.ImmoUtils est partagé, à la fin.
(function () {
  // Les réglages de config.js (ou un objet vide si config.js est absent)
  const C = window.IMMOCI_CONFIG || {};

  /* ───────── 1. Protections générales ───────── */

  // ANTI-CLICKJACKING : un site pirate pourrait afficher Domi dans un cadre invisible
  // (iframe) pour faire cliquer le visiteur à son insu. Si la page est dans un cadre…
  if (window.top !== window.self) {
    // …on remplace la page « parente » par Domi lui-même : le cadre disparaît.
    window.top.location = window.self.location.href;
  }

  // AVERTISSEMENT CONSOLE : les escrocs demandent parfois de « coller un code » dans
  // la console (F12) pour voler un compte. On affiche un grand message d'alerte.
  console.log(
    "%cAttention !", // le texte (%c = le style qui suit s'applique)
    "color:#9C3B2C;font:800 40px sans-serif" // grand texte rouge
  );
  console.log(
    "%cCette console est réservée aux développeurs. Si quelqu’un vous a demandé de copier-coller quelque chose ici, c’est une arnaque : cela lui donnerait accès à votre compte Domi.",
    "font:600 16px sans-serif" // texte normal, en gras
  );

  /* ───────── 2. Fraîcheur des annonces ─────────
     Une annonce non confirmée depuis JOURS_RAPPEL jours affiche un rappel au propriétaire.
     Au-delà de JOURS_MASQUAGE jours, elle n'apparaît plus dans la liste publique. */
  const JOURS_RAPPEL = 30; // rappel après 30 jours
  const JOURS_MASQUAGE = 45; // masquage après 45 jours

  /* ───────── 3. Icônes ─────────
     Chaque icône est un tracé SVG (dessin vectoriel : net à toutes les tailles).
     On ne garde ici que l'intérieur du dessin ; icon() ajoute l'enveloppe <svg>. */
  const ICONS = {
    // repère de localisation (goutte avec un rond)
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    // lit (nombre de chambres)
    bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6"/><circle cx="6.5" cy="11" r="1.6"/>',
    // éclair (électricité, compteur CIE)
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    // goutte d'eau (compteur SODECI)
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
    // coche de validation
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    // bouclier avec coche (sécurité, propriétaire vérifié)
    shield:
      '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    // triangle « lecture » (vidéo)
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    // flèche vers la droite
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    // partage (flèche qui sort d'une boîte)
    share: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6"/>',
    // bulle WhatsApp
    whatsapp:
      '<path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.2-4.1A8 8 0 1 1 20 12z"/><path d="M9.2 8.8c.3 2.3 2.2 4.2 4.6 4.7l1.1-1.2-1.8-.9-.8.6c-.9-.4-1.5-1-1.9-1.9l.6-.8-.9-1.8z"/>',
    // combiné de téléphone
    phone:
      '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    // maison
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
    // loupe (recherche)
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
    // œil (vues)
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    // clé
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3"/>',
    // trois traits (menu « hamburger »)
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    // étoile (notes)
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    // cœur (favoris)
    heart:
      '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    // quatre carrés (liste d'annonces)
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    // drapeau (signalement)
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    // deux personnes (utilisateurs)
    users:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    // horloge (date de confirmation)
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    // enveloppe (email)
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    // cadenas (sécurité du compte)
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    // graphique en barres (statistiques)
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    // croix (fermer, supprimer)
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    // flèche vers le bas dans un plateau (télécharger, installer)
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>',
  };

  // Fabrique le code HTML d'une icône. n = nom de l'icône, cls = classe CSS en plus.
  // stroke="currentColor" : l'icône prend la couleur du texte qui l'entoure.
  // aria-hidden="true" : les lecteurs d'écran (personnes aveugles) l'ignorent (décorative).
  const icon = (n, cls = "") =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  /* ───────── 4. Mise en forme et sécurité ───────── */

  // Prix : 150000 → « 150 000 FCFA » (espaces à la française, pas de décimales)
  const money = (v) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }) // formateur de nombres français
      .format(Number(v) || 0) + " FCFA"; // Number(v) || 0 : si v n'est pas un nombre, on affiche 0

  // SÉCURITÉ : à utiliser pour TOUT texte saisi par un utilisateur inséré via innerHTML.
  // Sans elle, un titre d'annonce comme <img src=x onerror=…> exécuterait du code.
  // Elle remplace les 5 caractères dangereux par leur « entité » HTML : le navigateur
  // les AFFICHE au lieu de les INTERPRÉTER.
  const escapeHtml = (v) =>
    String(v ?? "") // v ?? "" : si v est null ou undefined, on prend une chaîne vide
      .replace(
        /[&<>"']/g, // expression régulière : tous (g) les caractères & < > " '
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] // remplacement
      );

  // SÉCURITÉ : escapeHtml ne suffit PAS pour un lien. « javascript:alert(1) » ne contient
  // aucun caractère spécial, mais s'exécute si on le met dans href. safeUrl n'accepte que
  // les adresses http:// ou https:// et renvoie "" (chaîne vide) sinon.
  const safeUrl = (v) => {
    try {
      const u = new URL(String(v || "").trim()); // analyse l'adresse (erreur si ce n'en est pas une)
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : ""; // seuls http et https passent
    } catch (e) {
      return ""; // adresse invalide : refusée
    }
  };

  // Nombre de jours écoulés depuis une date (0 = aujourd'hui, Infinity = date absente)
  const daysSince = (date) =>
    date
      ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)) // 86 400 000 ms = 1 jour
      : Infinity; // pas de date : « infiniment vieux »

  // Texte lisible : « aujourd'hui », « il y a 1 jour », « il y a 5 jours »
  const daysAgo = (date) => {
    if (!date) return "date inconnue"; // pas de date
    const d = daysSince(date); // nombre de jours
    return d === 0 ? "aujourd’hui" : `il y a ${d} jour${d > 1 ? "s" : ""}`; // pluriel si plus d'un jour
  };

  // « 3 chambres », « 1 chambre », ou rien pour un studio sans chambre séparée
  const chambresLabel = (n) => {
    n = Number(n) || 0; // convertit en nombre (0 si vide)
    return n ? `${n} chambre${n > 1 ? "s" : ""}` : ""; // 0 → chaîne vide
  };

  /* ───────── 5. Raccourcis et messages ───────── */

  // qs(".classe") = document.querySelector(".classe") : trouve le premier élément correspondant
  const qs = (s, r = document) => r.querySelector(s);

  // getParam("id") lit ?id=… dans l'adresse de la page
  const getParam = (k) => new URLSearchParams(location.search).get(k);

  // Affiche un message dans un bloc (type : "info", "success" ou "error")
  const showMessage = (el, text, type = "info") => {
    if (!el) return; // bloc introuvable : on ne fait rien
    el.textContent = text; // textContent (et non innerHTML) : aucun risque d'injection
    el.className = "notice " + type; // couleur selon le type
    el.classList.remove("hidden"); // rend le bloc visible
  };

  // Petite notification en bas de l'écran, qui disparaît seule après 3,6 secondes
  const toast = (text, type = "success") => {
    const t = document.createElement("div"); // crée un <div>
    t.className = "toast " + type; // style (vert ou rouge)
    t.setAttribute("role", "status"); // annoncé par les lecteurs d'écran
    t.textContent = text; // le message (textContent : sûr)
    document.body.appendChild(t); // ajoute à la page
    setTimeout(() => t.classList.add("show"), 10); // apparition animée (juste après l'ajout)
    setTimeout(() => {
      t.classList.remove("show"); // disparition animée…
      setTimeout(() => t.remove(), 300); // …puis suppression de la page
    }, 3600); // après 3,6 secondes
  };

  // Remplit une liste déroulante <select> avec les communes de config.js
  const fillCommunes = (sel, allLabel) => {
    if (!sel) return; // pas de liste sur cette page
    const cur = sel.value; // mémorise le choix actuel
    sel.innerHTML =
      `<option value="">${allLabel || "Choisir une commune"}</option>` + // 1re option (vide)
      (C.COMMUNES || []).map((c) => `<option>${escapeHtml(c)}</option>`).join(""); // une option par commune
    if (cur) sel.value = cur; // remet le choix précédent
  };

  /* ───────── 6. Support WhatsApp ───────── */

  // Numéro du support : celui de config.js, ou le numéro par défaut
  const supportNumber = () => {
    const n = String(C.SUPPORT_WHATSAPP || "").replace(/\D/g, ""); // garde uniquement les chiffres
    return n && n !== "2250700000000" ? n : "2250544408852"; // 2250700000000 = exemple non rempli
  };

  // Lien WhatsApp vers le support, avec un message déjà écrit (t)
  const supportLink = (t) =>
    `https://wa.me/${supportNumber()}${t ? "?text=" + encodeURIComponent(t) : ""}`; // encodeURIComponent : rend le texte sûr dans une adresse

  /* ───────── 7. Favoris ─────────
     Les locataires n'ont pas de compte : les favoris sont gardés dans le navigateur
     (localStorage = petite mémoire propre à chaque navigateur et à chaque site).
     try/catch : localStorage peut être bloqué (navigation privée), il ne faut pas planter. */
  const FAV_KEY = "domi_favoris"; // nom de la case mémoire
  const Favoris = {
    // Renvoie la liste des identifiants favoris (tableau de textes)
    list() {
      try {
        const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); // lit et décode la liste
        return Array.isArray(v) ? v.map(String) : []; // sécurité : on veut un tableau de textes
      } catch (e) {
        return []; // mémoire illisible ou bloquée : aucun favori
      }
    },
    // Vrai si l'annonce id est en favori
    has(id) {
      return this.list().includes(String(id));
    },
    // Ajoute ou retire l'annonce ; renvoie true si elle vient d'être AJOUTÉE
    toggle(id) {
      id = String(id); // identifiant en texte
      const l = this.list(); // liste actuelle
      const on = !l.includes(id); // si absent → on l'ajoute
      const next = on ? [id, ...l] : l.filter((x) => x !== id); // nouvelle liste (ajout en tête ou retrait)
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next.slice(0, 200))); // enregistre (200 favoris max)
      } catch (e) {} // mémoire bloquée : tant pis, on continue
      updateFavCount(); // met à jour le compteur du menu
      return on;
    },
  };

  // Met à jour les pastilles « nombre de favoris » du menu
  function updateFavCount() {
    const n = Favoris.list().length; // nombre de favoris
    document.querySelectorAll("[data-fav-count]").forEach((el) => {
      el.textContent = n; // affiche le nombre
      el.hidden = !n; // cache la pastille s'il n'y en a aucun
    });
  }

  // Code HTML d'un bouton cœur pour l'annonce id (utilisé sur les cartes et la fiche)
  const favButton = (id, extraClass = "") => {
    const on = Favoris.has(id); // déjà en favori ?
    // aria-pressed : indique aux lecteurs d'écran si le bouton est « enfoncé » (favori actif)
    return `<button type="button" class="fav-btn ${extraClass} ${on ? "on" : ""}" data-fav="${escapeHtml(id)}" aria-pressed="${on}" aria-label="${on ? "Retirer des favoris" : "Ajouter aux favoris"}">${icon("heart")}</button>`;
  };

  // UN SEUL écouteur pour tous les cœurs de la page (« délégation d'événement ») :
  // il marche aussi pour les cartes ajoutées plus tard (filtres, « afficher plus »).
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]"); // l'élément cliqué est-il (dans) un cœur ?
    if (!b) return; // non : on ignore
    e.preventDefault(); // empêche d'ouvrir l'annonce si le cœur est dans un lien
    const on = Favoris.toggle(b.dataset.fav); // ajoute ou retire
    // Met à jour TOUS les cœurs de cette annonce présents sur la page
    // (CSS.escape : protège l'identifiant à l'intérieur du sélecteur)
    document.querySelectorAll(`[data-fav="${CSS.escape(b.dataset.fav)}"]`).forEach((x) => {
      x.classList.toggle("on", on); // cœur plein ou vide
      x.setAttribute("aria-pressed", String(on)); // état pour les lecteurs d'écran
      x.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris");
    });
    toast(on ? "Ajouté à vos favoris" : "Retiré de vos favoris"); // confirmation visuelle
    document.dispatchEvent(new CustomEvent("favoris:change")); // prévient la page Favoris
  });

  /* ───────── 8. Images de secours ─────────
     Une photo d'annonce peut ne pas se charger (supprimée, lien cassé). Les images
     concernées portent data-fallback="assets/img/placeholder.svg".
     Avant, cela se faisait avec onerror="…" écrit DANS le HTML. On l'a déplacé ici pour
     pouvoir interdire tout JavaScript dans le HTML (règle de sécurité CSP des pages). */
  document.addEventListener(
    "error", // événement : un fichier (image…) n'a pas pu être chargé
    (e) => {
      const img = e.target; // l'élément en erreur
      if (img.tagName !== "IMG" || !img.dataset.fallback) return; // seulement les images prévues
      if (img.dataset.fallbackDone) return; // déjà remplacée : évite une boucle infinie
      img.dataset.fallbackDone = "1"; // on note le remplacement
      img.src = img.dataset.fallback; // on affiche l'image de secours
    },
    true // true = phase de « capture » : indispensable car l'erreur d'image ne remonte pas
  );

  window.ImmoUtils = {
    // Ce que les autres fichiers peuvent utiliser :
    money, // format des prix
    escapeHtml, // sécurité du texte
    safeUrl, // sécurité des liens
    daysAgo, // « il y a 3 jours »
    daysSince, // nombre de jours
    chambresLabel, // « 2 chambres »
    qs, // raccourci querySelector
    getParam, // lire l'adresse
    showMessage, // message dans un bloc
    toast, // notification
    fillCommunes, // remplir la liste des communes
    icon, // icônes
    supportNumber, // numéro du support
    supportLink, // lien WhatsApp du support
    Favoris, // gestion des favoris
    favButton, // bouton cœur
    JOURS_RAPPEL, // réglage de fraîcheur
    JOURS_MASQUAGE, // réglage de fraîcheur
  };

  /* ───────── 9. Application installable (PWA) ─────────
     PWA = « Progressive Web App » : un site qu'on peut installer comme une application
     (icône sur l'écran d'accueil, ouverture en plein écran, page hors ligne).
     Il faut : manifest.webmanifest (nom, icônes, couleurs) + sw.js (service worker). */

  // a) Enregistrement du service worker (seulement sur un vrai site http(s), pas en file://)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      // après le chargement complet : ne ralentit pas l'affichage
      navigator.serviceWorker.register("sw.js").catch(() => {}); // échec silencieux : le site marche quand même
    });
  }

  // b) Le site est-il DÉJÀ ouvert en tant qu'application installée ?
  const estInstallee = () =>
    window.matchMedia("(display-mode: standalone)").matches || // Android, ordinateur
    window.navigator.standalone === true; // iPhone (propriété spécifique à Safari)

  // c) iPhone / iPad : Safari ne propose pas de bouton d'installation automatique.
  //    On devra afficher les instructions « Partager → Sur l'écran d'accueil ».
  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // d) Android / ordinateur : le navigateur annonce « ce site est installable » avec
  //    l'événement beforeinstallprompt. On le garde de côté pour l'utiliser au clic.
  let invitation = null; // l'invitation d'installation gardée en mémoire
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // empêche le navigateur d'afficher SA bannière tout de suite
    invitation = e; // on la garde pour notre propre bouton
    afficherInstallation(); // on montre nos boutons « Installer »
  });

  // e) Une fois installée : on cache les boutons et on remercie
  window.addEventListener("appinstalled", () => {
    invitation = null; // l'invitation ne sert plus
    document.querySelectorAll("[data-install]").forEach((el) => (el.hidden = true)); // cache les boutons
    qs(".install-banner")?.remove(); // retire le bandeau
    toast("Domi est installée sur votre appareil"); // confirmation
  });

  // f) Montre les boutons « Installer » et, sur téléphone, un bandeau discret
  function afficherInstallation() {
    if (estInstallee()) return; // déjà installée : rien à proposer
    document.querySelectorAll("[data-install]").forEach((el) => (el.hidden = false)); // boutons visibles

    // Bandeau : seulement sur petit écran, et pas si le visiteur l'a fermé il y a moins de 14 jours
    const ferme = Number(localStorageGet("domi_install_ferme") || 0); // date de fermeture (ms)
    const recent = Date.now() - ferme < 14 * 86400000; // fermé depuis moins de 14 jours ?
    if (!window.matchMedia("(max-width: 760px)").matches || recent || qs(".install-banner")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="install-banner" role="dialog" aria-label="Installer l’application Domi">
        <img src="assets/img/icon-192.png" alt="" width="40" height="40">
        <div><strong>Installer Domi</strong><small>Accès direct depuis votre écran d’accueil</small></div>
        <button type="button" class="btn btn-accent btn-sm" data-install-go>Installer</button>
        <button type="button" class="icon-btn" data-install-close aria-label="Fermer">✕</button>
      </div>`
    );
  }

  // g) Lecture / écriture sûres de localStorage (peut être bloqué)
  function localStorageGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function localStorageSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }

  // h) Clics sur les boutons d'installation (délégation, comme pour les favoris)
  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-install-close]")) {
      // croix du bandeau
      localStorageSet("domi_install_ferme", String(Date.now())); // on note la date de fermeture
      qs(".install-banner")?.remove(); // on retire le bandeau
      return;
    }
    if (!e.target.closest("[data-install], [data-install-go]")) return; // autre clic : ignoré
    e.preventDefault(); // le bouton peut être un lien : on reste sur la page
    if (invitation) {
      // Android / ordinateur : on affiche la fenêtre d'installation officielle du navigateur
      invitation.prompt(); // ouvre la fenêtre « Installer Domi ? »
      await invitation.userChoice; // attend la réponse du visiteur (accepte ou refuse)
      invitation = null; // une invitation ne sert qu'une fois
      qs(".install-banner")?.remove();
    } else {
      // iPhone, ou navigateur sans installation automatique : on explique la marche à suivre
      ouvrirAideInstallation();
    }
  });

  // i) Fenêtre d'aide : comment installer à la main
  function ouvrirAideInstallation() {
    let d = qs("#install-help"); // déjà créée ?
    if (!d) {
      d = document.createElement("dialog"); // <dialog> : fenêtre modale native du navigateur
      d.id = "install-help";
      d.className = "report-dialog"; // même style que la fenêtre de signalement
      d.innerHTML = estIOS
        ? `<h3>Installer Domi sur iPhone</h3>
           <ol class="install-steps">
             <li>Ouvrez ce site dans <strong>Safari</strong>.</li>
             <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche vers le haut).</li>
             <li>Choisissez <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong>.</li>
           </ol>
           <div class="publish-actions"><button type="button" class="btn btn-primary" data-close>J’ai compris</button></div>`
        : `<h3>Installer Domi</h3>
           <ol class="install-steps">
             <li>Ouvrez le menu du navigateur (<strong>⋮</strong> en haut à droite dans Chrome).</li>
             <li>Choisissez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</li>
           </ol>
           <div class="publish-actions"><button type="button" class="btn btn-primary" data-close>J’ai compris</button></div>`;
      document.body.appendChild(d); // ajoute la fenêtre à la page
      d.querySelector("[data-close]").addEventListener("click", () => d.close()); // bouton de fermeture
    }
    d.showModal(); // affiche la fenêtre par-dessus la page
  }

  /* ───────── 10. Logo, en-tête et pied de page ───────── */

  // Logo : une maison dont la porte est un repère de localisation (« trouver un logement »)
  const MARK =
    '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#0B3B35"/><path d="M8.5 19.2 20 9.5l11.5 9.7V29a2.5 2.5 0 0 1-2.5 2.5H11A2.5 2.5 0 0 1 8.5 29z" fill="#F7F4EE"/><path d="M20 30.2s-4.9-4.3-4.9-7.8a4.9 4.9 0 0 1 9.8 0c0 3.5-4.9 7.8-4.9 7.8z" fill="#E07A1F"/><circle cx="20" cy="22.3" r="1.8" fill="#F7F4EE"/></svg>';
  // Logo + nom « Domi. », cliquable vers l'accueil
  const BRAND = `<a class="brand" href="index.html" aria-label="Domi, accueil">${MARK}<span>Domi<i>.</i></span></a>`;

  // Construit le menu et le pied de page. Lancée au DOMContentLoaded (voir tout en bas) :
  // à ce moment TOUS les scripts sont chargés, y compris auth.js qui vient après ce fichier.
  async function renderChrome() {
    let user = null; // utilisateur connecté (null = visiteur)
    try {
      user = await window.ImmoAuth?.currentUser(); // ?. : ne plante pas si auth.js manque
    } catch (e) {} // erreur réseau : on reste « visiteur »

    // Bandeau d'alerte si config.js n'est pas rempli correctement
    if (window.ImmoStorage && !window.ImmoStorage.isConfigured())
      document.body.insertAdjacentHTML(
        "afterbegin", // tout en haut de la page
        '<div class="config-banner">Base de données non configurée ou URL/clé invalide : ouvrez <code>js/config.js</code> et suivez <code>docs/GUIDE_MISE_EN_LIGNE.md</code>.</div>'
      );

    const page = location.pathname.split("/").pop() || "index.html"; // nom du fichier de la page actuelle
    const cur = (h) => (page === h ? ' aria-current="page"' : ""); // marque le lien de la page actuelle
    const admin = user && user.role === "admin"; // l'utilisateur est-il administrateur ?
    // Lien « Mon espace » : admin → administration, connecté → tableau de bord, sinon → connexion
    const espace = user ? (admin ? "admin.html" : "dashboard-proprietaire.html") : "connexion.html";
    // Bouton vert « Publier une annonce » (pas pour l'admin, qui ne publie pas)
    const cta = admin
      ? ""
      : `<a class="nav-cta" href="${user ? "publier.html" : "connexion.html?inscription=1"}">Publier une annonce</a>`;

    // EN-TÊTE : remplit <header id="site-header"></header> présent sur chaque page
    const header = document.getElementById("site-header");
    if (header)
      header.innerHTML = `
        <div class="nav-wrap container">
          ${BRAND}
          <div class="nav-tools">
            <a class="home-btn fav-link" href="favoris.html" aria-label="Mes favoris"${cur("favoris.html")}>${icon("heart")}<b data-fav-count hidden></b></a>
            <button class="menu-toggle" aria-label="Menu" aria-expanded="false">${icon("menu")}</button>
          </div>
          <nav class="main-nav">
            <a href="index.html"${cur("index.html")}>Accueil</a>
            <a href="annonces.html"${cur("annonces.html")}>Trouver un logement</a>
            <a href="favoris.html" class="fav-link"${cur("favoris.html")}>Favoris <b data-fav-count hidden></b></a>
            <a href="conseils.html"${cur("conseils.html")}>Conseils</a>
            <a href="support.html"${cur("support.html")}>Support</a>
            <a href="${espace}"${cur(espace)}>${user ? (admin ? "Administration" : "Mon espace") : "Connexion"}</a>
            <a href="#" class="install-link" data-install hidden>${icon("download")} Installer l’appli</a>
            ${cta}
            ${user ? '<button class="logout-link" id="logout-button">Déconnexion</button>' : ""}
          </nav>
        </div>`;

    // Lien WhatsApp du support avec un message tout prêt
    const wa = supportLink("Bonjour Domi, j’ai une question.");

    // PIED DE PAGE : remplit <footer id="site-footer"></footer>
    const footer = document.getElementById("site-footer");
    if (footer)
      footer.innerHTML = `
        <div class="container footer-top">
          <div>
            ${BRAND}
            <p>La plateforme qui rend la recherche de logement plus claire et plus sûre en Côte d’Ivoire : annonces contrôlées, propriétaires identifiés, contact direct.</p>
            <div class="footer-actions">
              <a class="btn btn-accent" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")} Écrire au support</a>
              <button type="button" class="btn btn-ghost-light" data-install hidden>${icon("download")} Installer l’application</button>
            </div>
          </div>
          <nav><h4>Locataires</h4>
            <a href="annonces.html">Trouver un logement</a>
            <a href="favoris.html">Mes favoris</a>
            <a href="conseils.html">Conseils de sécurité</a>
            <a href="support.html">Signaler un problème</a>
          </nav>
          <nav><h4>Annonceurs</h4>
            <a href="connexion.html?inscription=1">Publier une annonce</a>
            <a href="connexion.html">Espace annonceur</a>
            <a href="connexion.html?inscription=1">Obtenir le badge vérifié</a>
            <a href="mot-de-passe-oublie.html">Mot de passe oublié</a>
          </nav>
          <nav><h4>Informations</h4>
            <a href="conditions.html">Conditions d’utilisation</a>
            <a href="confidentialite.html">Confidentialité</a>
            <a href="support.html">Contacter le support</a>
          </nav>
        </div>
        <div class="footer-bottom"><div class="container">
          <span>© ${new Date().getFullYear()} Domi. Tous droits réservés.</span>
          <span>Visitez toujours un logement avant de payer.</span>
        </div></div>`;

    // Sur iPhone, pas d'événement d'installation automatique : on montre les boutons « Installer »
    // dès maintenant (ils ouvriront la fenêtre d'aide). Ailleurs, si l'invitation est déjà arrivée.
    if ((estIOS || invitation) && !estInstallee()) afficherInstallation();

    // Bouton WhatsApp flottant (sauf dans l'administration, où il gênerait)
    if (!document.querySelector(".wa-float") && !document.body.classList.contains("is-admin"))
      document.body.insertAdjacentHTML(
        "beforeend", // tout en bas de la page
        `<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Contacter le support sur WhatsApp">${icon("whatsapp")}<span>Support WhatsApp</span></a>`
      );

    updateFavCount(); // affiche le nombre de favoris dans le menu

    // Le bouton flottant se cache quand le pied de page est visible (il a déjà son bouton support).
    // IntersectionObserver : prévient quand un élément entre ou sort de l'écran.
    const flot = document.querySelector(".wa-float");
    if (flot && footer && "IntersectionObserver" in window)
      new IntersectionObserver(
        ([e]) => flot.classList.toggle("is-hidden", e.isIntersecting) // caché si le pied de page est visible
      ).observe(footer);

    // MENU MOBILE : ouverture / fermeture
    const toggle = document.querySelector(".menu-toggle"); // bouton ☰
    const nav = document.querySelector(".main-nav"); // la liste des liens
    toggle?.addEventListener("click", () => {
      const o = nav.classList.toggle("open"); // ouvre ou ferme (renvoie le nouvel état)
      toggle.setAttribute("aria-expanded", String(o)); // état pour les lecteurs d'écran
    });
    const closeMenu = () => {
      nav?.classList.remove("open"); // ferme le menu
      toggle?.setAttribute("aria-expanded", "false");
    };
    // Clic en dehors du menu → fermeture
    document.addEventListener("click", (e) => {
      if (nav?.classList.contains("open") && !e.target.closest(".main-nav,.menu-toggle"))
        closeMenu();
    });
    // Touche Échap → fermeture
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    // Bouton « Déconnexion » : ferme la session puis retourne à l'accueil
    document.getElementById("logout-button")?.addEventListener("click", async () => {
      await window.ImmoAuth.logout(); // supprime la session
      location.href = "index.html"; // redirection vers l'accueil
    });
  }

  // DOMContentLoaded : « la page HTML est entièrement lue » → on construit menu et pied de page
  document.addEventListener("DOMContentLoaded", renderChrome);
})(); // fin de l'IIFE (et exécution immédiate)
