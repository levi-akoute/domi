/* ═══════════════════════════════════════════════════════════════════
   favoris.js : page « Mes favoris » (favoris.html)

   Les identifiants des annonces favorites sont dans le navigateur
   (ImmoUtils.Favoris). On va chercher ces annonces dans la base, puis
   on réutilise la même carte que le catalogue (ImmoCards.card).
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  const U = window.ImmoUtils;
  const S = window.ImmoStorage;
  const host = U.qs("#fav-listings");
  const empty = U.qs("#fav-empty");
  let annonces = [];

  function render() {
    const ids = U.Favoris.list();
    // On garde l'ordre des favoris (le plus récent en premier)
    const list = ids.map((id) => annonces.find((a) => String(a.id) === id)).filter(Boolean);
    host.innerHTML = list.map(window.ImmoCards.card).join("");
    empty.classList.toggle("hidden", list.length > 0);
  }

  const ids = U.Favoris.list();
  if (!ids.length) {
    empty.classList.remove("hidden");
    return;
  }
  host.innerHTML = window.ImmoCards.skeleton(Math.min(ids.length, 6));
  try {
    annonces = await S.getAnnoncesParIds(ids);
  } catch (e) {
    host.innerHTML = `<div class="notice error">${U.escapeHtml(e.message)}</div>`;
    return;
  }
  // Annonces favorites qui ne sont plus publiées (louées, supprimées, en revalidation)
  const disparues = ids.length - annonces.length;
  if (disparues > 0) {
    const p = U.qs("#fav-removed");
    p.textContent = `${disparues} annonce(s) de vos favoris ne sont plus en ligne.`;
    p.classList.remove("hidden");
  }
  render();
  // Retirer un favori sur cette page le fait disparaître de la liste
  document.addEventListener("favoris:change", render);
});
