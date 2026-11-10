/* ═══════════════════════════════════════════════════════════════════
   admin.js : interface d'administration (admin.html)

   Organisation en onglets (menu latéral) :
     Vue d'ensemble · Annonces · Signalements · Vérifications · Avis · Utilisateurs
   L'onglet actif est gardé dans l'adresse (#annonces…) pour survivre au rechargement.

   SÉCURITÉ : cette page vérifie le rôle admin pour l'affichage, mais la vraie
   protection est dans la base (is_admin() dans les règles RLS) : un non-admin
   qui forcerait l'accès ne recevrait aucune donnée.
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("is-admin");
  const U = ImmoUtils;
  const S = ImmoStorage;
  const E = U.escapeHtml;
  const I = U.icon;
  const user = await ImmoAuth.requireAdmin();
  if (!user) return;

  const msg = U.qs("#admin-message");
  const date = (x) => new Date(x).toLocaleDateString("fr-FR");
  let data = { ads: [], users: [], reps: [], ver: [], revs: [] };

  /* ───────── Gabarits communs ───────── */
  const table = (head, rows, empty) =>
    rows.length
      ? `<div class="table-wrap"><table class="admin-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
      : `<div class="empty-state compact"><p>${empty}</p></div>`;
  // data-label : sur mobile, chaque cellule affiche le nom de sa colonne (tableau → cartes)
  const td = (label, html) => `<td data-label="${label}">${html}</td>`;
  const badge = (cls, txt) => `<span class="status-badge static ${cls}">${txt}</span>`;
  const MOD = {
    en_attente: ["pending", "À valider"],
    approuvee: ["available", "Publiée"],
    rejetee: ["unavailable", "Refusée"],
  };
  const REV = {
    en_attente: ["pending", "À valider"],
    approuve: ["available", "Publié"],
    rejete: ["unavailable", "Refusé"],
  };
  const REP = {
    ouvert: ["pending", "Ouvert"],
    en_cours: ["pending", "En cours"],
    traite: ["available", "Traité"],
    rejete: ["unavailable", "Rejeté"],
  };
  const VER = {
    en_attente: ["pending", "En attente"],
    approuvee: ["available", "Validée"],
    rejetee: ["unavailable", "Refusée"],
  };
  const st = (map, k) => badge(...(map[k] || ["", E(k)]));
  // Recherche simple : vrai si le texte de la ligne contient la saisie
  const match = (q, ...fields) =>
    !q || fields.join(" ").toLowerCase().includes(q.trim().toLowerCase());

  /* ───────── Onglets ───────── */
  const TABS = ["apercu", "annonces", "signalements", "verifications", "avis", "utilisateurs"];
  function showTab(name) {
    if (!TABS.includes(name)) name = "apercu";
    document.querySelectorAll(".admin-tab").forEach((p) => (p.hidden = p.id !== "tab-" + name));
    document.querySelectorAll("[data-tab-link]").forEach((a) => {
      const on = a.dataset.tabLink === name;
      a.classList.toggle("active", on);
      if (on) {
        a.setAttribute("aria-current", "page");
        // Mobile : fait défiler la barre d'onglets pour que l'onglet actif soit visible
        a.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));
  showTab(location.hash.slice(1));

  /* ───────── Chargement des données ───────── */
  async function load() {
    const res = await Promise.allSettled([
      S.adminAnnonces(),
      S.adminUsers(),
      S.adminReports(),
      S.getVerifications(),
      S.adminAvis(),
    ]);
    const val = (i) => (res[i].status === "fulfilled" ? res[i].value || [] : []);
    data = { ads: val(0), users: val(1), reps: val(2), ver: val(3), revs: val(4) };
    // Les avis (index 4) peuvent manquer si 05_avis.sql n'a pas été exécuté : pas une erreur
    const errs = [0, 1, 2, 3]
      .filter((i) => res[i].status === "rejected")
      .map((i) => res[i].reason.message);
    if (errs.length) U.showMessage(msg, errs.join(" · "), "error");
    else msg.classList.add("hidden");
    render();
  }

  // Exécute une action puis recharge tout
  const run = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) U.toast(okMsg);
    } catch (e) {
      U.showMessage(msg, e.message, "error");
    }
    load();
  };

  /* ───────── Affichage ───────── */
  function render() {
    const { ads, users, reps, ver, revs } = data;
    const todo = {
      annonces: ads.filter((a) => a.moderation === "en_attente").length,
      signalements: reps.filter((r) => r.status === "ouvert" || r.status === "en_cours").length,
      verifications: ver.filter((v) => v.status === "en_attente").length,
      avis: revs.filter((r) => r.status === "en_attente").length,
    };
    // Pastilles rouges dans le menu
    Object.entries(todo).forEach(([k, n]) => {
      const b = U.qs(`[data-count="${k}"]`);
      if (b) {
        b.textContent = n;
        b.hidden = !n;
      }
    });

    renderApercu(todo);
    renderAnnonces();
    renderSignalements();
    renderVerifications();
    renderAvis();
    renderUtilisateurs();
  }

  function renderApercu(todo) {
    const { ads, users } = data;
    const pub = ads.filter((a) => a.moderation === "approuvee");
    const vues = pub.reduce((n, a) => n + (Number(a.vues) || 0), 0);
    const clics = pub.reduce((n, a) => n + (Number(a.clics_whatsapp) || 0), 0);
    const semaine = Date.now() - 7 * 86400000;
    const nouveaux = users.filter((u) => new Date(u.created_at) > semaine).length;

    U.qs("#admin-stats").innerHTML = [
      ["Annonces en ligne", pub.length, "grid"],
      ["Utilisateurs", `${users.length}<small> (+${nouveaux} cette semaine)</small>`, "users"],
      ["Vues cumulées", vues, "eye"],
      ["Clics WhatsApp", clics, "whatsapp"],
    ]
      .map(
        ([l, v, ic]) =>
          `<div class="stat-card">${I(ic, "stat-ic")}<span>${l}</span><strong>${v}</strong></div>`
      )
      .join("");

    const items = [
      ["annonces", "annonce(s) à valider", "grid"],
      ["signalements", "signalement(s) ouvert(s)", "flag"],
      ["verifications", "demande(s) de vérification", "shield"],
      ["avis", "avis à relire", "star"],
    ];
    const total = Object.values(todo).reduce((a, b) => a + b, 0);
    U.qs("#admin-todo").innerHTML = total
      ? items
          .filter(([k]) => todo[k])
          .map(
            ([k, label, ic]) =>
              `<a class="todo-item" href="#${k}">${I(ic)}<strong>${todo[k]}</strong> ${label}<span>${I("arrow")}</span></a>`
          )
          .join("")
      : `<div class="notice success">${I("check")} Tout est à jour : rien à traiter pour le moment.</div>`;

    // Annonces les plus consultées
    const top = [...pub].sort((a, b) => (b.vues || 0) - (a.vues || 0)).slice(0, 5);
    U.qs("#admin-top").innerHTML = table(
      ["Annonce", "Vues", "Clics", "Contact"],
      top.map(
        (a) =>
          `<tr>${td("Annonce", `<a class="text-link" href="maison-detail.html?id=${E(a.id)}" target="_blank" rel="noopener">${E(a.titre)}</a><small>${E(a.commune)}</small>`)}${td("Vues", Number(a.vues) || 0)}${td("Clics", Number(a.clics_whatsapp) || 0)}${td("Contact", a.vues ? Math.round((a.clics_whatsapp / a.vues) * 100) + " %" : "–")}</tr>`
      ),
      "Pas encore d’annonce en ligne."
    );
  }

  function renderAnnonces() {
    const f = U.qs("#ads-filter").value;
    const q = U.qs("#ads-search").value;
    const list = data.ads.filter(
      (a) =>
        (f === "tous" || a.moderation === f) &&
        match(q, a.titre, a.commune, a.quartier, a.profiles?.nom, a.profiles?.prenom, a.telephone)
    );
    U.qs("#admin-ads").innerHTML = table(
      ["Annonce", "Annonceur", "Loyer", "État", "Actions"],
      list.map((a) => {
        const img = U.safeUrl(a.image) || "assets/img/placeholder.svg";
        const p = a.profiles;
        const owner = p
          ? `${E(p.prenom)} ${E(p.nom)}${p.verifie ? ` <span class="verified-inline">${I("shield")}</span>` : ""}`
          : "–";
        return `<tr>
          ${td("Annonce", `<div class="cell-media"><img src="${E(img)}" alt="" loading="lazy"><div><strong>${E(a.titre)}</strong><small>${E(a.commune)}${a.quartier ? " · " + E(a.quartier) : ""} · ${date(a.created_at)}</small></div></div>`)}
          ${td("Annonceur", `${owner}<small>${E(p?.telephone || a.telephone || "")}</small>`)}
          ${td("Loyer", U.money(a.loyer))}
          ${td("État", st(MOD, a.moderation))}
          ${td(
            "Actions",
            `<div class="table-actions">
              <a class="mini-btn" href="maison-detail.html?id=${E(a.id)}" target="_blank" rel="noopener">Voir</a>
              ${a.moderation !== "approuvee" ? `<button class="mini-btn ok" data-mod="${E(a.id)}" data-to="approuvee">Approuver</button>` : ""}
              ${a.moderation !== "rejetee" ? `<button class="mini-btn danger" data-mod="${E(a.id)}" data-to="rejetee">Refuser</button>` : ""}
              <button class="mini-btn danger ghost" data-del="${E(a.id)}" aria-label="Supprimer">${I("x")}</button>
            </div>`
          )}
        </tr>`;
      }),
      "Aucune annonce dans cette catégorie."
    );
  }

  function renderSignalements() {
    const q = U.qs("#reps-search").value;
    // Nombre de signalements ouverts par annonce (pour repérer les plus signalées)
    const parAnnonce = {};
    data.reps
      .filter((r) => r.status === "ouvert" || r.status === "en_cours")
      .forEach((r) => (parAnnonce[r.listing_id] = (parAnnonce[r.listing_id] || 0) + 1));
    const list = data.reps.filter((r) => match(q, r.reason, r.details, r.listings?.titre));
    U.qs("#admin-reports").innerHTML = table(
      ["Annonce", "Motif", "Date", "Statut", "Actions"],
      list.map((r) => {
        const open = r.status === "ouvert" || r.status === "en_cours";
        const n = parAnnonce[r.listing_id] || 0;
        return `<tr>
          ${td("Annonce", r.listings ? `<a class="text-link" href="maison-detail.html?id=${E(r.listings.id)}" target="_blank" rel="noopener">${E(r.listings.titre)}</a>${n > 1 ? `<small class="danger-text">${n} signalements ouverts</small>` : ""}` : "–")}
          ${td("Motif", `${E(r.reason)}<small>${E(r.details || "")}</small>`)}
          ${td("Date", date(r.created_at))}
          ${td("Statut", st(REP, r.status))}
          ${td(
            "Actions",
            open
              ? `<div class="table-actions">
                  <button class="mini-btn ok" data-rep="${E(r.id)}" data-to="traite">Traité</button>
                  <button class="mini-btn" data-rep="${E(r.id)}" data-to="rejete">Sans suite</button>
                  ${r.listings ? `<button class="mini-btn danger" data-mod="${E(r.listings.id)}" data-to="rejetee">Retirer l’annonce</button>` : ""}
                </div>`
              : "–"
          )}
        </tr>`;
      }),
      "Aucun signalement."
    );
  }

  function renderVerifications() {
    U.qs("#admin-verifications").innerHTML = table(
      ["Compte", "Document", "Date", "Statut", "Actions"],
      data.ver.map(
        (v) => `<tr>
          ${td("Compte", `${E(v.profiles ? `${v.profiles.prenom} ${v.profiles.nom}` : "–")}<small>${E(v.profiles?.telephone || "")}</small>`)}
          ${td("Document", E(v.document_type))}
          ${td("Date", date(v.created_at))}
          ${td("Statut", st(VER, v.status) + (v.reviewer_note ? `<small>${E(v.reviewer_note)}</small>` : ""))}
          ${td(
            "Actions",
            `<div class="table-actions">
              ${v.document_path ? `<button class="mini-btn" data-doc="${E(v.document_path)}">Voir le document</button>` : ""}
              ${v.status === "en_attente" ? `<button class="mini-btn ok" data-ver="${E(v.id)}" data-ok="1">Valider</button><button class="mini-btn danger" data-ver="${E(v.id)}" data-ok="0">Refuser</button>` : ""}
            </div>`
          )}
        </tr>`
      ),
      "Aucune demande."
    );
  }

  function renderAvis() {
    const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
    U.qs("#admin-reviews").innerHTML = table(
      ["Annonce", "Auteur", "Note", "Commentaire", "Statut", "Actions"],
      data.revs.map(
        (r) => `<tr>
          ${td("Annonce", r.listings ? `<a class="text-link" href="maison-detail.html?id=${E(r.listings.id)}" target="_blank" rel="noopener">${E(r.listings.titre)}</a>` : "–")}
          ${td("Auteur", `${E(r.author_name || "–")}<small>${date(r.created_at)}</small>`)}
          ${td("Note", `<span class="stars-txt">${stars(Number(r.rating) || 0)}</span>`)}
          ${td("Commentaire", E(r.comment || ""))}
          ${td("Statut", st(REV, r.status))}
          ${td(
            "Actions",
            `<div class="table-actions">
              ${r.status !== "approuve" ? `<button class="mini-btn ok" data-rv="${E(r.id)}" data-to="approuve">Publier</button>` : ""}
              ${r.status !== "rejete" ? `<button class="mini-btn danger" data-rv="${E(r.id)}" data-to="rejete">Refuser</button>` : ""}
              <button class="mini-btn danger ghost" data-rvdel="${E(r.id)}" aria-label="Supprimer">${I("x")}</button>
            </div>`
          )}
        </tr>`
      ),
      "Aucun avis pour le moment (ou la table n’existe pas encore : exécutez 05_avis.sql)."
    );
  }

  function renderUtilisateurs() {
    const q = U.qs("#users-search").value;
    const nbAnnonces = {};
    data.ads.forEach((a) => (nbAnnonces[a.owner_id] = (nbAnnonces[a.owner_id] || 0) + 1));
    const ROLES = { proprietaire: "Propriétaire", agent: "Agent", admin: "Admin" };
    const list = data.users.filter((u) => match(q, u.prenom, u.nom, u.telephone, u.commune));
    U.qs("#admin-users").innerHTML = table(
      ["Nom", "Téléphone", "Profil", "Annonces", "Vérifié", "Récupération", "Inscrit le"],
      list.map(
        (u) => `<tr>
          ${td("Nom", `<strong>${E(u.prenom)} ${E(u.nom)}</strong><small>${E(u.commune || "")}</small>`)}
          ${td("Téléphone", u.telephone ? `<a class="text-link" href="https://wa.me/225${E(u.telephone)}" target="_blank" rel="noopener">${E(u.telephone)}</a>` : "–")}
          ${td("Profil", E(ROLES[u.role] || u.role))}
          ${td("Annonces", nbAnnonces[u.id] || 0)}
          ${td("Vérifié", u.verifie ? badge("available", "Oui") : "–")}
          ${td("Récupération", u.email_recuperation ? `${I("mail")} Email` : '<small class="muted">Aucune</small>')}
          ${td("Inscrit le", date(u.created_at))}
        </tr>`
      ),
      "Aucun utilisateur."
    );
  }

  /* ───────── Actions (délégation : un seul écouteur pour tous les boutons) ───────── */
  U.qs("#admin-main").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.mod)
      run(
        () => S.updateAnnonce(d.mod, { moderation: d.to }),
        d.to === "approuvee" ? "Annonce publiée" : "Annonce refusée"
      );
    else if (d.del) {
      if (confirm("Supprimer définitivement cette annonce ?"))
        run(() => S.supprimerAnnonce(d.del), "Annonce supprimée");
    } else if (d.rep) run(() => S.updateReport(d.rep, d.to), "Signalement mis à jour");
    else if (d.rv) run(() => S.updateAvis(d.rv, d.to), "Avis mis à jour");
    else if (d.rvdel) {
      if (confirm("Supprimer cet avis ?")) run(() => S.supprimerAvis(d.rvdel), "Avis supprimé");
    } else if (d.ver) {
      const ok = d.ok === "1";
      const note = ok ? null : prompt("Motif du refus (visible par l’utilisateur) :");
      if (!ok && note === null) return; // « Annuler » dans la boîte de dialogue
      run(() => S.decideVerification(d.ver, ok, note), ok ? "Compte vérifié" : "Demande refusée");
    } else if (d.doc) {
      // Ouvre l'onglet tout de suite (sinon le navigateur bloque la fenêtre), puis y charge le lien
      const w = window.open("", "_blank");
      try {
        w.location = await S.lienDocument(d.doc);
      } catch (err) {
        w && w.close();
        U.showMessage(msg, err.message, "error");
      }
    }
  });

  // Filtres et recherches : réaffichage immédiat, sans recharger la base
  U.qs("#ads-filter").addEventListener("change", renderAnnonces);
  U.qs("#ads-search").addEventListener("input", renderAnnonces);
  U.qs("#reps-search").addEventListener("input", renderSignalements);
  U.qs("#users-search").addEventListener("input", renderUtilisateurs);
  U.qs("#admin-refresh").addEventListener("click", () => {
    load();
    U.toast("Données actualisées");
  });

  load();
});
