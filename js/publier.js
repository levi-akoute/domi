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
  const videoChamp = U.qs("#video"); // champ de choix de la vidéo
  const videoInfo = U.qs("#video-info"); // durée et verdict
  const videoApercu = U.qs("#video-apercu"); // aperçu de la vidéo
  let videoValide = false; // durée correcte (2 à 3 minutes) ?
  let videoUrl = ""; // adresse temporaire de l'aperçu (à libérer)
  // Une vidéo déjà sur Domi (dossier « videos », database/14) ; les anciens liens externes ne sont plus acceptés
  const VIDEO_DOMI = /\/storage\/v1\/object\/public\/videos\//;

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
    // getMonAnnonce : l'annonce COMPLÈTE (numéro, repère…), que la base ne donne qu'à son propriétaire
    existing = await S.getMonAnnonce(editId).catch(() => null);
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
      "telephone",
    ].forEach((n) => {
      if (el(n) && existing[n] != null) el(n).value = existing[n]; // != null : ni null ni undefined
    });
    if (existing.video && VIDEO_DOMI.test(existing.video)) {
      // Vidéo actuelle : aperçu (rien ne se télécharge avant l'appui sur « lecture ») et case « retirer »
      videoApercu.src = U.safeUrl(existing.video);
      videoApercu.preload = "none";
      videoApercu.hidden = false;
      U.qs("#video-retirer-choix").hidden = false;
      videoInfo.textContent = "Vidéo actuelle. En choisir une nouvelle remplace celle-ci.";
    }
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

  /* ───────── Vidéo de présentation (v8.3) ─────────
     L'annonceur filme 2 à 3 minutes. Au choix du fichier, on lit sa durée. À l'envoi, la vidéo est
     préparée dans l'appareil (js/video.js), puis envoyée dans le dossier « videos ». */
  const V = window.ImmoVideo;

  // Choix d'un fichier : durée lue, aperçu, verdict (trop court, trop long, parfait)
  videoChamp.addEventListener("change", async () => {
    videoValide = false;
    const f = videoChamp.files[0];
    if (!f) {
      videoInfo.textContent = "";
      videoApercu.hidden = true;
      return;
    }
    videoInfo.textContent = "Lecture de la vidéo…";
    if (!V.disponible()) {
      videoInfo.textContent =
        "Votre navigateur ne sait pas préparer une vidéo. Utilisez Chrome, Edge ou Safari à jour, ou publiez sans vidéo.";
      return;
    }
    try {
      const duree = await V.lireDuree(f);
      const verdict = V.juger(duree);
      videoValide = verdict.ok;
      videoInfo.textContent = verdict.message;
      if (videoUrl) URL.revokeObjectURL(videoUrl); // libère l'aperçu précédent
      videoUrl = URL.createObjectURL(f);
      videoApercu.src = videoUrl;
      videoApercu.preload = "metadata";
      videoApercu.hidden = false;
      U.qs("#video-retirer-choix").hidden = true; // une nouvelle vidéo remplace déjà l'ancienne
    } catch (err) {
      videoInfo.textContent = err.message;
    }
  });

  // Fenêtre de préparation : explique l'attente, montre l'avancement, permet d'annuler.
  // Renvoie la vidéo préparée (Blob), ou lève une erreur (annulation, navigateur non compatible…).
  function preparerVideo(fichier) {
    return new Promise((ok, ko) => {
      const dlg = document.createElement("dialog");
      dlg.className = "report-dialog prep-dialog";
      dlg.innerHTML = `<h3>Préparation de la vidéo</h3>
        <p class="m-0" id="prep-texte">Votre téléphone va réduire la vidéo avant l’envoi. Cela prend environ sa durée (2 à 3 minutes). Gardez cette page ouverte et l’écran allumé.</p>
        <progress id="prep-barre" max="100" value="0" hidden></progress>
        <div class="publish-actions"><button type="button" class="btn btn-outline" data-annuler>Annuler</button><button type="button" class="btn btn-primary" data-commencer>Commencer</button></div>`;
      document.body.appendChild(dlg);
      const barre = dlg.querySelector("#prep-barre");
      const texte = dlg.querySelector("#prep-texte");
      let annule = false;
      const fin = (f, v) => {
        dlg.close();
        dlg.remove();
        f(v);
      };
      dlg.querySelector("[data-annuler]").addEventListener("click", () => {
        annule = true; // la préparation s'arrête à la prochaine vérification
        fin(ko, new Error("Préparation annulée : l’annonce n’a pas été envoyée."));
      });
      dlg.addEventListener("cancel", (e) => e.preventDefault()); // Échap : on passe par « Annuler »
      dlg.querySelector("[data-commencer]").addEventListener("click", async (e) => {
        e.currentTarget.hidden = true; // bouton « Commencer » : une seule fois
        barre.hidden = false;
        texte.textContent = "Préparation en cours : gardez cette page ouverte…";
        try {
          const blob = await V.preparer(fichier, {
            surProgres: (p) => {
              barre.value = Math.round(p * 100);
              texte.textContent = `Préparation en cours : ${Math.round(p * 100)} %. Gardez cette page ouverte et l’écran allumé.`;
            },
            estAnnule: () => annule,
          });
          fin(ok, blob);
        } catch (err) {
          if (!annule) fin(ko, err);
        }
      });
      dlg.showModal();
    });
  }

  /* ───────── Épingle sur la carte (v8.2) ─────────
     L'annonceur place une épingle (avec sa position, ou à la main sur la carte). Les visiteurs
     verront une zone de 300 m ; le point exact sort seulement au clic sur « Itinéraire ». */
  const bloc = U.qs("#carte-bloc");
  const carteDiv = U.qs("#carte");
  const texte = U.qs("#position-texte");
  let carte = null; // carte Leaflet, créée à la première ouverture
  let L = null; // librairie Leaflet (chargée à la demande)
  let epingle = null; // marqueur déplaçable
  let carteActive = false; // la base connaît-elle la carte ? (database/14)

  // Enregistre l'épingle dans le formulaire (6 décimales : précision d'environ 10 cm)
  const enregistrer = (lat, lng) => {
    el("latitude").value = lat.toFixed(6);
    el("longitude").value = lng.toFixed(6);
    U.qs("#retirer-position").hidden = false;
    U.qs("#itineraire-choix").hidden = false;
  };

  // Affiche la carte centrée à l'endroit voulu (une seule création)
  async function ouvrirCarte(centre, zoom) {
    if (!L) L = await window.ImmoCarte.charger();
    carteDiv.hidden = false;
    if (!carte) {
      carte = window.ImmoCarte.creer(L, carteDiv, centre, zoom);
      carte.on("click", (ev) => poser(ev.latlng.lat, ev.latlng.lng)); // toucher la carte = poser l'épingle
    } else carte.setView(centre, zoom);
    setTimeout(() => carte.invalidateSize(), 50); // la carte vient d'apparaître : recalcule sa taille
  }

  // Pose ou déplace l'épingle (refuse hors de Côte d'Ivoire). Renvoie vrai si c'est fait.
  function poser(lat, lng) {
    if (!window.ImmoCarte.dansLePays(lat, lng)) {
      U.toast("Cette position est en dehors de la Côte d’Ivoire.", "error");
      return false;
    }
    if (!epingle) {
      epingle = L.marker([lat, lng], {
        draggable: true, // on peut la déplacer au doigt
        icon: window.ImmoCarte.epingle(L),
      }).addTo(carte);
      epingle.on("dragend", () => {
        const pos = epingle.getLatLng(); // nouvelle position après déplacement
        if (window.ImmoCarte.dansLePays(pos.lat, pos.lng)) return enregistrer(pos.lat, pos.lng);
        U.toast("Cette position est en dehors de la Côte d’Ivoire.", "error");
        epingle.setLatLng([Number(el("latitude").value), Number(el("longitude").value)]); // remet l'ancienne
      });
    } else epingle.setLatLng([lat, lng]);
    enregistrer(lat, lng);
    return true;
  }

  // Centre de la carte selon la commune choisie (sinon tout le pays)
  const centreDuChoix = () => {
    const c = window.ImmoCarte.centreCommune(el("commune").value);
    return c ? [c, 13] : [window.ImmoCarte.PAYS, 7];
  };

  // Bouton « Utiliser ma position » : GPS du téléphone (le site doit être en HTTPS)
  U.qs("#ma-position").addEventListener("click", () => {
    if (!navigator.geolocation)
      return U.toast("La position n’est pas disponible sur cet appareil.", "error");
    texte.textContent = "Recherche de votre position…";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        try {
          await ouvrirCarte([latitude, longitude], 17);
          if (!poser(latitude, longitude)) {
            texte.textContent = "";
            return;
          }
          texte.textContent =
            accuracy > 200
              ? `Position peu précise (environ ${Math.round(accuracy)} m) : vérifiez et déplacez l’épingle.`
              : "Position trouvée. Vérifiez et déplacez l’épingle si besoin.";
        } catch (err) {
          texte.textContent = "";
          U.toast(err.message, "error");
        }
      },
      (err) => {
        texte.textContent = "";
        U.toast(
          err.code === 1
            ? "Position refusée : autorisez la localisation dans votre navigateur, ou placez l’épingle sur la carte."
            : "Position introuvable : placez l’épingle sur la carte.",
          "error"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } // GPS, 15 s maximum
    );
  });

  // Bouton « Placer sur la carte » : carte centrée sur la commune
  U.qs("#placer-carte").addEventListener("click", async () => {
    try {
      const [centre, zoom] = centreDuChoix();
      await ouvrirCarte(centre, zoom);
      texte.textContent = "Touchez la carte pour placer l’épingle, puis déplacez-la si besoin.";
    } catch (err) {
      U.toast(err.message, "error");
    }
  });

  // Bouton « Retirer l’épingle »
  U.qs("#retirer-position").addEventListener("click", () => {
    epingle?.remove();
    epingle = null;
    el("latitude").value = "";
    el("longitude").value = "";
    U.qs("#retirer-position").hidden = true;
    U.qs("#itineraire-choix").hidden = true;
    texte.textContent = "Épingle retirée : l’annonce n’a plus d’emplacement.";
  });

  // Changer de commune : la carte ouverte se recentre (seulement si aucune épingle n'est posée)
  el("commune").addEventListener("change", () => {
    if (!carte || epingle) return;
    const [centre, zoom] = centreDuChoix();
    carte.setView(centre, zoom);
  });

  // La base connaît-elle la carte ? Si oui, on affiche le bloc (et l'épingle existante)
  carteActive = await S.carteActive().catch(() => false);
  if (carteActive) {
    bloc.hidden = false;
    U.qs("#video-bloc").hidden = false; // le fichier 14 crée aussi le dossier des vidéos
    if (existing && existing.latitude != null && existing.longitude != null) {
      el("itineraire").checked = existing.itineraire !== false;
      try {
        await ouvrirCarte([existing.latitude, existing.longitude], 16);
        poser(existing.latitude, existing.longitude);
        texte.textContent = "Épingle actuelle. Déplacez-la si elle est mal placée.";
      } catch (err) {
        // Carte indisponible : on garde l'épingle enregistrée telle quelle
        enregistrer(existing.latitude, existing.longitude);
        texte.textContent = "La carte n’a pas pu se charger : l’épingle actuelle est gardée.";
      }
    }
  }

  // Envoi du formulaire
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // pas d'envoi classique (rechargement)
    const btn = form.querySelector("button.btn-primary"); // bouton d'envoi
    const label = btn.textContent; // texte d'origine (pour le remettre en cas d'erreur)
    btn.disabled = true; // évite le double envoi
    btn.textContent = "Envoi en cours…";
    msg.classList.add("hidden"); // efface le message d'un essai précédent
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
        telephone: ImmoAuth.normalize(d.get("telephone")), // 10 chiffres (erreur sinon)
      };
      // Position de l'épingle (v8.2) : seulement si la base connaît la carte (database/14)
      if (carteActive) {
        const lat = d.get("latitude"); // "" si aucune épingle
        const lng = d.get("longitude");
        row.latitude = lat === "" ? null : Number(lat);
        row.longitude = lng === "" ? null : Number(lng);
        row.itineraire = el("itineraire").checked; // accord pour donner le point exact
      }
      if (!row.commune) throw new Error("Choisissez une commune."); // commune obligatoire
      // Vidéo (v8.3). videoBlob = nouvelle vidéo à envoyer (préparée plus bas) ; videoRetiree = case cochée
      const fichierVideo = carteActive && videoChamp.files[0] ? videoChamp.files[0] : null;
      const videoRetiree = !!d.get("video_retirer");
      if (fichierVideo && !videoValide)
        throw new Error(
          videoInfo.textContent || "Cette vidéo ne convient pas : choisissez-en une autre."
        );
      // Ancien lien externe (avant la v8.3) : la base ne l'accepte plus, on l'enlève
      const ancienneVideo = existing?.video || null;
      if (existing && ancienneVideo && !VIDEO_DOMI.test(ancienneVideo)) row.video = null;
      const picked = [...files.files]; // photos choisies
      if (!existing && !picked.length) throw new Error("Ajoutez au moins une photo du logement.");
      // 1) Préparer la vidéo d'abord (longue) : si l'annonceur annule, rien n'a été envoyé
      let videoBlob = null;
      if (fichierVideo) videoBlob = await preparerVideo(fichierVideo);
      // 2) Envoyer les photos
      if (picked.length) {
        const urls = await S.uploadPhotos(picked, user.id); // compression + envoi
        if (!urls.length) throw new Error("Aucune image valide.");
        row.images = urls; // toutes les photos
        row.image = urls[0]; // la première = photo principale
      }
      // 3) Envoyer la vidéo préparée (nouvelle), ou retirer l'actuelle
      let videoEnvoyee = null; // adresse de la vidéo envoyée : effacée si l'annonce n'est pas enregistrée
      if (videoBlob) {
        btn.textContent = "Envoi de la vidéo…";
        videoEnvoyee = await S.uploadVideo(videoBlob, user.id);
        row.video = videoEnvoyee;
      } else if (videoRetiree) row.video = null;
      if (existing) {
        try {
          await S.updateAnnonce(existing.id, row); // modification
        } catch (err) {
          if (videoEnvoyee) await S.supprimerVideo(videoEnvoyee); // l'annonce n'est pas changée : pas de vidéo orpheline
          throw err;
        }
        // Vidéo remplacée ou retirée : l'ancienne est effacée du stockage
        if ("video" in row && ancienneVideo && ancienneVideo !== row.video)
          await S.supprimerVideo(ancienneVideo);
        // Nouvelles photos : les anciennes qui ne servent plus sont effacées du stockage
        if (row.images) {
          const anciennes = [existing.image, ...(existing.images || [])];
          await S.supprimerPhotos(anciennes.filter((u) => u && !row.images.includes(u)));
        }
      } else {
        try {
          await S.ajouterAnnonce({ ...row, owner_id: user.id }); // création ({...row} = copie de row)
        } catch (err) {
          if (videoEnvoyee) await S.supprimerVideo(videoEnvoyee);
          throw err;
        }
      }
      location.href = "dashboard-proprietaire.html?publie=1"; // retour au tableau de bord
    } catch (err) {
      U.showMessage(msg, err.message, "error"); // affiche l'erreur (ex. limite de 10 annonces/jour)
      btn.disabled = false; // le bouton redevient cliquable
      btn.textContent = label;
    }
  });
});
