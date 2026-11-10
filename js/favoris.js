/* ═══════════════════════════════════════════════════════════════════
   favoris.js : page « Mes favoris » (favoris.html)

   Les identifiants des annonces favorites sont gardés dans le navigateur
   (ImmoUtils.Favoris). On va chercher ces annonces dans la base, puis on
   réutilise exactement la même carte que le catalogue (ImmoCards.card).
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  const U = window.ImmoUtils; // boîte à outils
  const S = window.ImmoStorage; // accès à la base
  const host = U.qs("#fav-listings"); // zone des cartes
  const empty = U.qs("#fav-empty"); // message « aucun favori »
  let annonces = []; // annonces favorites chargées depuis la base

  // Format d'un identifiant d'annonce (UUID : 8-4-4-4-12 caractères hexadécimaux).
  // SÉCURITÉ : localStorage peut être modifié par le visiteur ; on ignore tout ce qui
  // n'a pas la bonne forme avant de l'envoyer à la base.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const idsValides = () => U.Favoris.list().filter((id) => UUID.test(id));

  // Affiche les cartes, dans l'ordre des favoris (le plus récent en premier)
  function render() {
    const list = idsValides()
      .map((id) => annonces.find((a) => String(a.id) === id)) // retrouve chaque annonce
      .filter(Boolean); // retire les favoris introuvables
    host.innerHTML = list.map(window.ImmoCards.card).join(""); // une carte par annonce
    empty.classList.toggle("hidden", list.length > 0); // message si la liste est vide
  }

  const ids = idsValides(); // favoris enregistrés
  if (!ids.length) {
    empty.classList.remove("hidden"); // aucun favori : message
    return;
  }
  host.innerHTML = window.ImmoCards.skeleton(Math.min(ids.length, 6)); // squelettes pendant le chargement
  try {
    annonces = await S.getAnnoncesParIds(ids); // chargement depuis la base
  } catch (e) {
    host.innerHTML = `<div class="notice error">${U.escapeHtml(e.message)}</div>`;
    return;
  }
  // Favoris qui ne sont plus en ligne (loués, supprimés, en revalidation)
  const disparues = ids.length - annonces.length;
  if (disparues > 0) {
    const p = U.qs("#fav-removed");
    p.textContent = `${disparues} annonce(s) de vos favoris ne sont plus en ligne.`;
    p.classList.remove("hidden");
  }
  render(); // premier affichage
  // Retirer un favori sur cette page (clic sur le cœur) le fait disparaître de la liste
  document.addEventListener("favoris:change", render);
});
