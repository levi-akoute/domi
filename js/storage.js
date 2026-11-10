/* ═══════════════════════════════════════════════════════════════════
   storage.js : la couche de données. TOUTES les requêtes vers Supabase
   passent par ici. Les pages ne parlent jamais directement à la base.

   Chargé APRÈS config.js et utils.js. Expose : window.ImmoStorage
   Toutes les fonctions sont asynchrones : on les appelle avec await.

   Rappel sécurité : ce fichier tourne dans le navigateur du visiteur,
   qui peut le modifier. La vraie protection, ce sont les règles RLS
   écrites dans database/*.sql. Les filtres ici servent à l'affichage.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const C = window.IMMOCI_CONFIG || {};
  const url = String(C.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const key = String(C.SUPABASE_ANON_KEY || "").trim();

  // Le site est « configuré » si la librairie Supabase est chargée et si config.js
  // contient une vraie URL (https://xxxx.supabase.co) et une vraie clé.
  const configured = !!(
    window.supabase &&
    url &&
    key &&
    !/COLLE_ICI/.test(url + key) &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
  );
  const sb = configured ? window.supabase.createClient(url, key) : null;

  /* ───────── Gestion des erreurs ───────── */
  const NET =
    "Impossible de joindre la base de données. Vérifiez votre connexion Internet et l’URL dans js/config.js (elle doit ressembler à https://xxxx.supabase.co).";
  const fixMsg = (m) => (/failed to fetch|networkerror|load failed/i.test(m || "") ? NET : m);

  const client = () => {
    if (!sb)
      throw new Error(
        "Base de données non configurée : renseignez js/config.js (voir docs/GUIDE_MISE_EN_LIGNE.md)."
      );
    return sb;
  };

  // Exécute une requête Supabase : renvoie les données, ou lève une erreur lisible.
  const ok = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(fixMsg(error.message));
    return data;
  };
  const L = () => client().from("listings");

  // Date limite de fraîcheur : une annonce confirmée avant cette date est masquée du public
  const limiteFraicheur = () => {
    const jours = window.ImmoUtils?.JOURS_MASQUAGE || 45;
    return new Date(Date.now() - jours * 86400000).toISOString();
  };

  /* ───────── Public (visiteurs) ───────── */
  // SQL équivalent : SELECT * FROM listings WHERE moderation='approuvee'
  //   AND confirmee_le >= <il y a 45 jours> ORDER BY created_at DESC LIMIT 500
  const getAnnonces = () =>
    ok(
      L()
        .select("*")
        .eq("moderation", "approuvee")
        .gte("confirmee_le", limiteFraicheur())
        .order("created_at", { ascending: false })
        .limit(500)
    );
  const getAnnonce = (id) => ok(L().select("*").eq("id", id).maybeSingle());
  // Plusieurs annonces à partir de leurs identifiants (page Favoris)
  const getAnnoncesParIds = (ids) =>
    ids.length ? ok(L().select("*").in("id", ids).eq("moderation", "approuvee")) : [];
  // Compteurs : les erreurs sont ignorées volontairement (un compteur raté ne doit rien bloquer)
  const vue = (id) =>
    client()
      .rpc("increment_view", { p_id: id })
      .then(
        () => {},
        () => {}
      );
  const clicWhatsapp = (id) =>
    client()
      .rpc("increment_whatsapp", { p_id: id })
      .then(
        () => {},
        () => {}
      );
  const signaler = (r) => ok(client().from("reports").insert(r));

  /* ───────── Annonceur (propriétaire ou agent connecté) ───────── */
  const getMesAnnonces = (uid) =>
    ok(L().select("*").eq("owner_id", uid).order("created_at", { ascending: false }));
  const ajouterAnnonce = (d) => ok(L().insert(d).select().single());
  const updateAnnonce = (id, p) => ok(L().update(p).eq("id", id).select().single());
  const supprimerAnnonce = (id) => ok(L().delete().eq("id", id));
  const maVerification = (uid) =>
    ok(
      client()
        .from("verification_requests")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
    );
  // Modifier son propre profil (ex. email de récupération). La base empêche de
  // changer son rôle ou son badge (trigger protect_profile).
  const updateMonProfil = (uid, patch) =>
    ok(client().from("profiles").update(patch).eq("id", uid).select().single());

  /* ───────── Administration ───────── */
  const adminAnnonces = () =>
    ok(
      L()
        .select("*, profiles!owner_id(nom,prenom,telephone,verifie)")
        .order("created_at", { ascending: false })
        .limit(300)
    );
  const adminUsers = () =>
    ok(client().from("profiles").select("*").order("created_at", { ascending: false }));
  const adminReports = () =>
    ok(
      client()
        .from("reports")
        .select("*, listings(id,titre)")
        .order("created_at", { ascending: false })
        .limit(200)
    );
  const updateReport = (id, status) => ok(client().from("reports").update({ status }).eq("id", id));
  const getVerifications = () =>
    ok(
      client()
        .from("verification_requests")
        .select("*, profiles(nom,prenom,telephone)")
        .order("created_at", { ascending: false })
    );
  const decideVerification = (id, approve, note) =>
    ok(client().rpc("decide_verification", { p_id: id, p_approve: approve, p_note: note || null }));
  // Pièce d'identité : bucket PRIVÉ, lien temporaire valable 5 minutes (300 s)
  const lienDocument = async (path) => {
    const { data, error } = await client().storage.from("verifications").createSignedUrl(path, 300);
    if (error) throw new Error(fixMsg(error.message));
    return data.signedUrl;
  };

  /* ───────── Avis ───────── */
  const getAvis = (id) =>
    ok(
      client()
        .from("reviews")
        .select("*")
        .eq("listing_id", id)
        .eq("status", "approuve")
        .order("created_at", { ascending: false })
        .limit(30)
    );
  const monAvis = async (id, uid) => {
    const r = await ok(
      client().from("reviews").select("*").eq("listing_id", id).eq("author_id", uid).limit(1)
    );
    return (r && r[0]) || null;
  };
  const ajouterAvis = (r) => ok(client().from("reviews").insert(r));
  const adminAvis = () =>
    ok(
      client()
        .from("reviews")
        .select("*, listings(id,titre)")
        .order("created_at", { ascending: false })
        .limit(200)
    );
  const updateAvis = (id, status) => ok(client().from("reviews").update({ status }).eq("id", id));
  const supprimerAvis = (id) => ok(client().from("reviews").delete().eq("id", id));

  /* ───────── Mot de passe oublié (Edge Function) ─────────
     Le changement de mot de passe sans être connecté exige la clé service_role.
     Elle ne doit JAMAIS être dans le site : c'est la fonction serveur
     « reinitialiser-mot-de-passe » (dossier supabase/functions/) qui s'en charge. */
  async function appelReset(body) {
    let res;
    try {
      res = await client().functions.invoke("reinitialiser-mot-de-passe", { body });
    } catch (e) {
      res = { error: e };
    }
    if (res.error || !res.data)
      throw new Error(
        "Le service de récupération est momentanément indisponible. Contactez le support sur WhatsApp."
      );
    if (!res.data.ok) throw new Error(res.data.message || "Une erreur est survenue.");
    return res.data;
  }
  const demanderCodeReset = (telephone) => appelReset({ action: "demander", telephone });
  const validerCodeReset = (telephone, code, password) =>
    appelReset({ action: "valider", telephone, code, password });

  /* ───────── Fichiers ───────── */
  // Photos compressées dans le navigateur (WebP, 1280 px max) avant l'envoi :
  // pages plus rapides et forfait de stockage Supabase préservé.
  async function compress(file, max = 1280) {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * r);
    c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const toBlob = (t, q) => new Promise((res) => c.toBlob(res, t, q));
    const w = await toBlob("image/webp", 0.8);
    // Certains vieux navigateurs ne savent pas produire du WebP : repli en JPEG
    return w && w.type === "image/webp"
      ? { blob: w, ext: "webp" }
      : { blob: await toBlob("image/jpeg", 0.82), ext: "jpg" };
  }
  // Chaque utilisateur range ses photos dans un dossier à son identifiant :
  // la règle de stockage « annonces_insert_own » refuse tout autre dossier.
  async function uploadPhotos(files, uid) {
    const urls = [];
    for (const f of [...files].slice(0, 6)) {
      if (!f.type.startsWith("image/")) continue;
      const { blob, ext } = await compress(f);
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await client()
        .storage.from("annonces")
        .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (error) throw new Error(fixMsg(error.message));
      urls.push(client().storage.from("annonces").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }
  async function soumettreVerification(file, type, uid) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop lourd (5 Mo maximum).");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${uid}/${Date.now()}.${ext}`;
    const up = await client()
      .storage.from("verifications")
      .upload(path, file, { contentType: file.type });
    if (up.error) throw new Error(fixMsg(up.error.message));
    return ok(
      client()
        .from("verification_requests")
        .insert({ user_id: uid, document_type: type, document_path: path })
    );
  }

  window.ImmoStorage = {
    fixMsg,
    isConfigured: () => configured,
    client,
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
})();
