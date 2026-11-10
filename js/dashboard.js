/* ═══════════════════════════════════════════════════════════════════
   dashboard.js : espace annonceur (dashboard-proprietaire.html)

   - statistiques globales et par annonce (vues, clics WhatsApp, taux de contact)
   - gestion des annonces (loué/disponible, confirmer, modifier, supprimer)
   - rappels de fraîcheur : une annonce non confirmée depuis longtemps est masquée
   - badge « Propriétaire vérifié » (envoi d'une pièce d'identité)
   - sécurité du compte : email de récupération et mot de passe
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("is-dashboard"); // classe CSS propre à cette page
  const U = ImmoUtils; // boîte à outils
  const S = ImmoStorage; // accès à la base
  const A = ImmoAuth; // comptes
  const E = U.escapeHtml; // protection du texte
  const I = U.icon; // icônes

  const user = await A.requireUser(); // redirige vers connexion.html si non connecté
  if (!user) return;
  if (user.role === "admin") {
    location.href = "admin.html"; // l'admin a sa propre page
    return;
  }

  // Message d'accueil (textContent : le prénom ne peut pas injecter de code)
  U.qs("#dashboard-welcome").textContent =
    `Bonjour ${user.prenom}, voici les performances de vos annonces.`;

  // Message après publication (?publie=1) : immédiat pour un compte vérifié (database/08)
  if (U.getParam("publie"))
    U.toast(
      user.verifie
        ? "Annonce publiée : elle est déjà visible par les visiteurs."
        : "Annonce envoyée : elle sera visible après validation par notre équipe."
    );

  /* ───────── Petits gabarits ───────── */

  // Pastille d'état de modération
  const badgeModeration = (m) =>
    m === "approuvee"
      ? '<span class="status-badge static available">Publiée</span>' // vert
      : m === "rejetee"
        ? '<span class="status-badge static unavailable">Refusée</span>' // rouge
        : '<span class="status-badge static pending">En validation</span>'; // orange
  // Taux de contact = clics WhatsApp ÷ vues, en pourcentage (« – » s'il n'y a aucune vue)
  const taux = (clics, vues) => (vues ? Math.round((clics / vues) * 100) + " %" : "–");

  // Fraîcheur : rappel à 30 jours, masquée du public à 45 jours (réglages dans utils.js)
  function fraicheur(a) {
    const j = U.daysSince(a.confirmee_le); // jours depuis la dernière confirmation
    if (a.moderation !== "approuvee" || a.statut !== "Disponible") return ""; // seulement les annonces en ligne
    if (j >= U.JOURS_MASQUAGE)
      return `<div class="notice error compact">Masquée du public : non confirmée depuis ${j} jours. Cliquez sur « Confirmer à jour » pour la republier.</div>`;
    if (j >= U.JOURS_RAPPEL)
      return `<div class="notice info compact">Confirmez que ce logement est toujours disponible : sans confirmation, l’annonce sera masquée dans ${U.JOURS_MASQUAGE - j} jour(s).</div>`;
    return ""; // annonce fraîche : rien à signaler
  }

  // Exécute une action, affiche un message, puis rafraîchit la liste
  const act = async (fn, okMsg) => {
    try {
      await fn(); // l'action (modifier, supprimer…)
      if (okMsg) U.toast(okMsg); // confirmation
    } catch (e) {
      U.toast(e.message, "error"); // erreur
    }
    render(); // réaffiche les annonces à jour
  };

  /* ───────── Mes annonces ───────── */
  async function render() {
    const host = U.qs("#owner-listings"); // zone de la liste
    let list = []; // annonces du propriétaire
    try {
      list = await S.getMesAnnonces(user.id);
    } catch (e) {
      host.innerHTML = `<div class="notice error">${E(e.message)}</div>`;
      return;
    }

    // Statistiques globales
    const sum = (k) => list.reduce((n, a) => n + (Number(a[k]) || 0), 0); // total d'une colonne
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
        // une carte par statistique : [titre, valeur, icône]
        ([label, val, ic]) =>
          `<div class="stat-card">${I(ic, "stat-ic")}<span>${label}</span><strong>${val}</strong></div>`
      )
      .join("");

    if (!list.length) {
      // aucune annonce : invitation à publier
      host.innerHTML = `<div class="empty-state compact"><h3>Aucune annonce</h3><p>Publiez votre premier bien pour le retrouver ici.</p><a class="btn btn-primary" href="publier.html">Publier un bien</a></div>`;
      return;
    }

    // Une carte par annonce : miniature, infos, statistiques, actions
    host.innerHTML = `<div class="owner-list">${list
      .map((a) => {
        const dispo = a.statut === "Disponible";
        const img = U.safeUrl(a.image) || "assets/img/placeholder.svg"; // photo vérifiée
        const v = Number(a.vues) || 0;
        const c = Number(a.clics_whatsapp) || 0;
        // data-* : on range l'identifiant dans le bouton pour savoir sur quelle annonce agir
        return `
        <article class="owner-item">
          <a class="owner-thumb" href="maison-detail.html?id=${E(a.id)}"><img src="${E(img)}" alt="" loading="lazy" data-fallback="assets/img/placeholder.svg"></a>
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

    // Bouton « Marquer loué » / « Rendre disponible »
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
    // Bouton « Confirmer à jour » : la date de confirmation devient « maintenant »
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
    // Bouton « Modifier » : ouvre le formulaire en mode modification
    host
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => (location.href = "publier.html?edit=" + b.dataset.edit)));
    // Bouton « Supprimer » : demande confirmation avant
    host.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Supprimer définitivement cette annonce ?"))
            act(() => S.supprimerAnnonce(b.dataset.delete), "Annonce supprimée");
        })
    );
  }
  render(); // premier affichage

  /* ───────── Badge « Propriétaire vérifié » ───────── */
  const vh = U.qs("#verification-area"); // zone du badge
  const vm = U.qs("#verification-message"); // zone des messages
  async function renderVerif() {
    if (user.verifie) {
      // déjà vérifié
      vh.innerHTML = `<div class="notice success">${I("check")} Votre compte est vérifié : le badge « Propriétaire vérifié » apparaît sur vos annonces, et vos nouvelles annonces sont publiées immédiatement.</div>`;
      return;
    }
    let last = null; // dernière demande
    try {
      last = (await S.maVerification(user.id))[0];
    } catch (e) {}
    if (last && last.status === "en_attente") {
      // demande en cours
      vh.innerHTML =
        '<div class="notice info">Votre demande est en cours d’examen par notre équipe.</div>';
      return;
    }
    // Dernière demande refusée : on affiche le motif (échappé : écrit par l'admin)
    const refus =
      last && last.status === "rejetee"
        ? `<div class="notice error">Votre dernière demande a été refusée${last.reviewer_note ? " : " + E(last.reviewer_note) : "."} Vous pouvez en soumettre une nouvelle.</div>`
        : "";
    // Formulaire d'envoi d'une pièce d'identité
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
      btn.disabled = true; // évite le double envoi
      try {
        await S.soumettreVerification(d.get("file"), d.get("document"), user.id);
        U.toast("Demande envoyée");
        renderVerif(); // affiche « en cours d'examen »
      } catch (err) {
        U.showMessage(vm, err.message, "error");
        btn.disabled = false;
      }
    });
  }
  renderVerif();

  /* ───────── Email de récupération ─────────
     La colonne n'existe qu'après database/07 : si elle est absente, on retire le bloc. */
  const emailForm = U.qs("#email-form");
  if (!("email_recuperation" in user)) {
    U.qs("#email-block")?.remove(); // base pas encore à jour
  } else {
    emailForm.elements.email.value = user.email_recuperation || ""; // email actuel
    if (!user.email_recuperation) U.qs("#email-warning").classList.remove("hidden"); // alerte si absent
    emailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailForm.elements.email.value.trim().toLowerCase() || null; // vide → null (retrait)
      try {
        await S.updateMonProfil(user.id, { email_recuperation: email });
        user.email_recuperation = email; // mémorise la nouvelle valeur
        U.qs("#email-warning").classList.toggle("hidden", !!email);
        U.toast(email ? "Email de récupération enregistré" : "Email de récupération retiré");
      } catch (err) {
        U.toast(
          /check|format/i.test(err.message) ? "Adresse email invalide." : err.message, // refus de la base
          "error"
        );
      }
    });
  }

  /* ───────── Mot de passe ───────── */
  U.qs("#password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = new FormData(e.target).get("password"); // nouveau mot de passe
    if (pw.length < 8) {
      U.toast("8 caractères minimum.", "error");
      return;
    }
    try {
      await A.changePassword(pw);
      e.target.reset(); // vide le champ
      U.toast("Mot de passe modifié");
    } catch (err) {
      U.toast(err.message, "error");
    }
  });
});
