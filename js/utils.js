/* ═══════════════════════════════════════════════════════════════════
   utils.js : petits outils partagés par toutes les pages
   + construction de l'en-tête (menu) et du pied de page.

   Chargé APRÈS config.js et AVANT storage.js / auth.js.
   Expose : window.ImmoUtils
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const C = window.IMMOCI_CONFIG || {};

  /* ───────── Réglages de fraîcheur des annonces ─────────
     Une annonce non confirmée depuis RAPPEL jours affiche un rappel au propriétaire.
     Au-delà de MASQUAGE jours, elle n'apparaît plus dans la liste publique. */
  const JOURS_RAPPEL = 30;
  const JOURS_MASQUAGE = 45;

  /* ───────── Icônes (tracés SVG, style « trait ») ───────── */
  const ICONS = {
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6"/><circle cx="6.5" cy="11" r="1.6"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    shield:
      '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    share: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6"/>',
    whatsapp:
      '<path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.2-4.1A8 8 0 1 1 20 12z"/><path d="M9.2 8.8c.3 2.3 2.2 4.2 4.6 4.7l1.1-1.2-1.8-.9-.8.6c-.9-.4-1.5-1-1.9-1.9l.6-.8-.9-1.8z"/>',
    phone:
      '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    heart:
      '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    users:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const icon = (n, cls = "") =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  /* ───────── Mise en forme ───────── */
  const money = (v) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(v) || 0) + " FCFA";

  // SÉCURITÉ : à utiliser pour TOUT texte saisi par un utilisateur inséré via innerHTML.
  // Transforme < > & " ' en entités HTML : le navigateur les affiche au lieu de les exécuter.
  const escapeHtml = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  // SÉCURITÉ : escapeHtml ne suffit PAS pour un lien. « javascript:alert(1) » ne contient
  // aucun caractère spécial, mais s'exécute si on le met dans href. safeUrl n'accepte que
  // les adresses http:// ou https:// et renvoie "" sinon.
  const safeUrl = (v) => {
    try {
      const u = new URL(String(v || "").trim());
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch (e) {
      return "";
    }
  };

  // Nombre de jours écoulés depuis une date (0 = aujourd'hui)
  const daysSince = (date) =>
    date ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)) : Infinity;
  const daysAgo = (date) => {
    if (!date) return "date inconnue";
    const d = daysSince(date);
    return d === 0 ? "aujourd’hui" : `il y a ${d} jour${d > 1 ? "s" : ""}`;
  };

  // « 3 chambres », « 1 chambre », ou rien pour un studio sans chambre séparée
  const chambresLabel = (n) => {
    n = Number(n) || 0;
    return n ? `${n} chambre${n > 1 ? "s" : ""}` : "";
  };

  /* ───────── Raccourcis DOM et messages ───────── */
  const qs = (s, r = document) => r.querySelector(s);
  const getParam = (k) => new URLSearchParams(location.search).get(k);
  const showMessage = (el, text, type = "info") => {
    if (!el) return;
    el.textContent = text; // textContent (et non innerHTML) : aucun risque d'injection
    el.className = "notice " + type;
    el.classList.remove("hidden");
  };
  const toast = (text, type = "success") => {
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.setAttribute("role", "status");
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3600);
  };
  const fillCommunes = (sel, allLabel) => {
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML =
      `<option value="">${allLabel || "Choisir une commune"}</option>` +
      (C.COMMUNES || []).map((c) => `<option>${escapeHtml(c)}</option>`).join("");
    if (cur) sel.value = cur;
  };

  /* ───────── Support WhatsApp ───────── */
  const supportNumber = () => {
    const n = String(C.SUPPORT_WHATSAPP || "").replace(/\D/g, "");
    return n && n !== "2250700000000" ? n : "2250544408852";
  };
  const supportLink = (t) =>
    `https://wa.me/${supportNumber()}${t ? "?text=" + encodeURIComponent(t) : ""}`;

  /* ───────── Favoris ─────────
     Les locataires n'ont pas de compte : les favoris sont gardés dans le navigateur
     (localStorage). try/catch car localStorage peut être bloqué (navigation privée). */
  const FAV_KEY = "domi_favoris";
  const Favoris = {
    list() {
      try {
        const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
        return Array.isArray(v) ? v.map(String) : [];
      } catch (e) {
        return [];
      }
    },
    has(id) {
      return this.list().includes(String(id));
    },
    toggle(id) {
      id = String(id);
      const l = this.list();
      const on = !l.includes(id);
      const next = on ? [id, ...l] : l.filter((x) => x !== id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next.slice(0, 200)));
      } catch (e) {}
      updateFavCount();
      return on;
    },
  };
  function updateFavCount() {
    const n = Favoris.list().length;
    document.querySelectorAll("[data-fav-count]").forEach((el) => {
      el.textContent = n;
      el.hidden = !n;
    });
  }
  // Bouton cœur réutilisable (cartes et fiche détail)
  const favButton = (id, extraClass = "") => {
    const on = Favoris.has(id);
    return `<button type="button" class="fav-btn ${extraClass} ${on ? "on" : ""}" data-fav="${escapeHtml(id)}" aria-pressed="${on}" aria-label="${on ? "Retirer des favoris" : "Ajouter aux favoris"}">${icon("heart")}</button>`;
  };
  // Un seul écouteur pour tous les cœurs de la page (délégation d'événement)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    e.preventDefault();
    const on = Favoris.toggle(b.dataset.fav);
    document.querySelectorAll(`[data-fav="${CSS.escape(b.dataset.fav)}"]`).forEach((x) => {
      x.classList.toggle("on", on);
      x.setAttribute("aria-pressed", String(on));
      x.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris");
    });
    toast(on ? "Ajouté à vos favoris" : "Retiré de vos favoris");
    document.dispatchEvent(new CustomEvent("favoris:change"));
  });

  window.ImmoUtils = {
    money,
    escapeHtml,
    safeUrl,
    daysAgo,
    daysSince,
    chambresLabel,
    qs,
    getParam,
    showMessage,
    toast,
    fillCommunes,
    icon,
    supportNumber,
    supportLink,
    Favoris,
    favButton,
    JOURS_RAPPEL,
    JOURS_MASQUAGE,
  };

  /* ───────── Logo ─────────
     Une maison dont la porte est un repère de localisation : « trouver un logement ». */
  const MARK =
    '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#0B3B35"/><path d="M8.5 19.2 20 9.5l11.5 9.7V29a2.5 2.5 0 0 1-2.5 2.5H11A2.5 2.5 0 0 1 8.5 29z" fill="#F7F4EE"/><path d="M20 30.2s-4.9-4.3-4.9-7.8a4.9 4.9 0 0 1 9.8 0c0 3.5-4.9 7.8-4.9 7.8z" fill="#E07A1F"/><circle cx="20" cy="22.3" r="1.8" fill="#F7F4EE"/></svg>';
  const BRAND = `<a class="brand" href="index.html" aria-label="Domi, accueil">${MARK}<span>Domi<i>.</i></span></a>`;

  /* ───────── En-tête et pied de page ─────────
     Lancé au DOMContentLoaded : à ce moment tous les scripts (dont auth.js) sont chargés. */
  async function renderChrome() {
    let user = null;
    try {
      user = await window.ImmoAuth?.currentUser();
    } catch (e) {}

    if (window.ImmoStorage && !window.ImmoStorage.isConfigured())
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<div class="config-banner">Base de données non configurée ou URL/clé invalide : ouvrez <code>js/config.js</code> et suivez <code>docs/GUIDE_MISE_EN_LIGNE.md</code>.</div>'
      );

    const page = location.pathname.split("/").pop() || "index.html";
    const cur = (h) => (page === h ? ' aria-current="page"' : "");
    const admin = user && user.role === "admin";
    const espace = user ? (admin ? "admin.html" : "dashboard-proprietaire.html") : "connexion.html";
    const cta = admin
      ? ""
      : `<a class="nav-cta" href="${user ? "publier.html" : "connexion.html?inscription=1"}">Publier une annonce</a>`;

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
            ${cta}
            ${user ? '<button class="logout-link" id="logout-button">Déconnexion</button>' : ""}
          </nav>
        </div>`;

    const wa = supportLink("Bonjour Domi, j’ai une question.");
    const footer = document.getElementById("site-footer");
    if (footer)
      footer.innerHTML = `
        <div class="container footer-top">
          <div>
            ${BRAND}
            <p>La plateforme qui rend la recherche de logement plus claire et plus sûre en Côte d’Ivoire : annonces contrôlées, propriétaires identifiés, contact direct.</p>
            <a class="btn btn-accent" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")} Écrire au support</a>
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

    // Bouton WhatsApp flottant (sauf dans l'administration, où il gênerait)
    if (!document.querySelector(".wa-float") && !document.body.classList.contains("is-admin"))
      document.body.insertAdjacentHTML(
        "beforeend",
        `<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Contacter le support sur WhatsApp">${icon("whatsapp")}<span>Support WhatsApp</span></a>`
      );

    updateFavCount();

    // Le bouton flottant se cache quand le pied de page est visible (il a déjà son bouton support)
    const flot = document.querySelector(".wa-float");
    if (flot && footer && "IntersectionObserver" in window)
      new IntersectionObserver(([e]) =>
        flot.classList.toggle("is-hidden", e.isIntersecting)
      ).observe(footer);

    // Menu mobile : ouverture, fermeture au clic extérieur et avec Échap
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".main-nav");
    toggle?.addEventListener("click", () => {
      const o = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(o));
    });
    const closeMenu = () => {
      nav?.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
    };
    document.addEventListener("click", (e) => {
      if (nav?.classList.contains("open") && !e.target.closest(".main-nav,.menu-toggle"))
        closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    document.getElementById("logout-button")?.addEventListener("click", async () => {
      await window.ImmoAuth.logout();
      location.href = "index.html";
    });
  }
  document.addEventListener("DOMContentLoaded", renderChrome);
})();
