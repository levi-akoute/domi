/* Authentification Supabase. Le numéro de téléphone sert d'identifiant : il est converti en email interne (0700000000@immoci.app). */
(function () {
  const C = window.IMMOCI_CONFIG || {},
    S = () => window.ImmoStorage.client();
  const normalize = (p) => {
    let d = String(p || "").replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("225")) d = d.slice(3);
    if (!/^\d{10}$/.test(d))
      throw new Error("Numéro invalide : saisissez 10 chiffres (ex. 0700000000).");
    return d;
  };
  const email = (p) => normalize(p) + "@" + (C.EMAIL_DOMAIN || "immoci.app");
  let cached;
  async function currentUser(force) {
    if (cached !== undefined && !force) return cached;
    try {
      if (!window.ImmoStorage.isConfigured()) return (cached = null);
      const {
        data: { session },
      } = await S().auth.getSession();
      if (!session) return (cached = null);
      const { data } = await S()
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      return (cached = data || null);
    } catch (e) {
      return (cached = null);
    }
  }
  async function login(phone, password) {
    const { error } = await S().auth.signInWithPassword({ email: email(phone), password });
    if (error) {
      const m = window.ImmoStorage.fixMsg(error.message);
      throw new Error(m !== error.message ? m : "Numéro ou mot de passe incorrect.");
    }
    return currentUser(true);
  }
  async function register(d) {
    const tel = normalize(d.telephone);
    const { data, error } = await S().auth.signUp({
      email: email(tel),
      password: d.password,
      options: {
        data: { nom: d.nom, prenom: d.prenom, telephone: tel, commune: d.commune, role: d.role },
      },
    });
    if (error)
      throw new Error(
        /registered|exists/i.test(error.message)
          ? "Ce numéro est déjà associé à un compte."
          : window.ImmoStorage.fixMsg(error.message)
      );
    if (!data.session)
      throw new Error(
        "Compte créé, mais Supabase exige une confirmation par email : désactivez « Confirm email » (voir le guide) puis connectez-vous."
      );
    return currentUser(true);
  }
  async function logout() {
    try {
      await S().auth.signOut();
    } catch (e) {}
    cached = null;
  }
  async function requireUser() {
    const u = await currentUser();
    if (!u) {
      location.href = "connexion.html";
      return null;
    }
    return u;
  }
  async function requireAdmin() {
    const u = await currentUser();
    if (!u || u.role !== "admin") {
      const main = document.querySelector("main");
      if (main)
        main.innerHTML =
          '<section class="container access-denied"><h1>Accès réservé</h1><p>Cette page est réservée aux administrateurs Domi.</p><a class="btn btn-primary" href="connexion.html">Se connecter</a></section>';
      return null;
    }
    return u;
  }
  async function changePassword(pw) {
    const { error } = await S().auth.updateUser({ password: pw });
    if (error) throw new Error(error.message);
  }
  window.ImmoAuth = {
    currentUser,
    login,
    register,
    logout,
    requireUser,
    requireAdmin,
    changePassword,
    normalize,
  };
})();
