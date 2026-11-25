/* ═══════════════════════════════════════════════════════════════════
   video.js : préparation d'une vidéo de logement dans le téléphone (v8.3)

   Utilisé par : publier.html. Aucun serveur ne traite la vidéo : c'est le téléphone
   (ou l'ordinateur) de l'annonceur qui la réduit avant l'envoi, comme pour les photos.

   Pourquoi : une vidéo de 3 minutes filmée au téléphone pèse souvent plus de 300 Mo, alors
   que tout le stockage gratuit fait 1 Go. Ici, elle passe à environ 20 Mo.

   Comment : on lit la vidéo en temps réel, on dessine chaque image en plus petit sur une
   toile, et le navigateur enregistre cette toile (avec le son). Cela prend donc environ la
   durée de la vidéo : 2 à 3 minutes, page ouverte et écran allumé.

   Format : MP4 (H.264 + son AAC) si le navigateur sait le produire : lisible partout, iPhone
   compris. Sinon WebM, lisible sur Android et ordinateur.

   Expose : window.ImmoVideo
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const MIN_S = 120; // durée minimale : 2 minutes
  const MAX_S = 180; // durée maximale : 3 minutes
  const MARGE = 2; // tolérance : un téléphone coupe rarement à la seconde près
  const COTE_MAX = 854; // plus grand côté de la vidéo envoyée (qualité « 480p »)
  const IPS = 25; // images par seconde
  const DEBIT_VIDEO = 750_000; // bits par seconde (environ 17 Mo pour 3 minutes)
  const DEBIT_AUDIO = 64_000; // son correct pour une voix
  const POIDS_MAX = 40 * 1024 * 1024; // même limite que le dossier « videos » (database/14)

  // Formats d'enregistrement, du plus lisible au moins lisible. « video/mp4 » seul est en dernier :
  // il donne du VP9 (illisible sur certains iPhone) sur Chrome, mais du H.264 sur Safari.
  const FORMATS = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const formatPossible = () =>
    typeof MediaRecorder === "undefined"
      ? ""
      : FORMATS.find((f) => MediaRecorder.isTypeSupported(f)) || "";

  // « 134 s » → « 2 min 14 s »
  const formaterDuree = (s) => {
    const t = Math.round(s);
    return t < 60 ? `${t} s` : `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, "0")} s`;
  };

  // Durée acceptée ? Renvoie { ok, message }
  function juger(duree, { min = MIN_S, max = MAX_S } = {}) {
    if (duree < min - MARGE)
      return {
        ok: false,
        message: `Votre vidéo dure ${formaterDuree(duree)} : c’est trop court. Filmez entre ${min / 60} et ${max / 60} minutes pour bien présenter le logement.`,
      };
    if (duree > max + MARGE)
      return {
        ok: false,
        message: `Votre vidéo dure ${formaterDuree(duree)} : c’est trop long. La durée maximale est de ${max / 60} minutes.`,
      };
    return { ok: true, message: `Durée : ${formaterDuree(duree)}. C’est parfait.` };
  }

  // Attend un événement d'une vidéo (au plus ms millisecondes)
  const evenement = (video, nom, ms) =>
    new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new Error("délai dépassé")), ms);
      video.addEventListener(
        nom,
        () => {
          clearTimeout(t);
          ok();
        },
        { once: true }
      );
    });

  // Ouvre un fichier vidéo du téléphone : renvoie sa durée et ses dimensions, et la balise prête à lire
  async function ouvrir(fichier) {
    const url = URL.createObjectURL(fichier); // adresse temporaire, sur l'appareil seulement
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    try {
      video.src = url;
      await Promise.race([
        evenement(video, "loadedmetadata", 20000),
        new Promise((_, ko) =>
          video.addEventListener("error", () => ko(new Error("illisible")), { once: true })
        ),
      ]);
      let duree = video.duration;
      if (!Number.isFinite(duree)) {
        // Certaines vidéos ne disent pas leur durée : on saute « à la fin » pour que le navigateur la calcule
        video.currentTime = 1e101;
        await evenement(video, "timeupdate", 15000).catch(() => {});
        duree = video.duration;
        video.currentTime = 0;
      }
      if (!Number.isFinite(duree) || !video.videoWidth) throw new Error("illisible");
      return { video, url, duree, largeur: video.videoWidth, hauteur: video.videoHeight };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error(
        "Cette vidéo ne peut pas être lue. Essayez une autre vidéo, filmée avec votre téléphone."
      );
    }
  }

  // Renvoie seulement la durée d'un fichier vidéo (pour le contrôle au moment du choix)
  async function lireDuree(fichier) {
    const info = await ouvrir(fichier);
    URL.revokeObjectURL(info.url);
    return info.duree;
  }

  // Prépare la vidéo (temps réel). À lancer depuis un bouton : le navigateur n'autorise la lecture
  // avec le son qu'après une action du visiteur.
  //   surProgres(0…1) : avancement ;  estAnnule() : vrai pour arrêter
  // Renvoie le fichier réduit (Blob).
  async function preparer(fichier, { surProgres = () => {}, estAnnule = () => false } = {}) {
    const format = formatPossible();
    if (!format || !HTMLCanvasElement.prototype.captureStream)
      throw new Error(
        "Votre navigateur ne sait pas préparer une vidéo. Utilisez Chrome, Edge ou Safari à jour."
      );
    const { video, url, duree, largeur, hauteur } = await ouvrir(fichier);
    let contexte; // pour le son
    let verrou; // écran allumé pendant la préparation
    let minuterie;
    const nettoyer = [];
    try {
      // Dimensions réduites, toujours paires (exigence du format vidéo)
      const echelle = Math.min(1, COTE_MAX / Math.max(largeur, hauteur));
      const pair = (n) => Math.max(2, Math.round((n * echelle) / 2) * 2);
      const toile = document.createElement("canvas");
      toile.width = pair(largeur);
      toile.height = pair(hauteur);
      const dessin = toile.getContext("2d", { alpha: false });
      const flux = toile.captureStream(IPS); // images de la toile

      // Son : passe par WebAudio (rien ne sort des haut-parleurs). Sans son possible : vidéo muette.
      try {
        contexte = new (window.AudioContext || window.webkitAudioContext)();
        await contexte.resume();
        const sortie = contexte.createMediaStreamDestination();
        contexte.createMediaElementSource(video).connect(sortie);
        sortie.stream.getAudioTracks().forEach((piste) => flux.addTrack(piste));
      } catch (e) {
        video.muted = true; // son indisponible : on évite au moins de le jouer dans les haut-parleurs
      }

      // Enregistreur
      const morceaux = [];
      const enregistreur = new MediaRecorder(flux, {
        mimeType: format,
        videoBitsPerSecond: DEBIT_VIDEO,
        audioBitsPerSecond: DEBIT_AUDIO,
      });
      enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      const arret = new Promise((ok) => {
        enregistreur.onstop = ok;
      });
      // Panne de l'enregistreur : fait échouer la préparation (au lieu d'attendre la fin)
      const panne = new Promise((_, ko) => {
        enregistreur.onerror = () => ko(new Error("La préparation de la vidéo s’est arrêtée."));
      });

      // Chaque image de la vidéo est dessinée sur la toile
      const dessiner = () => dessin.drawImage(video, 0, 0, toile.width, toile.height);
      const boucle = () => {
        dessiner();
        if (!video.ended && !video.paused) planifier();
      };
      const planifier = () =>
        "requestVideoFrameCallback" in video
          ? video.requestVideoFrameCallback(boucle)
          : requestAnimationFrame(boucle);
      video.addEventListener("play", planifier);

      // L'application passe en arrière-plan : on met en pause, et on reprend à son retour
      const surVisibilite = () => {
        if (document.hidden) {
          video.pause();
          if (enregistreur.state === "recording") enregistreur.pause();
        } else {
          if (enregistreur.state === "paused") enregistreur.resume();
          video.play().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", surVisibilite);
      nettoyer.push(() => document.removeEventListener("visibilitychange", surVisibilite));

      try {
        verrou = await navigator.wakeLock?.request("screen"); // écran allumé (si le téléphone le permet)
      } catch (e) {}

      // Avancement, annulation, et garde-fou si la lecture se bloque
      const arretSuivi = new Promise((_, ko) => {
        let dernier = -1;
        let sansBouger = 0;
        minuterie = setInterval(() => {
          surProgres(Math.min(1, video.currentTime / duree));
          if (estAnnule()) ko(Object.assign(new Error("Préparation annulée."), { annule: true }));
          if (document.hidden || video.paused) return; // en pause volontaire : on attend
          sansBouger = video.currentTime === dernier ? sansBouger + 1 : 0;
          dernier = video.currentTime;
          if (sansBouger > 60) ko(new Error("La préparation est bloquée. Réessayez.")); // 30 s sans avancer
        }, 500);
      });

      // Fin de la vidéo (sécurité : durée + 2 minutes, si la page est restée en arrière-plan trop longtemps)
      const fini = evenement(video, "ended", (duree + 120) * 1000).catch(() => {
        throw new Error(
          "La préparation a été interrompue trop longtemps. Réessayez en gardant la page ouverte."
        );
      });
      enregistreur.start(1000); // un morceau par seconde
      try {
        await video.play();
      } catch (e) {
        throw new Error("Appuyez de nouveau sur « Commencer »."); // lecture refusée par le navigateur
      }
      await Promise.race([fini, arretSuivi, panne]);
      enregistreur.stop();
      await arret;
      surProgres(1);

      const resultat = new Blob(morceaux, { type: format.split(";")[0] });
      if (!resultat.size) throw new Error("La vidéo préparée est vide. Réessayez.");
      if (resultat.size > POIDS_MAX)
        throw new Error("La vidéo préparée est encore trop lourde. Filmez un peu moins longtemps.");
      return resultat;
    } finally {
      clearInterval(minuterie);
      nettoyer.forEach((f) => f());
      video.pause();
      video.removeAttribute("src"); // libère le fichier
      video.load();
      contexte?.close().catch(() => {});
      verrou?.release().catch(() => {});
      URL.revokeObjectURL(url);
    }
  }

  window.ImmoVideo = {
    MIN_S,
    MAX_S,
    POIDS_MAX,
    formaterDuree,
    juger,
    lireDuree,
    preparer,
    format: formatPossible,
    disponible: () => !!formatPossible() && "captureStream" in HTMLCanvasElement.prototype,
  };
})();
