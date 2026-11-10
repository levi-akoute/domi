/* ═══════════════════════════════════════════════════════════════════
   annonces.js : cartes d'annonces, catalogue avec filtres, accueil

   Utilisé par : index.html (#home-listings), annonces.html (#all-listings)
   et favoris.html (via window.ImmoCards.card).

   Principe du catalogue : TOUTES les annonces sont chargées une seule fois,
   puis filtrées dans le navigateur. Chaque changement de filtre réaffiche
   la liste instantanément, sans nouvelle requête vers la base.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const U = window.ImmoUtils; // boîte à outils (utils.js)
  const S = window.ImmoStorage; // accès à la base (storage.js)
  const PAGE = 12; // nombre d'annonces affichées à chaque « page » (bouton « Afficher plus »)
  const FALLBACK = "assets/img/placeholder.svg"; // image affichée si une photo manque
  let all = []; // toutes les annonces chargées depuis la base
  let shown = PAGE; // combien on en affiche actuellement

  /* ───────── Carte d'une annonce ─────────
     Renvoie le code HTML d'une carte. a = une annonce (une ligne de la table listings).
     SÉCURITÉ : chaque valeur venant de la base passe par E() (escapeHtml) ou par
     safeUrl() pour les adresses, car un annonceur peut avoir écrit n'importe quoi. */
  function card(a) {
    const E = U.escapeHtml; // raccourci : protection du texte
    const I = U.icon; // raccourci : icônes
    const href = "maison-detail.html?id=" + encodeURIComponent(a.id); // lien vers la fiche
    const img = U.safeUrl(a.image) || FALLBACK; // photo principale (ou image de secours)
    const dispo = a.statut === "Disponible"; // logement disponible ?
    const ch = U.chambresLabel(a.chambres); // « 2 chambres » (vide pour un studio)
    // Note moyenne, seulement s'il y a au moins un avis publié
    const note =
      Number(a.nb_avis) > 0
        ? `<span class="rt">${I("star")} ${String(Number(a.note_moyenne)).replace(".", ",")} <small>(${Number(a.nb_avis)})</small></span>`
        : "";
    // data-fallback : si la photo ne charge pas, utils.js la remplace par l'image de secours
    return `
      <article class="listing-card">
        <a class="listing-image" href="${href}">
          <img src="${E(img)}" alt="${E(a.titre)}" loading="lazy" data-fallback="${FALLBACK}">
          <span class="status-badge ${dispo ? "available" : "unavailable"}">${E(a.statut || "")}</span>
          ${a.video ? `<span class="video-badge">${I("play")} Vidéo</span>` : ""}
        </a>
        ${U.favButton(a.id, "on-card")}
        <div class="listing-body">
          <div class="listing-location">${I("pin")} ${E(a.commune)}${a.quartier ? " · " + E(a.quartier) : ""}</div>
          <h3><a href="${href}">${E(a.titre)}</a></h3>
          <div class="listing-meta">
            <span>${E(a.type)}</span>
            ${ch ? `<span>${I("bed")} ${ch}</span>` : ""}
            ${a.proprietaire_verifie ? `<span class="verified-inline">${I("shield")} Vérifié</span>` : ""}
          </div>
          <div class="listing-bottom">
            <div class="listing-price">${U.money(a.loyer)} <small>/ mois</small></div>
            ${note}
          </div>
          <div class="freshness">${I("clock")} Confirmée ${U.daysAgo(a.confirmee_le)}</div>
        </div>
      </article>`;
  }

  // Cartes grises animées affichées pendant le chargement (« squelettes »)
  const skeleton = (n) =>
    Array.from({ length: n }, () => '<div class="listing-card skeleton"></div>').join("");

  // Rend card() et skeleton() utilisables par favoris.js
  window.ImmoCards = { card, skeleton };

  /* ───────── Catalogue (annonces.html) ───────── */

  // Correspondance : identifiant du champ HTML → nom du paramètre dans l'adresse de la page
  const FILTRES = {
    "#filter-q": "q", // recherche libre
    "#filter-commune": "commune", // commune
    "#filter-type": "type", // type de bien
    "#filter-budget-min": "min", // loyer minimum
    "#filter-budget": "budget", // loyer maximum
    "#filter-chambres": "chambres", // nombre minimum de chambres
    "#filter-status": "statut", // disponibilité
    "#filter-verifie": "verifie", // case « propriétaires vérifiés »
    "#filter-video": "video", // case « avec visite vidéo »
    "#filter-sort": "tri", // ordre de tri
  };

  // Valeur actuelle d'un champ de filtre ("1" ou "" pour une case à cocher)
  const val = (sel) => {
    const el = U.qs(sel); // le champ
    if (!el) return ""; // absent de la page
    return el.type === "checkbox" ? (el.checked ? "1" : "") : el.value;
  };

  // Applique tous les filtres et le tri ; renvoie la liste à afficher
  function filtered() {
    const q = val("#filter-q").trim().toLowerCase(); // recherche, en minuscules
    const commune = val("#filter-commune");
    const type = val("#filter-type");
    const min = Number(val("#filter-budget-min")) || 0; // vide → 0
    const max = Number(val("#filter-budget")) || Infinity; // vide → pas de limite
    const chambres = Number(val("#filter-chambres")) || 0;
    const statut = val("#filter-status");
    const verifie = val("#filter-verifie");
    const video = val("#filter-video");
    const tri = val("#filter-sort");

    // filter : garde une annonce seulement si TOUTES les conditions sont vraies (&&)
    const r = all.filter(
      (a) =>
        // recherche dans le titre, la commune, le quartier et la description
        (!q ||
          `${a.titre} ${a.commune} ${a.quartier} ${a.description}`.toLowerCase().includes(q)) &&
        (!commune || a.commune === commune) && // commune choisie (ou toutes)
        (!type || a.type === type) && // type choisi (ou tous)
        Number(a.loyer) >= min && // loyer au-dessus du minimum
        Number(a.loyer) <= max && // loyer en dessous du maximum
        (Number(a.chambres) || 0) >= chambres && // assez de chambres
        (!statut || a.statut === statut) && // disponibilité
        (!verifie || a.proprietaire_verifie) && // propriétaire vérifié si demandé
        (!video || !!a.video) // vidéo si demandée
    );
    // Tri. Sans tri choisi, l'ordre de la base est gardé (les plus récentes d'abord).
    // sort((a, b) => …) : un résultat négatif place a avant b.
    if (tri === "prix-asc")
      r.sort((a, b) => a.loyer - b.loyer); // moins cher d'abord
    else if (tri === "prix-desc")
      r.sort((a, b) => b.loyer - a.loyer); // plus cher d'abord
    else if (tri === "note")
      r.sort(
        (a, b) =>
          (b.note_moyenne || 0) - (a.note_moyenne || 0) || // meilleure note d'abord…
          (b.nb_avis || 0) - (a.nb_avis || 0) // …à égalité, le plus d'avis d'abord
      );
    else if (tri === "frais") r.sort((a, b) => new Date(b.confirmee_le) - new Date(a.confirmee_le)); // confirmées récemment
    return r;
  }

  // Recopie les filtres dans l'adresse (annonces.html?commune=Cocody&budget=150000) :
  // on peut partager une recherche sur WhatsApp ou revenir en arrière sans la perdre.
  function syncUrl() {
    const p = new URLSearchParams(); // paramètres d'adresse vides
    Object.entries(FILTRES).forEach(([sel, key]) => {
      const v = val(sel);
      if (v) p.set(key, v); // seulement les filtres remplis
    });
    // replaceState : change l'adresse SANS recharger la page ni créer d'entrée d'historique
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }

  // Affiche le catalogue selon les filtres
  function renderCatalog() {
    const items = filtered(); // annonces retenues
    U.qs("#all-listings").innerHTML = items.slice(0, shown).map(card).join(""); // les « shown » premières
    U.qs("#results-count").textContent = `${items.length} annonce${items.length > 1 ? "s" : ""}`; // compteur
    U.qs("#empty-state").classList.toggle("hidden", items.length > 0); // message « aucune annonce »
    U.qs("#load-more").classList.toggle("hidden", items.length <= shown); // bouton « Afficher plus »
    // Pastille sur le bouton « Filtres » (mobile) : nombre de filtres actifs (le tri ne compte pas)
    const n = Object.keys(FILTRES).filter((s) => s !== "#filter-sort" && val(s)).length;
    const badge = U.qs("#filters-count");
    if (badge) {
      badge.textContent = n;
      badge.hidden = !n; // cachée si aucun filtre
    }
    syncUrl(); // met à jour l'adresse
  }

  // Préparation du catalogue (une seule fois, au chargement de la page)
  async function initCatalog() {
    U.fillCommunes(U.qs("#filter-commune"), "Toutes les communes"); // remplit la liste des communes

    // Remplit les filtres à partir de l'adresse de la page (lien partagé, retour arrière)
    const p = new URLSearchParams(location.search);
    Object.entries(FILTRES).forEach(([sel, key]) => {
      const el = U.qs(sel);
      const v = p.get(key);
      if (!el || v === null) return; // champ absent ou paramètre absent
      if (el.type === "checkbox") el.checked = v === "1";
      else el.value = v;
    });

    // À chaque saisie dans un filtre : on revient à la 1re page et on réaffiche
    Object.keys(FILTRES).forEach((s) =>
      U.qs(s)?.addEventListener("input", () => {
        shown = PAGE;
        renderCatalog();
      })
    );
    // Bouton « Réinitialiser » : vide tous les filtres
    U.qs("#reset-filters").addEventListener("click", () => {
      Object.keys(FILTRES).forEach((s) => {
        const el = U.qs(s);
        if (!el) return;
        if (el.type === "checkbox") el.checked = false;
        else el.value = "";
      });
      shown = PAGE;
      renderCatalog();
    });
    // Bouton « Afficher plus » : 12 annonces de plus
    U.qs("#load-more").addEventListener("click", () => {
      shown += PAGE;
      renderCatalog();
    });
    // Mobile : le panneau de filtres s'ouvre (bouton « Filtres ») et se ferme (croix)
    U.qs("#toggle-filters")?.addEventListener("click", () =>
      U.qs(".filter-card").classList.toggle("open")
    );
    U.qs("#close-filters")?.addEventListener("click", () =>
      U.qs(".filter-card").classList.remove("open")
    );

    U.qs("#all-listings").innerHTML = skeleton(6); // squelettes pendant le chargement
    try {
      all = await S.getAnnonces(); // chargement depuis la base
    } catch (e) {
      // Échec : on affiche le message d'erreur à la place de la liste
      U.qs("#all-listings").innerHTML = "";
      const es = U.qs("#empty-state");
      es.classList.remove("hidden");
      es.innerHTML = `<h3>Chargement impossible</h3><p>${U.escapeHtml(e.message)}</p>`;
      return;
    }
    renderCatalog(); // premier affichage
  }

  /* ───────── Accueil (index.html) ───────── */
  async function initHome() {
    U.fillCommunes(U.qs("#search-commune"), "Toutes les communes"); // barre de recherche
    const host = U.qs("#home-listings"); // zone « Dernières annonces »
    host.innerHTML = skeleton(3); // squelettes
    try {
      // Annonces disponibles uniquement
      const dispo = (await S.getAnnonces()).filter((a) => a.statut === "Disponible");
      if (window.ImmoCarousel) window.ImmoCarousel.addListings(dispo); // 3 annonces dans le carrousel
      const list = dispo.slice(0, 8); // 8 dernières
      host.innerHTML = list.length
        ? list.map(card).join("")
        : '<div class="empty-state span-all"><h3>Les premières annonces arrivent bientôt</h3><p>Vous proposez un bien ? Soyez parmi les premiers à publier.</p></div>';
    } catch (e) {
      host.innerHTML = `<div class="empty-state span-all"><p>${U.escapeHtml(e.message)}</p></div>`;
    }
    // Barre de recherche : redirige vers le catalogue avec les filtres dans l'adresse
    U.qs("#home-search")?.addEventListener("submit", (e) => {
      e.preventDefault(); // empêche l'envoi classique du formulaire
      const p = new URLSearchParams();
      const c = U.qs("#search-commune").value;
      const t = U.qs("#search-type").value;
      const b = U.qs("#search-budget").value;
      if (c) p.set("commune", c);
      if (t) p.set("type", t);
      if (b) p.set("budget", b);
      location.href = "annonces.html?" + p; // ouvre le catalogue filtré
    });
  }

  // Lance la bonne préparation selon la page
  document.addEventListener("DOMContentLoaded", () => {
    if (U.qs("#all-listings")) initCatalog(); // page catalogue
    if (U.qs("#home-listings")) initHome(); // page d'accueil
  });
})(); // fin de l'IIFE
