/* ═══════════════════════════════════════════════════════════════════
   publier.js : formulaire de publication et de modification d'annonce
   (publier.html, et publier.html?edit=<id> pour modifier)

   Étapes à l'envoi : lire les champs → vérifier → compresser et envoyer
   les photos → créer (ou modifier) l'annonce → aller au tableau de bord.
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  const U = ImmoUtils; // boîte à outils
  const S = ImmoStorage; // accès à la base
  const user = await ImmoAuth.requireUser(); // page réservée : redirige si non connecté
  if (!user) return;

  const form = U.qs("#publish-form"); // le formulaire
  const msg = U.qs("#publish-message"); // zone des messages d'erreur
  const el = (n) => form.elements[n]; // raccourci : champ du formulaire par son nom
  const editId = U.getParam("edit"); // identifiant de l'annonce à modifier (ou null)
  const files = U.qs("#photos"); // champ de choix des photos
  const prev = U.qs("#photo-preview"); // zone d'aperçu des photos

  U.fillCommunes(el("commune")); // liste des communes

  // Bloque le formulaire avec un message (bouton d'envoi désactivé)
  const lock = (t) => {
    U.showMessage(msg, t, "error");
    form.querySelectorAll("button.btn-primary").forEach((b) => (b.disabled = true));
  };
  if (user.role === "admin") {
    // l'admin modère, il ne publie pas
    lock("Le compte administrateur n’est pas destiné à publier des biens.");
    return;
  }
  el("telephone").value = user.telephone || ""; // numéro du compte proposé par défaut

  // Modération mixte (database/08) : un compte vérifié publie sans attendre
  if (user.verifie) {
    form.querySelector("button.btn-primary").textContent = "Publier maintenant";
    U.qs("#publish-intro").textContent =
      "Votre compte est vérifié : votre annonce sera visible dès son envoi. Une annonce complète et honnête reçoit plus de contacts sérieux.";
  }

  // Mode modification : on charge l'annonce et on pré-remplit les champs
  let existing = null; // l'annonce existante (null = nouvelle annonce)
  if (editId) {
    existing = await S.getAnnonce(editId).catch(() => null);
    // Sécurité d'affichage : seule SA propre annonce est modifiable
    // (la base le vérifie aussi avec la règle RLS listing_update)
    if (!existing || existing.owner_id !== user.id) {
      lock("Annonce introuvable ou non modifiable.");
      return;
    }
    // Recopie chaque valeur de l'annonce dans le champ du même nom
    [
      "titre",
      "type",
      "loyer",
      "statut",
      "description",
      "commune",
      "quartier",
      "adresse",
      "cie",
      "sodeci",
      "avance",
      "caution",
      "etage",
      "chambres",
      "video",
      "telephone",
    ].forEach((n) => {
      if (el(n) && existing[n] != null) el(n).value = existing[n]; // != null : ni null ni undefined
    });
    U.qs("#publish-title").textContent = "Modifier votre annonce."; // nouveau titre de page
    // Aperçu des photos actuelles
    prev.innerHTML =
      (existing.images || [])
        .map(U.safeUrl) // adresses vérifiées
        .filter(Boolean)
        .map((u) => `<img src="${U.escapeHtml(u)}" alt="">`)
        .join("") +
      '<p class="fine-print">Photos actuelles. En choisir de nouvelles remplace celles-ci. Modifier le contenu renvoie l’annonce en validation.</p>';
  }

  // Aperçu immédiat des photos choisies (avant l'envoi)
  files.addEventListener("change", () => {
    prev.innerHTML =
      [...files.files] // [...] transforme la liste de fichiers en tableau
        .slice(0, 6) // 6 photos maximum
        // URL.createObjectURL : adresse temporaire « blob: » pour afficher un fichier local
        .map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`)
        .join("") +
      (files.files.length > 6
        ? '<p class="fine-print">Seules les 6 premières photos seront envoyées.</p>'
        : "");
  });

  // Envoi du formulaire
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // pas d'envoi classique (rechargement)
    const btn = form.querySelector("button.btn-primary"); // bouton d'envoi
    const label = btn.textContent; // texte d'origine (pour le remettre en cas d'erreur)
    btn.disabled = true; // évite le double envoi
    btn.textContent = "Envoi en cours…";
    try {
      const d = new FormData(form); // lit tous les champs
      // Ligne à enregistrer dans la table listings (trim : espaces inutiles retirés)
      const row = {
        titre: d.get("titre").trim(),
        type: d.get("type"),
        loyer: Number(d.get("loyer")),
        statut: d.get("statut"),
        description: d.get("description").trim(),
        commune: d.get("commune"),
        quartier: d.get("quartier").trim(),
        adresse: d.get("adresse").trim() || null, // vide → null
        cie: d.get("cie"),
        sodeci: d.get("sodeci"),
        avance: Number(d.get("avance")) || 0,
        caution: Number(d.get("caution")) || 0,
        etage: d.get("etage").trim() || null,
        chambres: Number(d.get("chambres")) || 0,
        video: U.safeUrl(d.get("video")) || null, // seuls les liens http(s) sont acceptés
        telephone: ImmoAuth.normalize(d.get("telephone")), // 10 chiffres (erreur sinon)
      };
      if (!row.commune) throw new Error("Choisissez une commune."); // commune obligatoire
      const picked = [...files.files]; // photos choisies
      if (!existing && !picked.length) throw new Error("Ajoutez au moins une photo du logement.");
      if (picked.length) {
        const urls = await S.uploadPhotos(picked, user.id); // compression + envoi
        if (!urls.length) throw new Error("Aucune image valide.");
        row.images = urls; // toutes les photos
        row.image = urls[0]; // la première = photo principale
      }
      if (existing)
        await S.updateAnnonce(existing.id, row); // modification
      else await S.ajouterAnnonce({ ...row, owner_id: user.id }); // création ({...row} = copie de row)
      location.href = "dashboard-proprietaire.html?publie=1"; // retour au tableau de bord
    } catch (err) {
      U.showMessage(msg, err.message, "error"); // affiche l'erreur (ex. limite de 10 annonces/jour)
      btn.disabled = false; // le bouton redevient cliquable
      btn.textContent = label;
    }
  });
});
