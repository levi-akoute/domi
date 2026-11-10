/* ═══════════════════════════════════════════════════════════════════
   auth.js : comptes utilisateurs (inscription, connexion, déconnexion)

   Particularité de Domi : on se connecte avec son NUMÉRO DE TÉLÉPHONE.
   Supabase exige un email : le numéro est donc transformé en un email
   interne qui n'existe pas vraiment, par exemple 0700000000@immoci.app.
   (Voilà pourquoi la récupération du mot de passe utilise un AUTRE email,
   l'« email de récupération », qui lui est réel.)

   Chargé APRÈS storage.js (il utilise son client Supabase).
   Expose : window.ImmoAuth
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const C = window.IMMOCI_CONFIG || {}; // réglages (config.js)
  const S = () => window.ImmoStorage.client(); // raccourci vers le client Supabase

  // Vérifie et nettoie un numéro : garde les chiffres, retire l'indicatif 225, exige 10 chiffres.
  // Exemple : "+225 07 00 00 00 00" → "0700000000"
  const normalize = (p) => {
    let d = String(p || "").replace(/\D/g, ""); // \D = tout ce qui n'est pas un chiffre → supprimé
    if (d.length === 13 && d.startsWith("225")) d = d.slice(3); // retire l'indicatif du pays
    if (!/^\d{10}$/.test(d))
      // exactement 10 chiffres ?
      throw new Error("Numéro invalide : saisissez 10 chiffres (ex. 0700000000).");
    return d;
  };

  // Fabrique l'email interne : "0700000000@immoci.app"
  const email = (p) => normalize(p) + "@" + (C.EMAIL_DOMAIN || "immoci.app");

  // Mémoire de l'utilisateur courant, pour ne pas interroger la base à chaque appel.
  // undefined = pas encore cherché ; null = visiteur non connecté ; objet = profil.
  let cached;
  // Recherche en cours (si deux parties de la page demandent l'utilisateur en même
  // temps, elles attendent la MÊME recherche au lieu d'en lancer deux).
  let enCours = null;

  // Renvoie le profil de l'utilisateur connecté, ou null. force = true : ignore la mémoire.
  async function currentUser(force) {
    if (cached !== undefined && !force) return cached; // déjà connu
    if (enCours && !force) return enCours; // recherche déjà lancée : on l'attend
    enCours = (async () => {
      try {
        if (!window.ImmoStorage.isConfigured()) return (cached = null); // pas de base : visiteur
        // getSession lit la session gardée par Supabase dans le navigateur
        const {
          data: { session },
        } = await S().auth.getSession();
        if (!session) return (cached = null); // pas de session : visiteur
        // Profil complet (nom, rôle, badge…) dans la table profiles
        const { data } = await S()
          .from("profiles")
          .select("*")
          .eq("id", session.user.id) // le profil qui porte le même identifiant que le compte
          .maybeSingle();
        return (cached = data || null); // on mémorise
      } catch (e) {
        return (cached = null); // erreur réseau : visiteur
      } finally {
        enCours = null; // recherche terminée
      }
    })();
    return enCours;
  }

  // Connexion avec numéro + mot de passe
  async function login(phone, password) {
    const { error } = await S().auth.signInWithPassword({ email: email(phone), password });
    if (error) {
      const m = window.ImmoStorage.fixMsg(error.message); // erreur réseau traduite ?
      // Message volontairement vague : on ne dit pas si c'est le numéro OU le mot de passe
      // qui est faux (sinon on aiderait quelqu'un à deviner quels numéros sont inscrits).
      throw new Error(m !== error.message ? m : "Numéro ou mot de passe incorrect.");
    }
    return currentUser(true); // recharge le profil
  }

  // Inscription. d = { nom, prenom, telephone, commune, role, email, password }
  async function register(d) {
    const tel = normalize(d.telephone); // numéro vérifié
    if (String(d.password || "").length < 8)
      // 8 caractères minimum
      throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    const { data, error } = await S().auth.signUp({
      email: email(tel), // email interne
      password: d.password,
      options: {
        // Ces infos sont lues par le trigger SQL handle_new_user (database/07) pour créer le profil.
        // Le rôle « admin » est refusé par ce trigger, même si quelqu'un le force ici.
        data: {
          nom: d.nom,
          prenom: d.prenom,
          telephone: tel,
          commune: d.commune,
          role: d.role, // « proprietaire » ou « agent »
          email_recuperation: d.email || null, // facultatif
        },
      },
    });
    if (error)
      throw new Error(
        /registered|exists/i.test(error.message) // numéro déjà utilisé ?
          ? "Ce numéro est déjà associé à un compte."
          : window.ImmoStorage.fixMsg(error.message)
      );
    if (!data.session)
      // Supabase attend une confirmation par email (réglage à désactiver)
      throw new Error(
        "Compte créé, mais Supabase exige une confirmation par email : désactivez « Confirm email » (voir le guide) puis connectez-vous."
      );
    return currentUser(true); // profil du nouveau compte
  }

  // Déconnexion : supprime la session du navigateur
  async function logout() {
    try {
      await S().auth.signOut();
    } catch (e) {} // même en cas d'erreur, on oublie l'utilisateur
    cached = null;
  }

  // Pour les pages réservées aux comptes : renvoie l'utilisateur, ou redirige vers la connexion
  async function requireUser() {
    const u = await currentUser();
    if (!u) {
      location.href = "connexion.html"; // pas connecté → page de connexion
      return null;
    }
    return u;
  }

  // Pour la page d'administration : renvoie l'admin, ou affiche « Accès réservé ».
  // (Ce n'est qu'un AFFICHAGE : même en contournant ceci, la base ne renverrait aucune
  // donnée réservée, grâce aux règles RLS.)
  async function requireAdmin() {
    const u = await currentUser();
    if (!u || u.role !== "admin") {
      const main = document.querySelector("main"); // contenu principal de la page
      if (main)
        main.innerHTML =
          '<section class="container access-denied"><h1>Accès réservé</h1><p>Cette page est réservée aux administrateurs Domi.</p><a class="btn btn-primary" href="connexion.html">Se connecter</a></section>';
      return null;
    }
    return u;
  }

  // Changer son mot de passe (utilisateur connecté)
  async function changePassword(pw) {
    const { error } = await S().auth.updateUser({ password: pw });
    if (error) throw new Error(error.message);
  }

  // Ce que les autres fichiers peuvent utiliser :
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
})(); // fin de l'IIFE
