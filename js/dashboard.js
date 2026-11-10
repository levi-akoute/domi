/* ═══════════════════════════════════════════════════════════════════
   dashboard.js : espace annonceur (dashboard-proprietaire.html)

   - statistiques globales et par annonce (vues, clics WhatsApp, taux de contact)
   - gestion des annonces (loué/disponible, confirmer, modifier, supprimer)
   - rappels de fraîcheur : une annonce non confirmée depuis longtemps est masquée
   - badge « Propriétaire vérifié » (envoi d'une pièce d'identité)
   - sécurité du compte : email de récupération et mot de passe
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("is-dashboard");
  const U = ImmoUtils;
  const S = ImmoStorage;
  const A = ImmoAuth;
  const E = U.escapeHtml;
  const I = U.icon;

  const user = await A.requireUser(); // redirige vers connexion.html si non connecté
  if (!user) return;
  if (user.role === "admin") {
    location.href = "admin.html";
    return;
  }

  U.qs("#dashboard-welcome").textContent =
    `Bonjour ${user.prenom}, voici les performances de vos annonces.`;

  // Message après publication : immédiat pour un compte vérifié (modération mixte, database/08)
  if (U.getParam("publie"))
    U.toast(
      user.verifie
        ? "Annonce publiée : elle est déjà visible par les visiteurs."
        : "Annonce envoyée : elle sera visible après validation par notre équipe."
    );

  /* ───────── Petits gabarits ───────── */
  const badgeModeration = (m) =>
    m === "approuvee"
      ? '<span class="status-badge static available">Publiée</span>'
      : m === "rejetee"
        ? '<span class="status-badge static unavailable">Refusée</span>'
        : '<span class="status-badge static pending">En validation</span>';
  const taux = (clics, vues) => (vues ? Math.round((clics / vues) * 100) + " %" : "–");

  // Fraîcheur : rappel à 30 jours, masquée du public à 45 jours (réglages dans utils.js)
  function fraicheur(a) {
    const j = U.daysSince(a.confirmee_le);
    if (a.moderation !== "approuvee" || a.statut !== "Disponible") return "";
    if (j >= U.JOURS_MASQUAGE)
      return `<div class="notice error compact">Masquée du public : non confirmée depuis ${j} jours. Cliquez sur « Confirmer à jour » pour la republier.</div>`;
    if (j >= U.JOURS_RAPPEL)
      return `<div class="notice info compact">Confirmez que ce logement est toujours disponible : sans confirmation, l’annonce sera masquée dans ${U.JOURS_MASQUAGE - j} jour(s).</div>`;
    return "";
  }

  // Exécute une action, affiche un message, puis rafraîchit la liste
  const act = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) U.toast(okMsg);
    } catch (e) {
      U.toast(e.message, "error");
    }
    render();
  };

  /* ───────── Mes annonces ───────── */
  async function render() {
    const host = U.qs("#owner-listings");
    let list = [];
    try {
      list = await S.getMesAnnonces(user.id);
    } catch (e) {
      host.innerHTML = `<div class="notice error">${E(e.message)}</div>`;
      return;
    }

    const sum = (k) => list.reduce((n, a) => n + (Number(a[k]) || 0), 0);
    const vues = sum("vues");
    const clics = sum("clics_whatsapp");
    const publiees = list.filter((a) => a.moderation === "approuvee").length;
    U.qs("#dashboard-stats").innerHTML = [
      ["Annonces publiées", `${publiees}<small> / ${list.length}</small>`, "grid"],
      ["Vues cumulées", vues, "eye"],
      ["Clics WhatsApp", clics, "whatsapp"],
      ["Taux de contact", taux(clics, vues), "chart"],
    ]
      .map(
        ([label, val, ic]) =>
          `<div class="stat-card">${I(ic, "stat-ic")}<span>${label}</span><strong>${val}</strong></div>`
      )
      .join("");

    if (!list.length) {
      host.innerHTML = `<div class="empty-state compact"><h3>Aucune annonce</h3><p>Publiez votre premier bien pour le retrouver ici.</p><a class="btn btn-primary" href="publier.html">Publier un bien</a></div>`;
      return;
    }

    host.innerHTML = `<div class="owner-list">${list
      .map((a) => {
        const dispo = a.statut === "Disponible";
        const img = U.safeUrl(a.image) || "assets/img/placeholder.svg";
        const v = Number(a.vues) || 0;
        const c = Number(a.clics_whatsapp) || 0;
        return `
        <article class="owner-item">
          <a class="owner-thumb" href="maison-detail.html?id=${E(a.id)}"><img src="${E(img)}" alt="" loading="lazy"></a>
          <div class="owner-info">
            <div class="owner-badges">${badgeModeration(a.moderation)} <span class="status-badge static ${dispo ? "available" : "unavailable"}">${E(a.statut)}</span></div>
            <h3><a href="maison-detail.html?id=${E(a.id)}">${E(a.titre)}</a></h3>
            <small>${E(a.commune)}${a.quartier ? " · " + E(a.quartier) : ""} · ${U.money(a.loyer)} / mois</small>
            <small>${I("clock")} Confirmée ${U.daysAgo(a.confirmee_le)}</small>
            ${fraicheur(a)}
          </div>
          <dl class="owner-stats">
            <div><dt>Vues</dt><dd>${v}</dd></div>
            <div><dt>Clics</dt><dd>${c}</dd></div>
            <div><dt>Contact</dt><dd>${taux(c, v)}</dd></div>
          </dl>
          <div class="table-actions">
            <button data-confirm="${E(a.id)}" class="mini-btn">Confirmer à jour</button>
            <button data-status="${E(a.id)}" data-to="${dispo ? "Déjà loué" : "Disponible"}" class="mini-btn">${dispo ? "Marquer loué" : "Rendre disponible"}</button>
            <button data-edit="${E(a.id)}" class="mini-btn">Modifier</button>
            <button data-delete="${E(a.id)}" class="mini-btn danger">Supprimer</button>
          </div>
        </article>`;
      })
      .join("")}</div>`;

    host
      .querySelectorAll("[data-status]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            act(
              () => S.updateAnnonce(b.dataset.status, { statut: b.dataset.to }),
              "Statut mis à jour"
            ))
      );
    host
      .querySelectorAll("[data-confirm]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            act(
              () => S.updateAnnonce(b.dataset.confirm, { confirmee_le: new Date().toISOString() }),
              "Annonce confirmée à jour"
            ))
      );
    host
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => (location.href = "publier.html?edit=" + b.dataset.edit)));
    host.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Supprimer définitivement cette annonce ?"))
            act(() => S.supprimerAnnonce(b.dataset.delete), "Annonce supprimée");
        })
    );
  }
  render();

  /* ───────── Badge « Propriétaire vérifié » ───────── */
  const vh = U.qs("#verification-area");
  const vm = U.qs("#verification-message");
  async function renderVerif() {
    if (user.verifie) {
      vh.innerHTML = `<div class="notice success">${I("check")} Votre compte est vérifié : le badge « Propriétaire vérifié » apparaît sur vos annonces, et vos nouvelles annonces sont publiées immédiatement.</div>`;
      return;
    }
    let last = null;
    try {
      last = (await S.maVerification(user.id))[0];
    } catch (e) {}
    if (last && last.status === "en_attente") {
      vh.innerHTML =
        '<div class="notice info">Votre demande est en cours d’examen par notre équipe.</div>';
      return;
    }
    const refus =
      last && last.status === "rejetee"
        ? `<div class="notice error">Votre dernière demande a été refusée${last.reviewer_note ? " : " + E(last.reviewer_note) : "."} Vous pouvez en soumettre une nouvelle.</div>`
        : "";
    vh.innerHTML = `${refus}
      <form id="verification-form" class="verify-form">
        <label>Document<select name="document"><option>Carte nationale d’identité (CNI)</option><option>Passeport</option><option>Titre de propriété / attestation</option></select></label>
        <label>Photo ou scan (JPG, PNG, PDF, 5 Mo max)<input name="file" type="file" accept="image/*,application/pdf" required></label>
        <label class="check"><input type="checkbox" required> J’accepte que ce document soit consulté uniquement par l’équipe Domi pour vérifier mon identité.</label>
        <button class="btn btn-outline">Envoyer ma demande</button>
      </form>`;
    U.qs("#verification-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = new FormData(e.target);
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      try {
        await S.soumettreVerification(d.get("file"), d.get("document"), user.id);
        U.toast("Demande envoyée");
        renderVerif();
      } catch (err) {
        U.showMessage(vm, err.message, "error");
        btn.disabled = false;
      }
    });
  }
  renderVerif();

  /* ───────── Email de récupération ─────────
     La colonne n'existe qu'après database/07 : si elle est absente, on masque le bloc. */
  const emailForm = U.qs("#email-form");
  if (!("email_recuperation" in user)) {
    U.qs("#email-block")?.remove();
  } else {
    emailForm.elements.email.value = user.email_recuperation || "";
    if (!user.email_recuperation) U.qs("#email-warning").classList.remove("hidden");
    emailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailForm.elements.email.value.trim().toLowerCase() || null;
      try {
        await S.updateMonProfil(user.id, { email_recuperation: email });
        user.email_recuperation = email;
        U.qs("#email-warning").classList.toggle("hidden", !!email);
        U.toast(email ? "Email de récupération enregistré" : "Email de récupération retiré");
      } catch (err) {
        U.toast(
          /check|format/i.test(err.message) ? "Adresse email invalide." : err.message,
          "error"
        );
      }
    });
  }

  /* ───────── Mot de passe ───────── */
  U.qs("#password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = new FormData(e.target).get("password");
    if (pw.length < 8) {
      U.toast("8 caractères minimum.", "error");
      return;
    }
    try {
      await A.changePassword(pw);
      e.target.reset();
      U.toast("Mot de passe modifié");
    } catch (err) {
      U.toast(err.message, "error");
    }
  });
});
