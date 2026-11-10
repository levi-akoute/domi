(function () {
  const C = window.IMMOCI_CONFIG || {};
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
  };
  const icon = (n, cls = "") =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const money = (v) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(v) || 0) + " FCFA";
  const escapeHtml = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  const daysAgo = (date) => {
    if (!date) return "date inconnue";
    const d = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
    return d === 0 ? "aujourd’hui" : `il y a ${d} jour${d > 1 ? "s" : ""}`;
  };
  const qs = (s, r = document) => r.querySelector(s);
  const getParam = (k) => new URLSearchParams(location.search).get(k);
  const showMessage = (el, text, type = "info") => {
    if (!el) return;
    el.textContent = text;
    el.className = "notice " + type;
    el.classList.remove("hidden");
  };
  const toast = (text, type = "success") => {
    const t = document.createElement("div");
    t.className = "toast " + type;
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
  const supportNumber = () => {
    const n = String(C.SUPPORT_WHATSAPP || "").replace(/\D/g, "");
    return n && n !== "2250700000000" ? n : "2250544408852";
  };
  const supportLink = (t) =>
    `https://wa.me/${supportNumber()}${t ? "?text=" + encodeURIComponent(t) : ""}`;
  window.ImmoUtils = {
    money,
    escapeHtml,
    daysAgo,
    qs,
    getParam,
    showMessage,
    toast,
    fillCommunes,
    icon,
    supportNumber,
    supportLink,
  };

  const MARK =
    '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0B3B35"/><path d="M9 21l11-10 11 10v10H9z" fill="#F7F4EE"/><rect x="17" y="22" width="6" height="9" rx="1.2" fill="#E07A1F"/></svg>';
  const BRAND = `<a class="brand" href="index.html" aria-label="Domi, accueil">${MARK}<span>Domi<i>.</i></span></a>`;

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
    const page = location.pathname.split("/").pop() || "index.html",
      cur = (h) => (page === h ? ' aria-current="page"' : ""),
      admin = user && user.role === "admin",
      sp = user ? (admin ? "admin.html" : "dashboard-proprietaire.html") : "connexion.html";
    const header = document.getElementById("site-header");
    if (header)
      header.innerHTML = `<div class="nav-wrap container">${BRAND}<div class="nav-tools"><a class="home-btn" href="index.html" aria-label="Accueil"${cur("index.html")}>${icon("home")}</a><button class="menu-toggle" aria-label="Menu" aria-expanded="false">${icon("menu")}</button></div><nav class="main-nav"><a href="index.html"${cur("index.html")}>Accueil</a><a href="annonces.html"${cur("annonces.html")}>Trouver un logement</a><a href="conseils.html"${cur("conseils.html")}>Conseils</a><a href="support.html"${cur("support.html")}>Support</a><a href="${sp}"${cur(sp)}>${user ? "Mon espace" : "Connexion"}</a>${admin ? "" : `<a class="nav-cta" href="${user ? "publier.html" : "connexion.html?inscription=1"}">Publier une annonce</a>`}${user ? '<button class="logout-link" id="logout-button">Déconnexion</button>' : ""}</nav></div>`;
    const wa = supportLink("Bonjour Domi, j’ai une question.");
    const footer = document.getElementById("site-footer");
    if (footer)
      footer.innerHTML = `<div class="container footer-top"><div>${BRAND}<p>La plateforme qui rend la recherche de logement plus claire et plus sûre en Côte d’Ivoire : annonces examinées, propriétaires identifiés, contact direct.</p><a class="btn btn-accent" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")} Écrire au support</a></div><nav><h4>Locataires</h4><a href="index.html">Accueil</a><a href="annonces.html">Trouver un logement</a><a href="conseils.html">Conseils de sécurité</a><a href="annonces.html">Signaler une annonce</a></nav><nav><h4>Annonceurs</h4><a href="connexion.html?inscription=1">Publier une annonce</a><a href="connexion.html">Espace annonceur</a><a href="connexion.html?inscription=1">Obtenir le badge vérifié</a></nav><nav><h4>Informations</h4><a href="conditions.html">Conditions d’utilisation</a><a href="confidentialite.html">Confidentialité</a><a href="support.html">Contacter le support</a><a href="mot-de-passe-oublie.html">Mot de passe oublié</a></nav></div><div class="footer-bottom"><div class="container"><span>© ${new Date().getFullYear()} Domi. Tous droits réservés.</span><span>Visitez toujours un logement avant de payer.</span></div></div>`;
    if (!document.querySelector(".wa-float"))
      document.body.insertAdjacentHTML(
        "beforeend",
        `<a class="wa-float" href="${supportLink("Bonjour Domi, j’ai une question.")}" target="_blank" rel="noopener" aria-label="Contacter le support sur WhatsApp">${icon("whatsapp")}<span>Support WhatsApp</span></a>`
      );
    const toggle = document.querySelector(".menu-toggle"),
      nav = document.querySelector(".main-nav");
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
