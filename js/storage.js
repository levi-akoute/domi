/* ═══════════════════════════════════════════════════════════════════
   storage.js : la couche de données. TOUTES les requêtes vers Supabase
   passent par ici. Les pages ne parlent jamais directement à la base.

   Avantage : si un jour on change de base de données, seul ce fichier
   est à réécrire (principe de « séparation des responsabilités »).

   Chargé APRÈS config.js et utils.js. Expose : window.ImmoStorage
   Toutes les fonctions sont asynchrones (async) : on les appelle avec await.

   Rappel sécurité : ce fichier tourne dans le navigateur du visiteur, qui
   peut le modifier. La vraie protection, ce sont les règles RLS écrites
   dans database/*.sql. Les filtres ici servent seulement à l'affichage.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  // Réglages de config.js
  const C = window.IMMOCI_CONFIG || {};

  // Adresse du projet Supabase, nettoyée : espaces retirés (trim) et « / » final retiré
  const url = String(C.SUPABASE_URL || "")
    .trim() // enlève les espaces au début et à la fin
    .replace(/\/+$/, ""); // enlève le ou les « / » à la fin
  // Clé publique « anon »
  const key = String(C.SUPABASE_ANON_KEY || "").trim();

  // Le site est « configuré » si :
  const configured = !!(
    (
      window.supabase && // la librairie Supabase est bien chargée (balise <script> du CDN)
      url && // une adresse est renseignée
      key && // une clé est renseignée
      !/COLLE_ICI/.test(url + key) && // ce ne sont pas les valeurs d'exemple
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    ) // l'adresse a la bonne forme
  ); // !!( … ) transforme le résultat en vrai/faux

  // sb = le « client » Supabase : l'objet qui envoie toutes les requêtes. null si non configuré.
  const sb = configured ? window.supabase.createClient(url, key) : null;

  /* ───────── Gestion des erreurs ───────── */

  // Message clair quand Internet ou l'adresse de la base ne répond pas
  const NET =
    "Impossible de joindre la base de données. Vérifiez votre connexion Internet et l’URL dans js/config.js (elle doit ressembler à https://xxxx.supabase.co).";
  // Remplace les messages techniques du navigateur (« Failed to fetch »…) par le message clair
  const fixMsg = (m) => (/failed to fetch|networkerror|load failed/i.test(m || "") ? NET : m);

  // Renvoie le client Supabase, ou lève une erreur explicite si le site n'est pas configuré
  const client = () => {
    if (!sb)
      throw new Error(
        "Base de données non configurée : renseignez js/config.js (voir docs/GUIDE_MISE_EN_LIGNE.md)."
      );
    return sb;
  };

  // Exécute une requête Supabase : renvoie les données, ou lève une erreur lisible.
  // Supabase répond toujours { data, error } : on transforme « error » en vraie erreur JavaScript.
  const ok = async (q) => {
    const { data, error } = await q; // attend la réponse de la base
    if (error) throw new Error(fixMsg(error.message)); // problème → erreur (attrapée par la page)
    return data; // succès → les données
  };

  // Raccourci : la table des annonces (listings)
  const L = () => client().from("listings");

  // Date limite de fraîcheur : une annonce confirmée AVANT cette date est masquée du public
  const limiteFraicheur = () => {
    const jours = window.ImmoUtils?.JOURS_MASQUAGE || 45; // réglage de utils.js (45 jours)
    return new Date(Date.now() - jours * 86400000).toISOString(); // date au format standard ISO
  };

  /* ───────── Public (visiteurs) ───────── */

  // Toutes les annonces publiées et fraîches.
  // SQL équivalent : SELECT * FROM listings WHERE moderation='approuvee'
  //   AND confirmee_le >= <il y a 45 jours> ORDER BY created_at DESC LIMIT 500
  const getAnnonces = () =>
    ok(
      L()
        .select("*") // toutes les colonnes
        .eq("moderation", "approuvee") // eq = « égal à » : seulement les annonces validées
        .gte("confirmee_le", limiteFraicheur()) // gte = « supérieur ou égal » : confirmées récemment
        .order("created_at", { ascending: false }) // les plus récentes d'abord
        .limit(500) // 500 au maximum
    );

  // Une seule annonce par son identifiant (maybeSingle : null si elle n'existe pas)
  const getAnnonce = (id) => ok(L().select("*").eq("id", id).maybeSingle());

  // Plusieurs annonces à partir d'une liste d'identifiants (page Favoris)
  const getAnnoncesParIds = (ids) =>
    ids.length
      ? ok(L().select("*").in("id", ids).eq("moderation", "approuvee")) // in = « fait partie de la liste »
      : []; // liste vide : pas de requête inutile

  // Compteurs : on appelle des fonctions SQL (rpc = « remote procedure call »).
  // Les erreurs sont ignorées volontairement : un compteur raté ne doit rien bloquer.
  const vue = (id) =>
    client()
      .rpc("increment_view", { p_id: id }) // fonction SQL qui ajoute 1 vue
      .then(
        () => {}, // succès : rien à faire
        () => {} // échec : on ignore
      );
  const clicWhatsapp = (id) =>
    client()
      .rpc("increment_whatsapp", { p_id: id }) // fonction SQL qui ajoute 1 clic WhatsApp
      .then(
        () => {},
        () => {}
      );

  // Enregistre un signalement (la base limite le nombre : database/09)
  const signaler = (r) => ok(client().from("reports").insert(r));

  /* ───────── Annonceur (propriétaire ou agent connecté) ───────── */

  // Les annonces du propriétaire uid (toutes, même en attente : la règle RLS le permet pour SES annonces)
  const getMesAnnonces = (uid) =>
    ok(L().select("*").eq("owner_id", uid).order("created_at", { ascending: false }));
  // Crée une annonce et renvoie la ligne créée (.select().single())
  const ajouterAnnonce = (d) => ok(L().insert(d).select().single());
  // Modifie l'annonce id avec les champs p
  const updateAnnonce = (id, p) => ok(L().update(p).eq("id", id).select().single());
  // Supprime l'annonce id (la base refuse si ce n'est pas la sienne)
  const supprimerAnnonce = (id) => ok(L().delete().eq("id", id));
  // Dernière demande de vérification d'identité de l'utilisateur
  const maVerification = (uid) =>
    ok(
      client()
        .from("verification_requests") // table des demandes de badge
        .select("*")
        .eq("user_id", uid) // celles de cet utilisateur
        .order("created_at", { ascending: false }) // la plus récente d'abord
        .limit(1) // une seule
    );
  // Modifier son propre profil (ex. email de récupération). La base empêche de
  // changer son rôle, son badge ou son numéro (trigger protect_profile, database/09).
  const updateMonProfil = (uid, patch) =>
    ok(client().from("profiles").update(patch).eq("id", uid).select().single());

  /* ───────── Administration ─────────
     Ces requêtes ne renvoient des données QUE si l'utilisateur est admin :
     les règles RLS utilisent la fonction SQL is_admin(). */

  // Toutes les annonces + le profil de leur auteur (jointure via owner_id)
  const adminAnnonces = () =>
    ok(
      L()
        .select("*, profiles!owner_id(nom,prenom,telephone,verifie)") // ajoute 4 colonnes du profil
        .order("created_at", { ascending: false })
        .limit(300)
    );
  // Tous les profils utilisateurs
  const adminUsers = () =>
    ok(client().from("profiles").select("*").order("created_at", { ascending: false }));
  // Tous les signalements + le titre de l'annonce concernée
  const adminReports = () =>
    ok(
      client()
        .from("reports")
        .select("*, listings(id,titre)")
        .order("created_at", { ascending: false })
        .limit(200)
    );
  // Change le statut d'un signalement (traité, rejeté…)
  const updateReport = (id, status) => ok(client().from("reports").update({ status }).eq("id", id));
  // Toutes les demandes de vérification + le nom du demandeur
  const getVerifications = () =>
    ok(
      client()
        .from("verification_requests")
        .select("*, profiles(nom,prenom,telephone)")
        .order("created_at", { ascending: false })
    );
  // Accepte ou refuse une demande (fonction SQL qui vérifie elle-même que l'appelant est admin)
  const decideVerification = (id, approve, note) =>
    ok(client().rpc("decide_verification", { p_id: id, p_approve: approve, p_note: note || null }));
  // Pièce d'identité : bucket PRIVÉ, on crée un lien temporaire valable 5 minutes (300 s)
  const lienDocument = async (path) => {
    const { data, error } = await client().storage.from("verifications").createSignedUrl(path, 300);
    if (error) throw new Error(fixMsg(error.message));
    return data.signedUrl; // le lien signé (inutilisable après 5 minutes)
  };

  /* ───────── Avis ───────── */

  // Avis publiés d'une annonce (30 plus récents)
  const getAvis = (id) =>
    ok(
      client()
        .from("reviews")
        .select("*")
        .eq("listing_id", id) // de cette annonce
        .eq("status", "approuve") // publiés seulement
        .order("created_at", { ascending: false })
        .limit(30)
    );
  // L'avis de l'utilisateur uid sur l'annonce id (ou null)
  const monAvis = async (id, uid) => {
    const r = await ok(
      client().from("reviews").select("*").eq("listing_id", id).eq("author_id", uid).limit(1)
    );
    return (r && r[0]) || null; // premier résultat, ou null
  };
  // Ajoute un avis (toujours « en attente » : la base l'impose)
  const ajouterAvis = (r) => ok(client().from("reviews").insert(r));
  // Tous les avis (admin)
  const adminAvis = () =>
    ok(
      client()
        .from("reviews")
        .select("*, listings(id,titre)")
        .order("created_at", { ascending: false })
        .limit(200)
    );
  // Publier ou refuser un avis (admin)
  const updateAvis = (id, status) => ok(client().from("reviews").update({ status }).eq("id", id));
  // Supprimer un avis (admin ou auteur)
  const supprimerAvis = (id) => ok(client().from("reviews").delete().eq("id", id));

  /* ───────── Mot de passe oublié (Edge Function) ─────────
     Changer le mot de passe de quelqu'un qui n'est pas connecté exige la clé service_role.
     Elle ne doit JAMAIS être dans le site : c'est la fonction serveur
     « reinitialiser-mot-de-passe » (dossier supabase/functions/) qui s'en charge. */
  async function appelReset(body) {
    let res; // réponse de la fonction
    try {
      res = await client().functions.invoke("reinitialiser-mot-de-passe", { body }); // appel HTTPS
    } catch (e) {
      res = { error: e }; // erreur réseau
    }
    if (res.error || !res.data)
      // fonction absente, en panne ou injoignable
      throw new Error(
        "Le service de récupération est momentanément indisponible. Contactez le support sur WhatsApp."
      );
    if (!res.data.ok) throw new Error(res.data.message || "Une erreur est survenue."); // refus expliqué
    return res.data; // succès : { ok: true, message }
  }
  // Étape 1 : demander un code
  const demanderCodeReset = (telephone) => appelReset({ action: "demander", telephone });
  // Étape 2 : valider le code et changer le mot de passe
  const validerCodeReset = (telephone, code, password) =>
    appelReset({ action: "valider", telephone, code, password });

  /* ───────── Fichiers ───────── */

  // Compresse une photo DANS le navigateur avant l'envoi (WebP, 1280 px max) :
  // pages plus rapides, forfait mobile et stockage Supabase préservés.
  async function compress(file, max = 1280) {
    const bmp = await createImageBitmap(file); // décode l'image
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height)); // rapport de réduction (jamais d'agrandissement)
    const c = document.createElement("canvas"); // « toile » invisible pour redessiner l'image
    c.width = Math.round(bmp.width * r); // nouvelle largeur
    c.height = Math.round(bmp.height * r); // nouvelle hauteur
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); // dessine l'image réduite
    // toBlob : transforme la toile en fichier (t = type, q = qualité de 0 à 1)
    const toBlob = (t, q) => new Promise((res) => c.toBlob(res, t, q));
    const w = await toBlob("image/webp", 0.8); // essai en WebP (format léger), qualité 80 %
    // Certains vieux navigateurs ne savent pas produire du WebP : repli en JPEG
    return w && w.type === "image/webp"
      ? { blob: w, ext: "webp" }
      : { blob: await toBlob("image/jpeg", 0.82), ext: "jpg" };
  }

  // Envoie jusqu'à 6 photos et renvoie leurs adresses publiques.
  // Chaque utilisateur range ses photos dans un dossier à son identifiant :
  // la règle de stockage « annonces_insert_own » refuse tout autre dossier.
  async function uploadPhotos(files, uid) {
    const urls = []; // adresses des photos envoyées
    for (const f of [...files].slice(0, 6)) {
      // 6 photos maximum
      if (!f.type.startsWith("image/")) continue; // ignore ce qui n'est pas une image
      const { blob, ext } = await compress(f); // compresse
      // Nom unique : dossier de l'utilisateur / date en millisecondes - 6 caractères aléatoires . extension
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await client()
        .storage.from("annonces") // bucket public des photos
        .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" }); // cache 1 an
      if (error) throw new Error(fixMsg(error.message));
      urls.push(client().storage.from("annonces").getPublicUrl(path).data.publicUrl); // adresse publique
    }
    return urls;
  }

  // Envoie une pièce d'identité (bucket PRIVÉ) et crée la demande de vérification
  async function soumettreVerification(file, type, uid) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop lourd (5 Mo maximum)."); // 5 Mo
    // Extension du fichier, nettoyée (lettres et chiffres uniquement)
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${uid}/${Date.now()}.${ext}`; // rangé dans le dossier de l'utilisateur
    const up = await client()
      .storage.from("verifications") // bucket privé
      .upload(path, file, { contentType: file.type });
    if (up.error) throw new Error(fixMsg(up.error.message));
    return ok(
      client()
        .from("verification_requests") // enregistre la demande
        .insert({ user_id: uid, document_type: type, document_path: path })
    );
  }

  // Ce que les autres fichiers peuvent utiliser :
  window.ImmoStorage = {
    fixMsg, // traduction des erreurs réseau
    isConfigured: () => configured, // le site est-il branché à une base ?
    client, // accès direct au client Supabase (utilisé par auth.js)
    getAnnonces,
    getAnnonce,
    getAnnoncesParIds,
    vue,
    clicWhatsapp,
    signaler,
    getMesAnnonces,
    ajouterAnnonce,
    updateAnnonce,
    supprimerAnnonce,
    maVerification,
    updateMonProfil,
    adminAnnonces,
    adminUsers,
    adminReports,
    updateReport,
    getVerifications,
    decideVerification,
    lienDocument,
    uploadPhotos,
    soumettreVerification,
    getAvis,
    monAvis,
    ajouterAvis,
    adminAvis,
    updateAvis,
    supprimerAvis,
    demanderCodeReset,
    validerCodeReset,
  };
})(); // fin de l'IIFE
