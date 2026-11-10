/* ═══════════════════════════════════════════════════════════════════
   annonces.js : cartes d'annonces, catalogue avec filtres, accueil

   Utilisé par : index.html (#home-listings), annonces.html (#all-listings)
   et favoris.html (via window.ImmoCards.card).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const U = window.ImmoUtils;
  const S = window.ImmoStorage;
  const PAGE = 12; // annonces affichées par « page » (bouton « Afficher plus »)
  const FALLBACK = "assets/img/placeholder.svg";
  let all = []; // toutes les annonces chargées depuis la base
  let shown = PAGE;

  /* ───────── Carte d'une annonce ─────────
     SÉCURITÉ : chaque valeur venant de la base passe par E() (escapeHtml)
     ou par safeUrl() pour les adresses d'images. */
  function card(a) {
    const E = U.escapeHtml;
    const I = U.icon;
    const href = "maison-detail.html?id=" + encodeURIComponent(a.id);
    const img = U.safeUrl(a.image) || FALLBACK;
    const dispo = a.statut === "Disponible";
    const ch = U.chambresLabel(a.chambres);
    const note =
      Number(a.nb_avis) > 0
        ? `<span class="rt">${I("star")} ${String(a.note_moyenne).replace(".", ",")} <small>(${a.nb_avis})</small></span>`
        : "";
    return `
      <article class="listing-card">
        <a class="listing-image" href="${href}">
          <img src="${E(img)}" alt="${E(a.titre)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'">
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
  const skeleton = (n) =>
    Array.from({ length: n }, () => '<div class="listing-card skeleton"></div>').join("");
  window.ImmoCards = { card, skeleton };

  /* ───────── Catalogue (annonces.html) ───────── */
  // Identifiant du champ HTML → nom du paramètre dans l'adresse de la page
  const FILTRES = {
    "#filter-q": "q",
    "#filter-commune": "commune",
    "#filter-type": "type",
    "#filter-budget-min": "min",
    "#filter-budget": "budget",
    "#filter-chambres": "chambres",
    "#filter-status": "statut",
    "#filter-verifie": "verifie",
    "#filter-video": "video",
    "#filter-sort": "tri",
  };
  const val = (sel) => {
    const el = U.qs(sel);
    if (!el) return "";
    return el.type === "checkbox" ? (el.checked ? "1" : "") : el.value;
  };

  function filtered() {
    const q = val("#filter-q").trim().toLowerCase();
    const commune = val("#filter-commune");
    const type = val("#filter-type");
    const min = Number(val("#filter-budget-min")) || 0;
    const max = Number(val("#filter-budget")) || Infinity;
    const chambres = Number(val("#filter-chambres")) || 0;
    const statut = val("#filter-status");
    const verifie = val("#filter-verifie");
    const video = val("#filter-video");
    const tri = val("#filter-sort");

    const r = all.filter(
      (a) =>
        (!q ||
          `${a.titre} ${a.commune} ${a.quartier} ${a.description}`.toLowerCase().includes(q)) &&
        (!commune || a.commune === commune) &&
        (!type || a.type === type) &&
        Number(a.loyer) >= min &&
        Number(a.loyer) <= max &&
        (Number(a.chambres) || 0) >= chambres &&
        (!statut || a.statut === statut) &&
        (!verifie || a.proprietaire_verifie) &&
        (!video || !!a.video)
    );
    // Sans tri choisi, l'ordre de la base est gardé (les plus récentes d'abord)
    if (tri === "prix-asc") r.sort((a, b) => a.loyer - b.loyer);
    else if (tri === "prix-desc") r.sort((a, b) => b.loyer - a.loyer);
    else if (tri === "note")
      r.sort(
        (a, b) =>
          (b.note_moyenne || 0) - (a.note_moyenne || 0) || (b.nb_avis || 0) - (a.nb_avis || 0)
      );
    else if (tri === "frais") r.sort((a, b) => new Date(b.confirmee_le) - new Date(a.confirmee_le));
    return r;
  }

  // Garde les filtres dans l'adresse (annonces.html?commune=Cocody&budget=150000) :
  // on peut partager une recherche sur WhatsApp ou revenir en arrière sans la perdre.
  function syncUrl() {
    const p = new URLSearchParams();
    Object.entries(FILTRES).forEach(([sel, key]) => {
      const v = val(sel);
      if (v) p.set(key, v);
    });
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }

  function renderCatalog() {
    const items = filtered();
    U.qs("#all-listings").innerHTML = items.slice(0, shown).map(card).join("");
    U.qs("#results-count").textContent = `${items.length} annonce${items.length > 1 ? "s" : ""}`;
    U.qs("#empty-state").classList.toggle("hidden", items.length > 0);
    U.qs("#load-more").classList.toggle("hidden", items.length <= shown);
    // Pastille sur le bouton « Filtres » (mobile) : nombre de filtres actifs
    const n = Object.keys(FILTRES).filter((s) => s !== "#filter-sort" && val(s)).length;
    const badge = U.qs("#filters-count");
    if (badge) {
      badge.textContent = n;
      badge.hidden = !n;
    }
    syncUrl();
  }

  async function initCatalog() {
    U.fillCommunes(U.qs("#filter-commune"), "Toutes les communes");

    // Remplit les filtres à partir de l'adresse de la page
    const p = new URLSearchParams(location.search);
    Object.entries(FILTRES).forEach(([sel, key]) => {
      const el = U.qs(sel);
      const v = p.get(key);
      if (!el || v === null) return;
      if (el.type === "checkbox") el.checked = v === "1";
      else el.value = v;
    });

    Object.keys(FILTRES).forEach((s) =>
      U.qs(s)?.addEventListener("input", () => {
        shown = PAGE;
        renderCatalog();
      })
    );
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
    U.qs("#load-more").addEventListener("click", () => {
      shown += PAGE;
      renderCatalog();
    });
    // Mobile : le panneau de filtres s'ouvre et se ferme
    U.qs("#toggle-filters")?.addEventListener("click", () =>
      U.qs(".filter-card").classList.toggle("open")
    );
    U.qs("#close-filters")?.addEventListener("click", () =>
      U.qs(".filter-card").classList.remove("open")
    );

    U.qs("#all-listings").innerHTML = skeleton(6);
    try {
      all = await S.getAnnonces();
    } catch (e) {
      U.qs("#all-listings").innerHTML = "";
      const es = U.qs("#empty-state");
      es.classList.remove("hidden");
      es.innerHTML = `<h3>Chargement impossible</h3><p>${U.escapeHtml(e.message)}</p>`;
      return;
    }
    renderCatalog();
  }

  /* ───────── Accueil (index.html) ───────── */
  async function initHome() {
    U.fillCommunes(U.qs("#search-commune"), "Toutes les communes");
    const host = U.qs("#home-listings");
    host.innerHTML = skeleton(3);
    try {
      const dispo = (await S.getAnnonces()).filter((a) => a.statut === "Disponible");
      if (window.ImmoCarousel) window.ImmoCarousel.addListings(dispo);
      const list = dispo.slice(0, 8);
      host.innerHTML = list.length
        ? list.map(card).join("")
        : '<div class="empty-state" style="grid-column:1/-1"><h3>Les premières annonces arrivent bientôt</h3><p>Vous proposez un bien ? Soyez parmi les premiers à publier.</p></div>';
    } catch (e) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>${U.escapeHtml(e.message)}</p></div>`;
    }
    // Barre de recherche : redirige vers le catalogue avec les filtres dans l'adresse
    U.qs("#home-search")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const p = new URLSearchParams();
      const c = U.qs("#search-commune").value;
      const t = U.qs("#search-type").value;
      const b = U.qs("#search-budget").value;
      if (c) p.set("commune", c);
      if (t) p.set("type", t);
      if (b) p.set("budget", b);
      location.href = "annonces.html?" + p;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (U.qs("#all-listings")) initCatalog();
    if (U.qs("#home-listings")) initHome();
  });
})();
