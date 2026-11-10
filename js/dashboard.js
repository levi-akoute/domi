document.addEventListener("DOMContentLoaded", async () => {
  const U = ImmoUtils,
    S = ImmoStorage,
    A = ImmoAuth,
    E = U.escapeHtml,
    user = await A.requireUser();
  if (!user) return;
  if (user.role === "admin") {
    location.href = "admin.html";
    return;
  }
  U.qs("#dashboard-welcome").textContent =
    `Bonjour ${user.prenom}, voici les performances de vos annonces.`;
  if (U.getParam("publie"))
    U.toast("Annonce envoyée : elle sera visible après validation par notre équipe.");
  const mod = (m) =>
    m === "approuvee"
      ? '<span class="status-badge static available">Publiée</span>'
      : m === "rejetee"
        ? '<span class="status-badge static unavailable">Refusée</span>'
        : '<span class="status-badge static pending">En validation</span>';
  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) U.toast(ok);
    } catch (e) {
      U.toast(e.message, "error");
    }
    render();
  };
  async function render() {
    let list = [];
    try {
      list = await S.getMesAnnonces(user.id);
    } catch (e) {
      U.qs("#owner-listings").innerHTML = `<div class="notice error">${E(e.message)}</div>`;
      return;
    }
    const sum = (k) => list.reduce((n, a) => n + (Number(a[k]) || 0), 0);
    U.qs("#dashboard-stats").innerHTML =
      `<div class="stat-card"><span>Annonces</span><strong>${list.length}</strong></div><div class="stat-card"><span>Vues cumulées</span><strong>${sum("vues")}</strong></div><div class="stat-card"><span>Clics WhatsApp</span><strong>${sum("clics_whatsapp")}</strong></div>`;
    const host = U.qs("#owner-listings");
    host.innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Bien</th><th>Loyer</th><th>État</th><th>Vues / clics</th><th>Actions</th></tr></thead><tbody>${list.map((a) => `<tr><td><strong>${E(a.titre)}</strong><small>${E(a.commune)} · ${E(a.quartier)}</small><small>Confirmée ${U.daysAgo(a.confirmee_le)}</small></td><td>${U.money(a.loyer)}</td><td>${mod(a.moderation)} <span class="status-badge static ${a.statut === "Disponible" ? "available" : "unavailable"}">${E(a.statut)}</span></td><td>${Number(a.vues) || 0} / ${Number(a.clics_whatsapp) || 0}</td><td><div class="table-actions"><button data-status="${a.id}" data-to="${a.statut === "Disponible" ? "Déjà loué" : "Disponible"}" class="mini-btn">${a.statut === "Disponible" ? "Marquer loué" : "Rendre disponible"}</button><button data-confirm="${a.id}" class="mini-btn">Confirmer à jour</button><a class="mini-btn" href="maison-detail.html?id=${a.id}">Voir</a><button data-edit="${a.id}" class="mini-btn">Modifier</button><button data-delete="${a.id}" class="mini-btn danger">Supprimer</button></div></td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty-state compact"><h3>Aucune annonce</h3><p>Publiez votre premier bien pour le retrouver ici.</p><a class="btn btn-primary" href="publier.html">Publier un bien</a></div>';
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
  // Vérification d'identité
  const vh = U.qs("#verification-area"),
    vm = U.qs("#verification-message");
  async function renderVerif() {
    if (user.verifie) {
      vh.innerHTML =
        '<div class="notice success">✓ Votre compte est vérifié : le badge « Propriétaire vérifié » apparaît sur vos annonces.</div>';
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
    vh.innerHTML = `${last && last.status === "rejetee" ? `<div class="notice error">Votre dernière demande a été refusée${last.reviewer_note ? " : " + E(last.reviewer_note) : "."} Vous pouvez en soumettre une nouvelle.</div>` : ""}<form id="verification-form" class="verify-form"><label>Document<select name="document"><option>Carte nationale d’identité (CNI)</option><option>Passeport</option><option>Titre de propriété / attestation</option></select></label><label>Photo ou scan (JPG, PNG, PDF — 5 Mo max)<input name="file" type="file" accept="image/*,application/pdf" required></label><label class="check"><input type="checkbox" required> J’accepte que ce document soit consulté uniquement par l’équipe Domi pour vérifier mon identité.</label><button class="btn btn-outline">Envoyer ma demande</button></form>`;
    U.qs("#verification-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = new FormData(e.target),
        btn = e.target.querySelector("button");
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
  // Mot de passe
  U.qs("#password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = new FormData(e.target).get("password");
    try {
      await A.changePassword(pw);
      e.target.reset();
      U.toast("Mot de passe modifié");
    } catch (err) {
      U.toast(err.message, "error");
    }
  });
});
