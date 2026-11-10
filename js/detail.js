/* ═══════════════════════════════════════════════════════════════════
   detail.js : fiche d'une annonce (maison-detail.html?id=...)

   Étapes :
     1. lire l'identifiant dans l'adresse et charger l'annonce
     2. compter une vue, préparer les liens WhatsApp / appel
     3. construire toute la fiche (photos, description, prix, contact)
     4. activer la galerie, le partage, le plein écran, le signalement
     5. afficher les avis et le formulaire pour en donner un
   ═══════════════════════════════════════════════════════════════════ */

// Tout le code s'exécute quand la page HTML est prête (DOMContentLoaded)
document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("is-detail"); // classe CSS propre à cette page (cache le bouton WhatsApp flottant)
  const U = window.ImmoUtils; // boîte à outils
  const S = window.ImmoStorage; // accès à la base
  const A = window.ImmoAuth; // comptes
  const E = U.escapeHtml; // protection du texte (sécurité)
  const I = U.icon; // icônes
  const main = U.qs("#detail-content"); // zone où la fiche est construite
  const FALLBACK = "assets/img/placeholder.svg"; // image de secours

  /* ───────── 1. Chargement de l'annonce ───────── */

  // Message affiché si l'annonce n'existe pas (ou n'est pas visible pour ce visiteur)
  const notFound =
    '<div class="empty-state"><h1>Annonce introuvable</h1><p>Cette annonce n’existe pas, n’est plus publiée ou a été supprimée.</p><a class="btn btn-primary" href="annonces.html">Retour aux annonces</a></div>';
  let a = null; // l'annonce
  try {
    a = await S.getAnnonce(U.getParam("id")); // ?id=… dans l'adresse
  } catch (e) {} // identifiant invalide ou réseau : a reste null
  if (!a) {
    main.innerHTML = notFound; // rien trouvé
    return; // on s'arrête là
  }

  const user = await A.currentUser(); // visiteur connecté ? (null sinon)
  const mine = user && user.id === a.owner_id; // est-ce SON annonce ?
  const pub = a.moderation === "approuvee"; // annonce publiée ?

  /* ───────── 2. Compteurs et contact ───────── */

  // Une vue comptée par annonce et par session de navigation (pas à chaque rechargement).
  // sessionStorage : mémoire effacée à la fermeture de l'onglet.
  if (pub && !sessionStorage.getItem("v_" + a.id)) {
    sessionStorage.setItem("v_" + a.id, "1"); // on note que la vue est comptée
    S.vue(a.id); // +1 vue dans la base
  }
  document.title = a.titre + " — Domi"; // titre de l'onglet

  // Photos : seules les adresses http(s) sont gardées (sécurité)
  const photos = (a.images && a.images.length ? a.images : [a.image]) // toutes les photos, sinon la principale
    .map(U.safeUrl) // vérifie chaque adresse
    .filter(Boolean); // retire les adresses refusées (chaînes vides)
  if (!photos.length) photos.push(FALLBACK); // aucune photo : image de secours

  // Numéro au format international pour WhatsApp (225 + 10 chiffres)
  const phone = String(a.telephone || "").replace(/\D/g, ""); // chiffres uniquement
  const full = phone.startsWith("225") ? phone : "225" + phone; // ajoute l'indicatif si besoin
  const dispo = a.statut === "Disponible" && pub; // on ne peut contacter que si dispo ET publiée
  // Lien WhatsApp avec un message pré-rempli (titre + lien de l'annonce)
  const wa = phone
    ? `https://wa.me/${full}?text=${encodeURIComponent("Bonjour, je vous contacte au sujet de votre annonce Domi : " + a.titre + "\n" + location.href)}`
    : "#";
  // Attributs du bouton : lien actif, ou désactivé (aria-disabled) si non disponible
  const waAttr =
    dispo && phone ? `href="${wa}" target="_blank" rel="noopener"` : `aria-disabled="true"`;
  const dis = dispo && phone ? "" : "disabled-link"; // classe CSS grisée
  const ch = U.chambresLabel(a.chambres); // « 2 chambres »
  const video = U.safeUrl(a.video); // lien vidéo vérifié (bloque javascript:)
  const ancienne = pub && U.daysSince(a.confirmee_le) >= U.JOURS_RAPPEL; // pas confirmée depuis 30 jours ?

  // Bandeau d'information : annonce non publiée, ou pas confirmée depuis longtemps
  const bandeau = !pub
    ? `<div class="notice info">${a.moderation === "rejetee" ? "Cette annonce a été refusée par la modération." : "Cette annonce est en attente de validation."} Elle n’est visible que par vous${user && user.role === "admin" ? " et les administrateurs" : ""}.</div>`
    : ancienne
      ? `<div class="notice info">L’annonceur n’a pas confirmé cette annonce depuis ${U.daysSince(a.confirmee_le)} jours : vérifiez auprès de lui que le logement est toujours disponible.</div>`
      : "";

  // Grille des caractéristiques : [titre, valeur] → petites cases
  const caracteristiques = [
    [I("bolt") + " Compteur CIE", E(a.cie || "Non renseigné")], // électricité
    [I("drop") + " Compteur SODECI", E(a.sodeci || "Non renseigné")], // eau
    ["Avance", `${Number(a.avance) || 0} mois`], // mois d'avance
    ["Caution", `${Number(a.caution) || 0} mois`], // mois de caution
    [I("bed") + " Chambres", Number(a.chambres) || "Pièce unique"], // chambres
    ["Étage", E(a.etage || "Non précisé")], // étage
  ]
    .map(([k, v]) => `<div><small>${k}</small><strong>${v}</strong></div>`) // une case par ligne
    .join("");

  // Somme à prévoir à l'entrée : (avance + caution) × loyer
  const entree = ((Number(a.avance) || 0) + (Number(a.caution) || 0)) * (Number(a.loyer) || 0);

  /* ───────── 3. Construction de la fiche ───────── */
  main.innerHTML = `
  <a class="back-link" href="annonces.html">${I("arrow", "flip")} Retour aux annonces</a>
  ${bandeau}
  <div class="detail-heading">
    <div>
      <div class="listing-location">${I("pin")} ${E(a.commune)}${a.quartier ? " · " + E(a.quartier) : ""}</div>
      <h1>${E(a.titre)}</h1>
      <p>${E(a.type)}${ch ? " · " + ch : ""} · Confirmée ${U.daysAgo(a.confirmee_le)}</p>
    </div>
    <div class="badge-stack">
      <span class="status-badge static ${a.statut === "Disponible" ? "available" : "unavailable"}">${E(a.statut)}</span>
      ${a.proprietaire_verifie ? `<span class="verified-badge static">${I("check")} Propriétaire vérifié</span>` : ""}
      ${pub ? U.favButton(a.id, "with-label") : ""}
    </div>
  </div>
  <div class="detail-layout">
    <div class="detail-main-column">
      <div class="detail-photo">
        <img id="gallery-main" src="${E(photos[0])}" alt="${E(a.titre)}" data-fallback="${FALLBACK}">
        ${photos.length > 1 ? `<span class="photo-count">${photos.length} photos</span>` : ""}
        ${video ? `<a class="video-overlay" href="${E(video)}" target="_blank" rel="noopener nofollow">${I("play")} Voir la visite vidéo</a>` : ""}
      </div>
      ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button type="button" class="thumb ${i ? "" : "active"}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${E(p)}" alt="" loading="lazy" data-fallback="${FALLBACK}"></button>`).join("")}</div>` : ""}
      <section class="detail-section"><h2>Description</h2><p>${E(a.description || "Aucune description fournie.").replace(/\n/g, "<br>")}</p></section>
      <section class="detail-section"><h2>Caractéristiques</h2><div class="feature-grid">${caracteristiques}</div></section>
      <section class="safety-note"><strong>${I("shield")} Conseils de sécurité</strong><ul><li>Visitez le logement avant de verser de l’argent.</li><li>Vérifiez l’identité de l’annonceur et que c’est bien lui qui détient le bien.</li><li>Demandez un reçu écrit pour tout paiement.</li><li>Ne transmettez jamais de code confidentiel ni de code Mobile Money.</li></ul></section>
      <section class="detail-section" id="reviews-section"></section>
    </div>
    <aside class="contact-card">
      <span class="eyebrow">Loyer mensuel</span>
      <div class="detail-price">${U.money(a.loyer)}<small>/ mois</small></div>
      <div class="contact-divider"></div>
      <div class="condition-row"><span>Avance</span><strong>${Number(a.avance) || 0} mois</strong></div>
      <div class="condition-row"><span>Caution</span><strong>${Number(a.caution) || 0} mois</strong></div>
      ${entree ? `<div class="condition-row total"><span>À prévoir à l’entrée</span><strong>${U.money(entree)}</strong></div>` : ""}
      <a class="btn btn-primary btn-block ${dis}" ${waAttr} id="whatsapp-contact">${I("whatsapp")} Contacter sur WhatsApp</a>
      <a class="btn btn-outline btn-block ${dis}" ${dispo && phone ? `href="tel:+${full}"` : `aria-disabled="true"`}>${I("phone")} Appeler l’annonceur</a>
      <button class="btn btn-outline btn-block" id="share-listing" type="button">${I("share")} Partager cette annonce</button>
      <p class="fine-print">Disponibilité, prix et conditions à confirmer directement avec l’annonceur.</p>
      <button class="report-link" id="report-listing" type="button">${I("flag")} Signaler cette annonce</button>
      <a class="support-link" href="${U.supportLink("Bonjour Domi, j’ai un doute sur cette annonce : " + a.titre + " (" + location.href + ")")}" target="_blank" rel="noopener">Un doute ? Écrire au support</a>
    </aside>
  </div>
  <div class="sticky-contact"><div><strong>${U.money(a.loyer)}</strong><small>/ mois</small></div><a class="btn btn-primary ${dis}" ${waAttr} id="whatsapp-sticky">${I("whatsapp")} WhatsApp</a></div>`;
  // (sticky-contact : barre fixée en bas de l'écran sur téléphone)

  /* ───────── 4. Interactions ───────── */

  // Miniatures : clic → la photo devient la photo principale
  main.querySelectorAll(".thumb").forEach((b) =>
    b.addEventListener("click", () => {
      U.qs("#gallery-main").src = photos[b.dataset.i]; // data-i = numéro de la photo
      main.querySelectorAll(".thumb").forEach((x) => x.classList.toggle("active", x === b)); // cadre orange
    })
  );

  // Clic sur un bouton WhatsApp → +1 clic dans la base (statistique du propriétaire)
  ["#whatsapp-contact", "#whatsapp-sticky"].forEach((s) =>
    U.qs(s)?.addEventListener("click", () => {
      if (dispo) S.clicWhatsapp(a.id);
    })
  );

  // Partager : menu de partage du téléphone, sinon copie du lien
  U.qs("#share-listing").addEventListener("click", async () => {
    const d = {
      title: a.titre,
      text: `${a.titre} — ${U.money(a.loyer)}/mois à ${a.commune}`,
      url: location.href,
    };
    try {
      if (navigator.share)
        await navigator.share(d); // téléphone : WhatsApp, SMS…
      else {
        await navigator.clipboard.writeText(location.href); // ordinateur : copie dans le presse-papiers
        U.toast("Lien copié");
      }
    } catch (e) {} // le visiteur a annulé : rien à faire
  });

  // Photo en grand (plein écran) : <dialog> = fenêtre native du navigateur
  let li = 0; // numéro de la photo affichée en grand
  const lb = document.createElement("dialog"); // crée la fenêtre
  lb.className = "lightbox";
  lb.innerHTML = `<button type="button" class="lb-close" aria-label="Fermer">×</button><button type="button" class="lb-nav lb-prev" aria-label="Photo précédente">${I("arrow", "flip")}</button><img alt="" data-fallback="${FALLBACK}"><button type="button" class="lb-nav lb-next" aria-label="Photo suivante">${I("arrow")}</button><div class="lb-count"></div>`;
  document.body.appendChild(lb); // ajoutée à la page (invisible tant qu'on ne l'ouvre pas)
  // Affiche la photo n°i (en boucle grâce au modulo %)
  const showPhoto = (i) => {
    li = (i + photos.length) % photos.length;
    const im = lb.querySelector("img");
    im.src = photos[li];
    im.alt = a.titre;
    lb.querySelector(".lb-count").textContent = `${li + 1} / ${photos.length}`; // « 2 / 6 »
  };
  if (photos.length < 2)
    // une seule photo : pas de flèches
    lb.querySelectorAll(".lb-nav").forEach((b) => {
      b.hidden = true;
    });
  // Clic sur la grande photo → ouverture en plein écran sur la photo active
  U.qs("#gallery-main").addEventListener("click", () => {
    showPhoto(Number(main.querySelector(".thumb.active")?.dataset.i || 0));
    lb.showModal();
  });
  lb.querySelector(".lb-close").onclick = () => lb.close(); // croix
  lb.querySelector(".lb-prev").onclick = () => showPhoto(li - 1); // précédente
  lb.querySelector(".lb-next").onclick = () => showPhoto(li + 1); // suivante
  lb.addEventListener("click", (e) => {
    if (e.target === lb) lb.close(); // clic sur le fond noir → fermeture
  });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") showPhoto(li - 1); // flèche gauche du clavier
    if (e.key === "ArrowRight") showPhoto(li + 1); // flèche droite du clavier
  });

  // Fenêtre « Signaler cette annonce »
  const dlg = document.createElement("dialog");
  dlg.className = "report-dialog";
  dlg.innerHTML = `<form><h3>Signaler cette annonce</h3><label>Motif<select name="reason"><option>Arnaque / demande d’argent suspecte</option><option>Faux prix</option><option>Déjà loué / indisponible</option><option>Photos qui ne correspondent pas</option><option>Autre</option></select></label><label>Détails (facultatif)<textarea name="details" rows="3" maxlength="1000"></textarea></label><div class="publish-actions"><button type="button" class="btn btn-outline" data-close>Annuler</button><button type="submit" class="btn btn-primary">Envoyer</button></div></form>`;
  document.body.appendChild(dlg);
  U.qs("#report-listing").addEventListener("click", () => dlg.showModal()); // ouvre la fenêtre
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close()); // « Annuler »
  // Envoi du signalement
  dlg.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault(); // pas de rechargement de page
    const d = new FormData(e.target); // lit les champs du formulaire
    try {
      await S.signaler({
        listing_id: a.id, // annonce signalée
        reporter_id: user ? user.id : null, // auteur (null = anonyme)
        reason: d.get("reason"), // motif choisi
        details: (d.get("details") || "").trim() || null, // détails éventuels
      });
      dlg.close();
      U.toast("Merci, votre signalement a été transmis à la modération.");
    } catch (err) {
      U.toast(err.message, "error"); // ex. « Vous avez déjà signalé cette annonce » (database/09)
    }
  });

  /* ───────── 5. Avis et notes ───────── */
  const rs = U.qs("#reviews-section"); // zone des avis
  const fmt = (n) => String(n).replace(".", ","); // 4.5 → « 4,5 »
  // Dessin d'une étoile (pour le formulaire de note)
  const SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>';
  // 5 étoiles dont n « allumées » (classe on)
  const stars = (n) =>
    Array.from(
      { length: 5 },
      (_, k) =>
        `<svg class="star ${k < Math.round(n) ? "on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>`
    ).join("");

  // Affiche le résumé, la liste des avis et le formulaire adapté au visiteur
  async function renderReviews() {
    if (!rs) return;
    let list; // avis publiés
    try {
      list = await S.getAvis(a.id);
    } catch (e) {
      rs.remove(); // table des avis absente (05_avis.sql non exécuté) : on retire la section
      return;
    }
    // Avis déjà donné par ce visiteur (sauf si c'est son annonce)
    const mineR = user && !mine ? await S.monAvis(a.id, user.id).catch(() => null) : null;
    const nb = Number(a.nb_avis) || list.length; // nombre d'avis
    const note = Number(a.note_moyenne) || 0; // note moyenne
    let form = ""; // ce qui s'affiche sous les avis
    if (pub && !mine) {
      if (!user)
        // visiteur non connecté : invitation à se connecter
        form =
          '<p class="muted">Pour donner votre avis, <a class="text-link" href="connexion.html">connectez-vous</a>.</p>';
      else if (mineR)
        // avis déjà donné : on indique son état
        form = `<div class="notice info">Votre avis ${mineR.status === "en_attente" ? "est en attente de validation par notre équipe." : mineR.status === "rejete" ? "n’a pas été retenu." : "est publié. Merci !"}</div>`;
      // sinon : formulaire de note (étoiles de 5 à 1, affichées de droite à gauche par le CSS)
      else
        form = `<form id="review-form" class="stack review-form"><h3>Donner mon avis</h3><div class="rate-input" role="radiogroup" aria-label="Votre note sur 5">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="r${n}" value="${n}" required><label for="r${n}" title="${n} sur 5">${SVG}</label>`).join("")}</div><label>Votre commentaire (facultatif)<textarea name="comment" maxlength="800" rows="3" placeholder="Comment s’est passée votre expérience avec ce logement ou cet annonceur ?"></textarea></label><label class="check"><input type="checkbox" required> Je confirme avoir visité ou loué ce bien. Mon avis sera relu avant publication.</label><button class="btn btn-primary" type="submit">Envoyer mon avis</button></form>`;
    }
    // Résumé (note moyenne), note de l'annonceur, liste des avis, formulaire
    rs.innerHTML = `<h2>Avis</h2><div class="rating-summary">${nb ? `<div class="big">${fmt(note)}</div><div>${stars(note)}<small>${nb} avis sur cette annonce</small></div>` : '<p class="muted m-0">Soyez le premier à donner votre avis.</p>'}${Number(a.proprio_nb_avis) > 0 ? `<div class="owner-rating"><small>Note de l’annonceur</small><strong>${fmt(Number(a.proprio_note))} / 5</strong><small>${Number(a.proprio_nb_avis)} avis au total</small></div>` : ""}</div>${list.map((r) => `<article class="review"><header><strong>${E(r.author_name || "Utilisateur")}</strong><span>${stars(r.rating)}</span><small>${new Date(r.created_at).toLocaleDateString("fr-FR")}</small></header>${r.comment ? `<p>${E(r.comment)}</p>` : ""}</article>`).join("")}${form}`;
    // Envoi d'un avis
    U.qs("#review-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const b = e.target.querySelector("button[type=submit]");
      b.disabled = true; // évite le double envoi
      try {
        await S.ajouterAvis({
          listing_id: a.id,
          author_id: user.id,
          rating: Number(f.get("rating")), // note de 1 à 5
          comment: (f.get("comment") || "").trim() || null,
        });
        U.toast("Merci ! Votre avis sera publié après relecture.");
        renderReviews(); // réaffiche (« votre avis est en attente »)
      } catch (err) {
        U.toast(
          /duplicate|unique/i.test(err.message) // un seul avis par personne et par annonce
            ? "Vous avez déjà donné votre avis sur cette annonce."
            : err.message,
          "error"
        );
        b.disabled = false;
      }
    });
  }
  renderReviews(); // premier affichage des avis
});
