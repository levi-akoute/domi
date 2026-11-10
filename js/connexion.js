/* ═══════════════════════════════════════════════════════════════════
   connexion.js : page de connexion et d'inscription (connexion.html)

   La page contient deux formulaires (connexion / inscription) et deux
   onglets pour passer de l'un à l'autre. connexion.html?inscription=1
   ouvre directement l'onglet « Inscription ».
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  const U = window.ImmoUtils; // boîte à outils
  const tabs = [...document.querySelectorAll("[data-tab]")]; // les deux boutons d'onglet
  const login = U.qs("#login-form"); // formulaire de connexion
  const register = U.qs("#register-form"); // formulaire d'inscription
  const msg = U.qs("#auth-message"); // zone des messages d'erreur

  U.fillCommunes(register.elements.commune); // liste des communes (inscription)

  // Affiche l'onglet n ("login" ou "register") et cache l'autre
  function tab(n) {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === n)); // onglet actif en blanc
    login.classList.toggle("hidden", n !== "login"); // montre / cache la connexion
    register.classList.toggle("hidden", n !== "register"); // montre / cache l'inscription
    U.qs("#auth-title").textContent =
      n === "login" ? "Bienvenue sur Domi" : "Créez votre espace annonceur"; // titre adapté
    msg.classList.add("hidden"); // efface l'ancien message
  }
  tabs.forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab))); // clic sur un onglet
  if (U.getParam("inscription")) tab("register"); // ?inscription=1 → onglet inscription

  // Déjà connecté ? Inutile de rester ici : direction l'espace adapté
  const u0 = await ImmoAuth.currentUser();
  if (u0) {
    location.href = u0.role === "admin" ? "admin.html" : "dashboard-proprietaire.html";
    return;
  }

  // Désactive (on = true) ou réactive les boutons d'un formulaire pendant l'envoi
  const busy = (f, on) => f.querySelectorAll("button").forEach((b) => (b.disabled = on));

  // CONNEXION
  login.addEventListener("submit", async (e) => {
    e.preventDefault(); // pas de rechargement de page
    const d = new FormData(login); // lit les champs
    busy(login, true);
    try {
      const u = await ImmoAuth.login(d.get("telephone"), d.get("password")); // vérifie auprès de Supabase
      location.href = u && u.role === "admin" ? "admin.html" : "dashboard-proprietaire.html"; // redirection
    } catch (err) {
      U.showMessage(msg, err.message, "error"); // « Numéro ou mot de passe incorrect »
      busy(login, false);
    }
  });

  // INSCRIPTION
  register.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(register);
    busy(register, true);
    try {
      await ImmoAuth.register({
        nom: d.get("nom").trim(), // trim : espaces inutiles retirés
        prenom: d.get("prenom").trim(),
        telephone: d.get("telephone"),
        role: d.get("role"), // propriétaire ou agent
        commune: d.get("commune"),
        email: (d.get("email") || "").trim().toLowerCase(), // email de récupération (facultatif)
        password: d.get("password"),
      });
      location.href = "dashboard-proprietaire.html"; // compte créé et connecté
    } catch (err) {
      U.showMessage(msg, err.message, "error");
      busy(register, false);
    }
  });
});
