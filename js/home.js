/* ═══════════════════════════════════════════════════════════════════
   home.js : la vitrine photo (carrousel) de la page d'accueil (v7.2)

   Ce qui défile : uniquement des PHOTOS d'annonces (plus de bannières de texte).
     1. d'abord les annonces « À la une » en cours (choisies par l'admin),
        dans un ordre tiré au hasard à chaque visite (chacune est vue autant) ;
     2. puis les dernières annonces publiées, pour remplir les places restantes ;
     6 photos au maximum.
   Seules les photos d'au moins 800 px de large entrent : une petite photo serait
   floue en grand. S'il n'en reste aucune, la vitrine est cachée et l'accueil
   affiche une bannière fixe (titre + recherche + dessin de maison).

   Fonctionnement du défilement : toutes les photos sont alignées côte à côte
   dans #slides. Pour montrer la photo n°2, on décale #slides de 200 % vers la
   gauche (translateX(-200%)). Le CSS anime ce décalage.

   Commandes : défilement automatique (5 s), points, flèches, glissement au doigt,
   pause au survol, ARRÊT dès qu'on touche la vitrine, bouton pause / lecture.
   Expose : window.ImmoCarousel (utilisé par annonces.js)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const U = window.ImmoUtils; // boîte à outils
  const MAX = 6; // nombre maximum de photos dans la vitrine
  const LARGEUR_MIN = 800; // largeur minimale d'une photo (pixels) pour être nette en grand
  const DUREE = 5000; // temps d'affichage d'une photo (millisecondes = 5 secondes)
  // Le visiteur a-t-il demandé « moins d'animations » dans son téléphone ? (accessibilité)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let idx = 0; // numéro de la photo affichée (0 = la première)
  let timer = null; // minuteur du défilement automatique
  let survol = false; // vrai quand la souris ou le clavier est sur la vitrine (pause temporaire)
  let arrete = reduce; // vrai quand le visiteur a arrêté le défilement (toucher ou bouton pause)

  // Toutes les photos présentes dans la vitrine
  const slides = () => document.querySelectorAll("#slides .slide");

  // Affiche la photo n°i
  function go(i) {
    const n = slides().length; // nombre de photos
    if (!n) return; // aucune : rien à faire
    idx = (i + n) % n; // % (modulo) : après la dernière on revient à la première, et inversement
    U.qs("#slides").style.transform = `translateX(-${idx * 100}%)`; // décale la bande
    // Met à jour les points : le point actif est « on »
    document.querySelectorAll("#banner-dots button").forEach((d, k) => {
      d.classList.toggle("on", k === idx);
      d.setAttribute("aria-current", String(k === idx)); // pour les lecteurs d'écran
    });
    // Les photos cachées sont ignorées par les lecteurs d'écran et par la touche Tab
    slides().forEach((s, k) => {
      s.setAttribute("aria-hidden", String(k !== idx));
      s.tabIndex = k === idx ? 0 : -1;
    });
  }

  // (Re)lance le défilement automatique (s'il n'est pas arrêté et s'il y a plusieurs photos)
  function restart() {
    clearInterval(timer); // arrête l'ancien minuteur
    if (arrete || slides().length < 2) return;
    timer = setInterval(() => {
      if (!survol) go(idx + 1); // photo suivante, sauf pendant un survol
    }, DUREE);
  }

  // Arrête (true) ou relance (false) le défilement, et met le bouton pause à jour
  function setArret(on) {
    arrete = on;
    const b = U.qs("#banner-pause");
    if (b) {
      b.setAttribute("aria-pressed", String(on)); // état lu par les lecteurs d'écran
      b.setAttribute(
        "aria-label",
        on ? "Reprendre le défilement" : "Mettre le défilement en pause"
      );
      b.classList.toggle("is-paused", on); // le CSS montre ▶ ou ❚❚
    }
    restart();
  }

  // Crée un point (bouton) par photo
  function buildDots() {
    U.qs("#banner-dots").innerHTML = Array.from(
      { length: slides().length }, // autant de points que de photos
      (_, k) => `<button type="button" aria-label="Voir la photo ${k + 1}"></button>`
    ).join("");
    // Clic sur un point → affiche la photo correspondante
    document.querySelectorAll("#banner-dots button").forEach((b, k) =>
      b.addEventListener("click", () => {
        go(k);
        restart(); // remet le minuteur à zéro
      })
    );
    go(idx); // affiche la photo actuelle
  }

  // Règle « À la une » et ordre de priorité : définis dans utils.js (partagés avec les listes)
  const estALaUne = U.estALaUne;
  const ordreVitrine = U.ordreVitrine;

  // Remplit la vitrine (appelée par annonces.js avec les annonces disponibles)
  async function addListings(list) {
    const track = U.qs("#slides"); // la bande des photos
    if (!track) return; // pas de vitrine sur cette page
    // Candidates : annonces avec une photo valide, dans l'ordre de priorité.
    // On en teste au plus 15, pour ne pas télécharger trop de photos sur un petit forfait.
    const candidates = ordreVitrine(list)
      .filter((a) => U.safeUrl(a.image))
      .slice(0, 15);
    // On mesure la largeur réelle de chaque photo (en parallèle), puis on garde les nettes
    const largeurs = await Promise.all(candidates.map((a) => U.largeurImage(U.safeUrl(a.image))));
    const retenues = candidates.filter((_, k) => largeurs[k] >= LARGEUR_MIN).slice(0, MAX);

    const box = U.qs("#hero-box");
    U.qs("#vitrine").classList.remove("chargement"); // fin du gris animé
    if (!retenues.length) {
      box.classList.add("sans-photo"); // aucune bonne photo : bannière fixe de secours
      return;
    }
    // Toutes les valeurs venant de la base passent par escapeHtml (sécurité)
    const E = U.escapeHtml;
    track.innerHTML = retenues
      .map(
        (a, k) =>
          `<a class="slide photo" href="maison-detail.html?id=${encodeURIComponent(a.id)}" aria-label="${E(a.titre)}, ${E(a.commune)}, ${E(U.money(a.loyer))} par mois">
            <img src="${E(U.safeUrl(a.image))}" alt="" ${k ? 'loading="lazy"' : ""}>
            ${estALaUne(a) ? `<span class="une-badge">${U.icon("star")} À la une</span>` : ""}
            <span class="tag"><small>${E(a.commune)}${a.quartier ? " · " + E(a.quartier) : ""}</small><strong>${E(a.titre)}</strong><b>${U.money(a.loyer)} / mois</b></span>
          </a>`
      )
      .join("");
    box.classList.toggle("une-seule", retenues.length === 1); // 1 photo : pas de flèches ni de points
    buildDots();
    restart();
  }

  // Quand la page est prête…
  document.addEventListener("DOMContentLoaded", () => {
    const root = U.qs("#banner"); // la vitrine
    if (!root) return; // pas sur cette page
    setArret(arrete); // état initial du bouton pause
    // Flèches précédent / suivant
    U.qs("#banner-prev").addEventListener("click", () => {
      go(idx - 1);
      restart();
    });
    U.qs("#banner-next").addEventListener("click", () => {
      go(idx + 1);
      restart();
    });
    // Bouton pause / lecture
    U.qs("#banner-pause").addEventListener("click", () => setArret(!arrete));
    // Pause TEMPORAIRE quand la souris ou le clavier est sur la vitrine (le temps de lire)
    ["mouseenter", "focusin"].forEach((e) => root.addEventListener(e, () => (survol = true)));
    ["mouseleave", "focusout"].forEach((e) => root.addEventListener(e, () => (survol = false)));
    // Toucher au doigt : le défilement S'ARRÊTE (sinon la photo change sous le pouce et on
    // ouvre la mauvaise annonce). Il reprend avec le bouton ▶. On note aussi où le doigt se pose…
    let x0 = null; // position horizontale de départ
    root.addEventListener(
      "touchstart",
      (e) => {
        x0 = e.touches[0].clientX;
        if (!arrete) setArret(true);
      },
      { passive: true } // « passif » : n'empêche pas le défilement de la page (plus fluide)
    );
    // …et où il se lève : plus de 40 pixels d'écart = un glissement
    root.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; // distance parcourue (négative = vers la gauche)
      if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); // gauche → suivante ; droite → précédente
      x0 = null; // réinitialise
    });
  });

  // Rend addListings accessible à annonces.js
  window.ImmoCarousel = { addListings };
})(); // fin de l'IIFE
