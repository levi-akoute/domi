/* ═══════════════════════════════════════════════════════════════════
   detail.js : fiche d'une annonce (maison-detail.html?id=...)

   Étapes :
     1. lire l'identifiant dans l'adresse et charger l'annonce
     2. compter une vue, préparer les liens WhatsApp / appel
     3. construire toute la fiche (photos, description, prix, contact)
     4. activer la galerie, le contact, la demande de visite, la carte, l'itinéraire,
        le partage, le plein écran, le signalement
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
  // Est-ce SON annonce ? La lecture publique donne est_a_moi (l'identifiant du propriétaire
  // reste caché depuis la v7.3) ; la lecture complète (propriétaire, admin) donne owner_id.
  const mine = !!user && (a.est_a_moi === true || user.id === a.owner_id);
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

  /* Contact. v7.3 : le numéro de l'annonceur n'est PLUS envoyé avec l'annonce (sinon
     n'importe qui le verrait avec F12, sans même cliquer). Les boutons de contact le
     demandent à la base au premier clic (voir « Contact » dans la partie 4). */
  const dispo = a.statut === "Disponible" && pub; // on ne peut contacter que si dispo ET publiée
  // Attributs d'un bouton de contact : actif (data-contact = "wa" ou "tel"), ou désactivé
  const contactAttr = (type) =>
    dispo ? `href="#" data-contact="${type}"` : `aria-disabled="true"`;
  const dis = dispo ? "" : "disabled-link"; // classe CSS grisée
  // Adresse propre de la fiche (sans autre paramètre) : pour le partage et les messages WhatsApp
  const lienFiche = `${location.origin}${location.pathname}?id=${encodeURIComponent(a.id)}`;
  const ch = U.chambresLabel(a.chambres); // « 2 chambres »
  // Vidéo (v8.3) : seulement une vidéo rangée sur Domi (les anciens liens externes sont ignorés)
  const video = /\/storage\/v1\/object\/public\/videos\//.test(a.video || "")
    ? U.safeUrl(a.video)
    : "";
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

  // Partage (v8.1) : WhatsApp, Facebook et copie du lien. Seulement pour une annonce publiée :
  // une annonce en attente n'est visible que par son auteur, la partager ne servirait à rien.
  // encodeURIComponent protège le texte dans l'adresse (le titre vient de l'annonceur).
  const texteFiche = `${a.titre} · ${U.money(a.loyer)} / mois à ${a.commune}`;
  const partage = `
      <div class="share-block">
        <span class="share-title">Partager cette annonce</span>
        <div class="share-row">
          <a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(texteFiche + "\n" + lienFiche)}" target="_blank" rel="noopener">${I("whatsapp")} WhatsApp</a>
          <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(lienFiche)}" target="_blank" rel="noopener">${I("facebook")} Facebook</a>
          <button class="share-btn" id="share-copy" type="button">${I("link")} Copier le lien</button>
        </div>
      </div>`;

  // Emplacement (v8.2) : les visiteurs reçoivent une zone arrondie (zone_lat, zone_lng), jamais le
  // point exact. Sur l'aperçu de sa propre annonce non publiée, l'annonceur voit son point.
  const zoneLat = a.zone_lat ?? a.latitude;
  const zoneLng = a.zone_lng ?? a.longitude;
  const aUneZone = Number.isFinite(zoneLat) && Number.isFinite(zoneLng);
  const itinerairePossible = dispo && a.itineraire_possible === true;
  const emplacement = aUneZone
    ? `
      <section class="detail-section" id="section-carte">
        <h2>Emplacement</h2>
        <p class="muted m-0">Zone approximative : le logement se trouve dans ce cercle d’environ 300 m, à ${E(a.commune)}${a.quartier ? " (" + E(a.quartier) + ")" : ""}.</p>
        <button type="button" class="btn btn-outline carte-ouvrir" id="voir-carte">${I("pin")} Voir la zone sur la carte</button>
        <div class="carte" id="carte" hidden></div>
        ${
          itinerairePossible
            ? `<button type="button" class="btn btn-primary carte-ouvrir" id="itineraire">${I("arrow")} Itinéraire vers le logement</button><small class="field-hint">Ouvre Google Maps avec le trajet jusqu’à l’adresse exacte.</small>`
            : `<small class="field-hint">L’annonceur donne l’adresse exacte par WhatsApp ou par téléphone.</small>`
        }
      </section>`
    : "";

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
        ${video ? `<video id="gallery-video" controls playsinline preload="none" poster="${E(U.miniature(photos[0]))}" src="${E(video)}" hidden></video><button type="button" class="video-overlay" id="voir-video">${I("play")} Voir la vidéo de la maison</button>` : ""}
      </div>
      ${photos.length > 1 || video ? `<div class="thumbs">${video ? `<button type="button" class="thumb thumb-video" data-video aria-label="Vidéo de la maison"><img src="${E(U.miniature(photos[0]))}" data-full="${E(photos[0])}" alt="" loading="lazy" data-fallback="${FALLBACK}">${I("play")}</button>` : ""}${photos.map((p, i) => `<button type="button" class="thumb ${i ? "" : "active"}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${E(U.miniature(p))}" data-full="${E(p)}" alt="" loading="lazy" data-fallback="${FALLBACK}"></button>`).join("")}</div>` : ""}
      <section class="detail-section"><h2>Description</h2><p>${E(a.description || "Aucune description fournie.").replace(/\n/g, "<br>")}</p></section>
      <section class="detail-section"><h2>Caractéristiques</h2><div class="feature-grid">${caracteristiques}</div></section>
      ${emplacement}
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
      <a class="btn btn-primary btn-block ${dis}" ${contactAttr("wa")} id="whatsapp-contact">${I("whatsapp")} Contacter sur WhatsApp</a>
      <a class="btn btn-outline btn-block ${dis}" ${contactAttr("tel")} id="appel-contact">${I("phone")} Appeler l’annonceur</a>
      <button class="btn btn-outline btn-block" id="visit-listing" type="button" ${dispo ? "" : "disabled"}>${I("calendar")} Planifier une visite</button>
      ${pub ? partage : ""}
      <p class="fine-print">Disponibilité, prix et conditions à confirmer directement avec l’annonceur.</p>
      <button class="report-link" id="report-listing" type="button">${I("flag")} Signaler cette annonce</button>
      <a class="support-link" href="${U.supportLink("Bonjour Domi, j’ai un doute sur cette annonce : " + a.titre + " (" + location.href + ")")}" target="_blank" rel="noopener">Un doute ? Écrire au support</a>
    </aside>
  </div>
  <div class="sticky-contact"><div><strong>${U.money(a.loyer)}</strong><small>/ mois</small></div><div class="sticky-actions"><button class="btn btn-outline sticky-visit" type="button" id="visit-sticky" aria-label="Planifier une visite" ${dispo ? "" : "disabled"}>${I("calendar")}</button><a class="btn btn-primary ${dis}" ${contactAttr("wa")} id="whatsapp-sticky">${I("whatsapp")} WhatsApp</a></div></div>`;
  // (sticky-contact : barre fixée en bas de l'écran sur téléphone, avec le calendrier « visite »)

  /* ───────── 4. Interactions ───────── */

  // Vidéo de la maison (v8.3) : jouée dans la fiche, seulement après un appui. preload="none" :
  // rien ne se télécharge avant, le forfait du visiteur est préservé.
  const laVideo = U.qs("#gallery-video");
  const boutonVideo = U.qs("#voir-video");
  const choisirVignette = (b) =>
    main.querySelectorAll(".thumb").forEach((x) => x.classList.toggle("active", x === b)); // cadre orange
  const montrerVideo = () => {
    U.qs("#gallery-main").hidden = true;
    boutonVideo.hidden = true;
    laVideo.hidden = false;
    choisirVignette(U.qs(".thumb-video"));
    laVideo.play().catch(() => {}); // lecture refusée : les boutons de la vidéo restent disponibles
  };
  boutonVideo?.addEventListener("click", montrerVideo);

  // Miniatures : clic → la photo devient la photo principale (et la vidéo s'arrête) ;
  // la première vignette montre la vidéo
  main.querySelectorAll(".thumb").forEach((b) =>
    b.addEventListener("click", () => {
      if ("video" in b.dataset) return montrerVideo();
      if (laVideo) {
        laVideo.pause();
        laVideo.hidden = true;
        boutonVideo.hidden = false;
      }
      const image = U.qs("#gallery-main");
      image.hidden = false;
      image.src = photos[b.dataset.i]; // data-i = numéro de la photo
      choisirVignette(b);
    })
  );

  // Contact : au premier clic sur un bouton de contact (ou à l'envoi d'une demande de visite),
  // on demande le numéro à la base (S.contacterAnnonce compte aussi le clic pour les
  // statistiques du propriétaire). Ensuite, les boutons deviennent de vrais liens.
  let numero = null; // numéro international (225 + 10 chiffres), connu après le 1er clic
  let enCours = false; // évite deux demandes en même temps (double clic)
  // Lien WhatsApp vers l'annonceur, avec un message déjà écrit
  const waLien = (texte) => `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
  // Adresse du contact : appel téléphonique, ou WhatsApp avec un message pré-rempli
  const lienContact = (type) =>
    type === "tel"
      ? `tel:+${numero}`
      : waLien(
          "Bonjour, je vous contacte au sujet de votre annonce Domi : " + a.titre + "\n" + lienFiche
        );

  // Demande le numéro à la base (une seule fois), puis transforme les boutons en vrais liens
  async function obtenirNumero() {
    if (numero) return numero;
    // a.telephone n'existe que si la base n'a pas encore le fichier 13 (repli)
    const recu = await S.contacterAnnonce(a.id, a.telephone);
    const chiffres = String(recu || "").replace(/\D/g, ""); // chiffres uniquement
    if (!chiffres) throw new Error("Contact indisponible : cette annonce n’est plus disponible.");
    numero = chiffres.startsWith("225") ? chiffres : "225" + chiffres; // ajoute l'indicatif
    // Les boutons deviennent de vrais liens (les clics suivants les ouvrent directement)
    main.querySelectorAll("[data-contact]").forEach((l) => {
      l.href = lienContact(l.dataset.contact);
      if (l.dataset.contact === "wa") {
        l.target = "_blank"; // WhatsApp dans un nouvel onglet
        l.rel = "noopener"; // la page WhatsApp ne peut pas agir sur Domi
      }
    });
    return numero;
  }

  // Ouvre une adresse (WhatsApp, Google Maps) dans un nouvel onglet. Renvoie false si le navigateur
  // a bloqué l'ouverture.
  function ouvrirOnglet(url) {
    const w = window.open(url, "_blank");
    if (!w) return false;
    try {
      w.opener = null; // même protection que rel="noopener"
    } catch (e) {} // certains navigateurs l'interdisent : sans gravité
    return true;
  }

  main.querySelectorAll("[data-contact]").forEach((bouton) =>
    bouton.addEventListener("click", async (e) => {
      if (numero) return; // numéro déjà connu : le lien s'ouvre normalement
      e.preventDefault(); // pas encore de numéro : on le demande d'abord
      if (enCours) return;
      enCours = true;
      try {
        await obtenirNumero();
        // Ouvre tout de suite le contact demandé
        if (bouton.dataset.contact === "tel") location.href = lienContact("tel");
        else if (!ouvrirOnglet(lienContact("wa")))
          U.toast("Touchez à nouveau le bouton pour ouvrir WhatsApp."); // ouverture bloquée
      } catch (err) {
        U.toast(err.message, "error");
      } finally {
        enCours = false;
      }
    })
  );

  // Carte (v8.2) : chargée seulement au clic, pour ne pas consommer le forfait de ceux qui ne
  // la regardent pas
  U.qs("#voir-carte")?.addEventListener("click", async (e) => {
    const bouton = e.currentTarget;
    const bloc = U.qs("#carte");
    bouton.disabled = true; // évite deux chargements
    try {
      const L = await window.ImmoCarte.charger();
      bloc.hidden = false;
      const carte = window.ImmoCarte.creer(L, bloc, [zoneLat, zoneLng], 15);
      window.ImmoCarte.zone(L, [zoneLat, zoneLng]).addTo(carte);
      bouton.hidden = true; // la carte est affichée : le bouton ne sert plus
    } catch (err) {
      bouton.disabled = false;
      U.toast(err.message, "error");
    }
  });

  // Itinéraire (v8.2) : le point exact n'est demandé à la base qu'ici, au clic (comme le numéro).
  // Google Maps s'ouvre avec le trajet et guide le visiteur en direct.
  let lienItineraire = null; // gardé après le 1er clic
  U.qs("#itineraire")?.addEventListener("click", async (e) => {
    const bouton = e.currentTarget;
    bouton.disabled = true;
    try {
      if (!lienItineraire) {
        const p = await S.itineraire(a.id);
        if (!p) throw new Error("L’emplacement exact n’est plus disponible pour cette annonce.");
        lienItineraire = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
      }
      if (!ouvrirOnglet(lienItineraire))
        U.toast("Touchez à nouveau « Itinéraire » pour ouvrir Google Maps.");
    } catch (err) {
      U.toast(err.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  // Copier le lien (v8.1) : presse-papiers, avec un repli pour les vieux navigateurs
  U.qs("#share-copy")?.addEventListener("click", async () => {
    let copie = false;
    try {
      await navigator.clipboard.writeText(lienFiche);
      copie = true;
    } catch (e) {
      const champ = document.createElement("textarea"); // repli : champ invisible + « copier »
      champ.value = lienFiche;
      champ.className = "hors-ecran";
      document.body.appendChild(champ);
      champ.select();
      try {
        copie = document.execCommand("copy");
      } catch (e2) {} // copie refusée : on affiche le lien à la place
      champ.remove();
    }
    if (copie) U.toast("Lien copié : collez-le où vous voulez.");
    else U.toast("Copie impossible. Voici le lien : " + lienFiche, "error");
  });

  /* ───────── Planifier une visite (v8.1) ─────────
     Le locataire choisit un jour (les 7 prochains), un moment et le type de visite.
     La demande part sur WhatsApp, déjà écrite : l'annonceur confirme l'heure. */
  const jours = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() + k); // aujourd'hui + k jours
    return d;
  });
  const dateCourte = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); // « 27 novembre »
  const jourSemaine = (d) => d.toLocaleDateString("fr-FR", { weekday: "long" }); // « jeudi »
  const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // Dans la liste : « Aujourd’hui (24 novembre) », « Demain (25 novembre) », « Jeudi 27 novembre »
  const libelleJour = (d, k) =>
    k === 0
      ? `Aujourd’hui (${dateCourte(d)})`
      : k === 1
        ? `Demain (${dateCourte(d)})`
        : `${majuscule(jourSemaine(d))} ${dateCourte(d)}`;
  // Dans le message : « aujourd’hui », « demain », « le jeudi 27 novembre »
  const jourMessage = (d, k) =>
    k === 0 ? "aujourd’hui" : k === 1 ? "demain" : `le ${jourSemaine(d)} ${dateCourte(d)}`;
  const MOMENTS = ["le matin", "l’après-midi", "le soir"]; // dans le message
  const ETIQUETTES = ["Matin", "Après-midi", "Soir"]; // sur les boutons

  // Fenêtre (textes fixes ou dates : rien ne vient d'un utilisateur dans ce HTML)
  const visite = document.createElement("dialog");
  visite.className = "report-dialog visit-dialog";
  visite.innerHTML = `<form>
    <h3>Planifier une visite</h3>
    <p class="muted m-0">Choisissez un moment : votre demande part sur WhatsApp, déjà écrite. L’annonceur vous confirme l’heure.</p>
    <label>Jour<select name="jour">${jours.map((d, k) => `<option value="${k}">${libelleJour(d, k)}</option>`).join("")}</select></label>
    <fieldset class="choix"><legend>Moment</legend><div class="choix-ligne">${ETIQUETTES.map((m, k) => `<label class="pill"><input type="radio" name="moment" value="${k}" ${k ? "" : "checked"}> ${m}</label>`).join("")}</div></fieldset>
    <fieldset class="choix"><legend>Type de visite</legend><div class="choix-ligne"><label class="pill"><input type="radio" name="type" value="place" checked> Sur place</label><label class="pill"><input type="radio" name="type" value="video"> Appel vidéo</label></div></fieldset>
    <label>Votre prénom (facultatif)<input name="prenom" maxlength="40" autocomplete="given-name"></label>
    <div class="notice info compact">${I("shield")} Ne payez rien avant d’avoir visité : ni avance, ni caution, ni « frais de visite ».</div>
    <div class="publish-actions"><button type="button" class="btn btn-outline" data-close>Annuler</button><button type="submit" class="btn btn-primary">${I("whatsapp")} Envoyer</button></div>
  </form>`;
  document.body.appendChild(visite);
  const ouvrirVisite = () => {
    if (dispo) visite.showModal(); // annonce indisponible : le bouton est déjà grisé
  };
  U.qs("#visit-listing")?.addEventListener("click", ouvrirVisite);
  U.qs("#visit-sticky")?.addEventListener("click", ouvrirVisite);
  visite.querySelector("[data-close]").addEventListener("click", () => visite.close()); // « Annuler »
  visite.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault(); // pas de rechargement de page
    if (enCours) return;
    const f = new FormData(e.target);
    const k = Math.min(6, Math.max(0, Number(f.get("jour")) || 0)); // jour choisi (0 à 6)
    const moment = MOMENTS[Number(f.get("moment"))] || MOMENTS[0];
    // Prénom : une seule ligne, 40 caractères au plus
    const prenom = String(f.get("prenom") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const texte =
      `Bonjour${prenom ? ", je m’appelle " + prenom : ""}. J’ai vu votre annonce « ${a.titre} » sur Domi :\n${lienFiche}\n\n` +
      `Je souhaiterais la visiter ${jourMessage(jours[k], k)}, ${moment}, ` +
      `${f.get("type") === "video" ? "en appel vidéo WhatsApp" : "sur place"}. Est-ce possible ?`;
    enCours = true;
    try {
      await obtenirNumero();
      if (!ouvrirOnglet(waLien(texte))) {
        U.toast("Touchez à nouveau « Envoyer » pour ouvrir WhatsApp."); // ouverture bloquée
        return;
      }
      visite.close();
      U.toast("WhatsApp s’ouvre avec votre demande de visite.");
    } catch (err) {
      U.toast(err.message, "error");
    } finally {
      enCours = false;
    }
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
  const reportForm = dlg.querySelector("form");
  U.qs("#report-listing").addEventListener("click", () => {
    U.protectForm(reportForm); // anti-robot : champ piège + chronomètre (js/utils.js)
    dlg.showModal(); // ouvre la fenêtre
  });
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close()); // « Annuler »
  // Envoi du signalement
  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // pas de rechargement de page
    const bot = U.botCheck(reportForm, 1500); // signalement court : 1,5 s minimum
    if (bot === "piege") {
      dlg.close(); // robot : on fait comme si c'était envoyé
      return;
    }
    if (bot === "trop-vite") {
      U.toast("Envoi trop rapide, réessayez dans un instant.", "error");
      return;
    }
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
