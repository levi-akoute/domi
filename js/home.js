/* ═══════════════════════════════════════════════════════════════════
   home.js : le carrousel (bannière défilante) de la page d'accueil

   Fonctionnement : toutes les bannières sont alignées côte à côte dans
   #slides. Pour montrer la bannière n°2, on décale #slides de 200 %
   vers la gauche (translateX(-200%)). Le CSS anime ce décalage.

   Fonctions : défilement automatique (5 s), points de navigation, flèches,
   glissement au doigt, pause au survol, et ajout de 3 annonces en photo.
   Expose : window.ImmoCarousel (utilisé par annonces.js)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const U = window.ImmoUtils; // boîte à outils
  // Le visiteur a-t-il demandé « moins d'animations » dans son téléphone ? (accessibilité)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let idx = 0; // numéro de la bannière affichée (0 = la première)
  let timer = null; // minuteur du défilement automatique
  let paused = false; // vrai quand la souris est sur la bannière

  // Toutes les bannières présentes (fonction : la liste peut grandir avec addListings)
  const slides = () => document.querySelectorAll("#slides .slide");

  // Affiche la bannière n°i
  function go(i) {
    const n = slides().length; // nombre de bannières
    if (!n) return; // aucune : rien à faire
    idx = (i + n) % n; // % (modulo) : après la dernière on revient à la première, et inversement
    U.qs("#slides").style.transform = `translateX(-${idx * 100}%)`; // décale la bande
    // Met à jour les points : le point actif est « on »
    document.querySelectorAll("#banner-dots button").forEach((d, k) => {
      d.classList.toggle("on", k === idx);
      d.setAttribute("aria-current", String(k === idx)); // pour les lecteurs d'écran
    });
    // Les bannières cachées sont ignorées par les lecteurs d'écran
    slides().forEach((s, k) => s.setAttribute("aria-hidden", String(k !== idx)));
  }

  // (Re)lance le défilement automatique toutes les 5 secondes
  function restart() {
    clearInterval(timer); // arrête l'ancien minuteur
    if (!reduce)
      // pas d'animation automatique si le visiteur l'a demandé
      timer = setInterval(() => {
        if (!paused) go(idx + 1); // bannière suivante, sauf si en pause
      }, 5000);
  }

  // Crée un point (bouton) par bannière
  function buildDots() {
    U.qs("#banner-dots").innerHTML = Array.from(
      { length: slides().length }, // autant de points que de bannières
      (_, k) => `<button type="button" aria-label="Aller à la bannière ${k + 1}"></button>`
    ).join("");
    // Clic sur un point → affiche la bannière correspondante
    document.querySelectorAll("#banner-dots button").forEach((b, k) =>
      b.addEventListener("click", () => {
        go(k);
        restart(); // remet le minuteur à zéro
      })
    );
    go(idx); // affiche la bannière actuelle
  }

  // Ajoute jusqu'à 3 annonces avec photo comme bannières (appelée par annonces.js)
  function addListings(list) {
    const track = U.qs("#slides"); // la bande des bannières
    if (!track) return; // pas de carrousel sur cette page
    list
      .filter((a) => U.safeUrl(a.image)) // seulement les annonces avec une photo valide
      .slice(0, 3) // 3 au maximum
      .forEach((a) =>
        track.insertAdjacentHTML(
          "beforeend", // ajoutée à la fin de la bande
          // Toutes les valeurs venant de la base passent par escapeHtml (sécurité)
          `<a class="slide photo" href="maison-detail.html?id=${encodeURIComponent(a.id)}"><img src="${U.escapeHtml(U.safeUrl(a.image))}" alt="${U.escapeHtml(a.titre)}" loading="lazy"><span class="tag"><small>${U.escapeHtml(a.commune)}${a.quartier ? " · " + U.escapeHtml(a.quartier) : ""}</small><strong>${U.escapeHtml(a.titre)}</strong><b>${U.money(a.loyer)} / mois</b></span></a>`
        )
      );
    buildDots(); // recrée les points (il y a plus de bannières)
  }

  // Quand la page est prête…
  document.addEventListener("DOMContentLoaded", () => {
    const root = U.qs("#banner"); // le bloc carrousel
    if (!root) return; // pas sur cette page
    buildDots(); // points
    restart(); // défilement automatique
    // Flèches précédent / suivant
    U.qs("#banner-prev").addEventListener("click", () => {
      go(idx - 1);
      restart();
    });
    U.qs("#banner-next").addEventListener("click", () => {
      go(idx + 1);
      restart();
    });
    // Pause quand la souris ou le clavier est sur la bannière (le temps de lire)
    ["mouseenter", "focusin"].forEach((e) =>
      root.addEventListener(e, () => {
        paused = true;
      })
    );
    ["mouseleave", "focusout"].forEach((e) =>
      root.addEventListener(e, () => {
        paused = false;
      })
    );
    // Glissement au doigt : on note où le doigt se pose…
    let x0 = null; // position horizontale de départ
    root.addEventListener(
      "touchstart",
      (e) => {
        x0 = e.touches[0].clientX;
      },
      { passive: true } // « passif » : n'empêche pas le défilement de la page (plus fluide)
    );
    // …et où il se lève : plus de 40 pixels d'écart = un glissement
    root.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; // distance parcourue (négative = vers la gauche)
      if (Math.abs(dx) > 40) {
        go(idx + (dx < 0 ? 1 : -1)); // vers la gauche → suivante ; vers la droite → précédente
        restart();
      }
      x0 = null; // réinitialise
    });
  });

  // Rend addListings accessible à annonces.js
  window.ImmoCarousel = { addListings };
})(); // fin de l'IIFE
