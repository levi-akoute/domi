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

  /* ───────── Public (visiteurs) ─────────
     Depuis la v7.3, les visiteurs ne lisent plus la table « listings » directement.
     Ils passent par la fonction SQL annonces_publiques() (database/13), qui ne renvoie
     QUE ce que le site affiche. Restent cachés, même avec F12 : le numéro de l'annonceur
     (demandé au clic, voir contacterAnnonce), les vues, les clics, le repère, les dates
     de création et de modification, la fin de la mise « À la une » et l'identifiant du
     propriétaire.

     Repli : tant que database/13 n'est pas exécuté dans Supabase, la fonction n'existe
     pas (code d'erreur PGRST202). On lit alors la table comme avant, pour que le site
     continue de marcher. Ce repli pourra être retiré une fois le fichier 13 exécuté. */

  // Vrai si l'erreur dit « cette fonction SQL n'existe pas (encore) »
  const fonctionAbsente = (e) => !!e && e.code === "PGRST202";
  let sansFichier13 = false; // passe à vrai au premier PGRST202 (on ne réessaie plus)

  // Lecture publique des annonces. filtres(requete, viaFonction) ajoute les filtres voulus.
  // viaFonction : vrai si la requête passe par la fonction, faux pour le repli sur la table.
  // Renvoie toujours une LISTE (éventuellement vide).
  const publiques = async (filtres) => {
    if (!sansFichier13) {
      const { data, error } = await filtres(client().rpc("annonces_publiques"), true);
      if (!error) return data || []; // cas normal
      if (!fonctionAbsente(error)) throw new Error(fixMsg(error.message)); // vraie erreur
      sansFichier13 = true; // fichier 13 pas encore exécuté : repli sur la table
    }
    return ok(filtres(L().select("*").eq("moderation", "approuvee"), false));
  };

  // Toutes les annonces publiées et fraîches (confirmées depuis moins de 45 jours),
  // les plus récentes d'abord, 500 au maximum.
  const getAnnonces = () =>
    publiques((q, viaFonction) =>
      q
        .gte("confirmee_le", limiteFraicheur()) // gte = « supérieur ou égal » : confirmées récemment
        // La fonction cache la date de publication : elle donne un « rang » (1 = la plus récente)
        .order(viaFonction ? "rang" : "created_at", { ascending: viaFonction })
        .limit(500)
    );

  // Une seule annonce par son identifiant (null si elle n'existe pas ou n'est pas visible).
  // Une annonce pas encore validée n'est pas publique : on la cherche alors dans la table,
  // où seuls son propriétaire et l'admin peuvent la lire (aperçu avant validation).
  const getAnnonce = async (id) => {
    const r = await publiques((q) => q.eq("id", id).limit(1)); // eq = « égal à »
    return r[0] || ok(L().select("*").eq("id", id).maybeSingle());
  };

  // Plusieurs annonces à partir d'une liste d'identifiants (page Favoris)
  const getAnnoncesParIds = (ids) =>
    ids.length
      ? publiques((q) => q.in("id", ids)) // in = « fait partie de la liste »
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

  // Numéro de l'annonceur (v7.3) : il n'est plus envoyé avec les annonces. On le demande
  // seulement quand un visiteur clique sur « Contacter », pour UNE annonce. La fonction SQL
  // compte aussi le clic (statistique du propriétaire) et renvoie null si l'annonce n'est
  // plus disponible.
  // repli : numéro déjà présent dans l'annonce (base sans le fichier 13) ; on compte alors
  // le clic avec l'ancienne fonction.
  const contacterAnnonce = async (id, repli) => {
    const { data, error } = await client().rpc("contacter_annonce", { p_id: id });
    if (!error) return data || null;
    if (fonctionAbsente(error) && repli) {
      clicWhatsapp(id);
      return repli;
    }
    throw new Error(fixMsg(error.message));
  };

  // Point exact d'une annonce (v8.2), demandé seulement au clic sur « Itinéraire » (comme le numéro).
  // null si l'annonceur n'a pas posé d'épingle, ne veut pas donner le point exact, ou si l'annonce
  // n'est plus disponible.
  const itineraire = async (id) => {
    const { data, error } = await client().rpc("itineraire_annonce", { p_id: id });
    if (error) throw new Error(fixMsg(error.message));
    const p = Array.isArray(data) ? data[0] : data;
    return p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? p : null;
  };

  // La base connaît-elle la carte (fichier 14 exécuté) ? Sert au formulaire de publication : avant
  // ce fichier, la base n'a pas les colonnes de position et refuserait l'annonce.
  let carteDispo = null; // réponse gardée en mémoire (une seule question)
  const carteActive = async () => {
    if (carteDispo === null) {
      const { error } = await client().rpc("itineraire_annonce", {
        p_id: "00000000-0000-4000-8000-000000000000", // annonce inexistante : réponse vide
      });
      carteDispo = !fonctionAbsente(error); // seule la fonction absente désactive la carte
    }
    return carteDispo;
  };

  // Enregistre un signalement (la base limite le nombre : database/09)
  const signaler = (r) => ok(client().from("reports").insert(r));

  /* ───────── Annonceur (propriétaire ou agent connecté) ───────── */

  // Les annonces du propriétaire uid (toutes, même en attente : la règle RLS le permet pour SES annonces)
  const getMesAnnonces = (uid) =>
    ok(L().select("*").eq("owner_id", uid).order("created_at", { ascending: false }));
  // UNE annonce complète (numéro, repère…), pour la modifier. Lue dans la table : la base
  // ne la renvoie qu'à son propriétaire et à l'admin (null pour les autres).
  const getMonAnnonce = (id) => ok(L().select("*").eq("id", id).maybeSingle());
  // Crée une annonce et renvoie la ligne créée (.select().single())
  const ajouterAnnonce = (d) => ok(L().insert(d).select().single());
  // Modifie l'annonce id avec les champs p
  const updateAnnonce = (id, p) => ok(L().update(p).eq("id", id).select().single());
  // Chemin d'une photo dans le bucket « annonces », à partir de son adresse publique :
  // « https://….supabase.co/storage/v1/object/public/annonces/UID/123.webp » → « UID/123.webp »
  const cheminPhoto = (url) => {
    const m = String(url || "").match(/\/storage\/v1\/object\/public\/annonces\/([^?#]+)$/);
    return m ? decodeURIComponent(m[1]) : null; // null : ce n'est pas une photo de notre stockage
  };
  // Supprime des photos du stockage (v7.1, audit de sécurité). Avant, une photo restait
  // accessible en ligne pour toujours, même après la suppression de l'annonce, alors que la
  // politique de confidentialité promet l'inverse. Les règles de stockage n'autorisent que
  // l'annonceur (son dossier) et l'admin. Une erreur ici ne bloque jamais le reste.
  // v8.1 : chaque photo a aussi une petite version « -mini » (voir uploadPhotos) : on efface les deux.
  // Une petite version absente (photo d'avant la v8.1) est simplement ignorée par Supabase.
  const avecMiniature = (chemin) => [chemin, chemin.replace(/\.(webp|jpg)$/, "-mini.$1")];
  const supprimerPhotos = async (urls) => {
    const chemins = [
      ...new Set((urls || []).map(cheminPhoto).filter(Boolean).flatMap(avecMiniature)),
    ]; // sans doublons
    if (!chemins.length) return;
    try {
      await client().storage.from("annonces").remove(chemins);
    } catch (e) {} // ménage seulement : on n'empêche pas l'action principale
  };
  // Supprime l'annonce id (la base refuse si ce n'est pas la sienne), puis ses photos
  const supprimerAnnonce = async (id) => {
    const avant = await ok(L().select("image, images, video").eq("id", id).maybeSingle()); // fichiers à effacer
    // .select("id") : renvoie les lignes réellement supprimées (vide si la base a refusé)
    const supprimees = await ok(L().delete().eq("id", id).select("id"));
    if (avant && supprimees && supprimees.length) {
      await supprimerPhotos([avant.image, ...(avant.images || [])]);
      await supprimerVideo(avant.video);
    }
  };
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

  // Espace utilisé par les fichiers, par dossier (v8.3, database/14). null si la fonction n'existe pas encore.
  const espaceUtilise = async () => {
    const { data, error } = await client().rpc("espace_utilise");
    if (error) return null;
    return data || [];
  };
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
  // Pièce d'identité : suppression définitive après la décision de l'admin (database/10).
  // 1. supprime le fichier du bucket privé ; 2. efface son chemin dans la demande.
  const supprimerDocument = async (id, path) => {
    if (path) {
      const { data, error } = await client().storage.from("verifications").remove([path]);
      if (error) throw new Error(fixMsg(error.message));
      // Supabase ne signale pas toujours un refus : si rien n'a été supprimé, c'est que la
      // règle de suppression manque (fichier database/10 pas encore exécuté)
      if (!data || data.length === 0)
        throw new Error(
          "Document non supprimé : exécutez database/10_suppression_pieces_identite.sql dans Supabase."
        );
    }
    return ok(client().rpc("forget_verification_document", { p_id: id }));
  };

  /* ───────── Avis ───────── */

  // Avis publiés d'une annonce (30 plus récents).
  // v7.3 : par la fonction SQL avis_publics (database/13), qui cache l'identifiant de
  // l'auteur. Repli sur la table tant que le fichier 13 n'est pas exécuté.
  const getAvis = async (id) => {
    const { data, error } = await client()
      .rpc("avis_publics", { p_listing: id }) // avis publiés de cette annonce
      .order("created_at", { ascending: false }) // les plus récents d'abord
      .limit(30);
    if (!error) return data || [];
    if (!fonctionAbsente(error)) throw new Error(fixMsg(error.message));
    return ok(
      client()
        .from("reviews")
        .select("*")
        .eq("listing_id", id) // de cette annonce
        .eq("status", "approuve") // publiés seulement
        .order("created_at", { ascending: false })
        .limit(30)
    );
  };
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
  // source : un fichier, ou une image déjà décodée (ImageBitmap) pour ne pas la décoder deux fois.
  // q : qualité WebP de 0 à 1 (0,8 pour la grande photo, moins pour la miniature).
  async function compress(source, max = 1280, q = 0.8) {
    const bmp = source instanceof ImageBitmap ? source : await createImageBitmap(source); // décode l'image
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height)); // rapport de réduction (jamais d'agrandissement)
    const c = document.createElement("canvas"); // « toile » invisible pour redessiner l'image
    c.width = Math.round(bmp.width * r); // nouvelle largeur
    c.height = Math.round(bmp.height * r); // nouvelle hauteur
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); // dessine l'image réduite
    // toBlob : transforme la toile en fichier (t = type, q = qualité de 0 à 1)
    const toBlob = (t, q) => new Promise((res) => c.toBlob(res, t, q));
    const w = await toBlob("image/webp", q); // essai en WebP (format léger)
    // Certains vieux navigateurs ne savent pas produire du WebP : repli en JPEG
    return w && w.type === "image/webp"
      ? { blob: w, ext: "webp" }
      : { blob: await toBlob("image/jpeg", Math.min(0.92, q + 0.02)), ext: "jpg" };
  }

  // Envoie jusqu'à 6 photos et renvoie leurs adresses publiques.
  // Chaque utilisateur range ses photos dans un dossier à son identifiant :
  // la règle de stockage « annonces_insert_own » refuse tout autre dossier.
  // v8.1 : chaque photo part aussi en petite version (480 px, « -mini »), utilisée dans les
  // listes (utils.js, miniature). Seule l'adresse de la grande photo est enregistrée.
  async function uploadPhotos(files, uid) {
    const urls = []; // adresses des photos envoyées
    const envoyer = (chemin, blob) =>
      client()
        .storage.from("annonces") // bucket public des photos
        .upload(chemin, blob, { contentType: blob.type, cacheControl: "31536000" }); // cache 1 an
    for (const f of [...files].slice(0, 6)) {
      // 6 photos maximum
      if (!f.type.startsWith("image/")) continue; // ignore ce qui n'est pas une image
      const bmp = await createImageBitmap(f); // décodée une seule fois pour les deux versions
      const grande = await compress(bmp, 1280, 0.8); // photo de la fiche
      const petite = await compress(bmp, 480, 0.72); // miniature des listes
      bmp.close(); // libère la mémoire (téléphones modestes)
      // Nom unique : dossier de l'utilisateur / date en millisecondes - 6 caractères aléatoires
      const base = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await envoyer(`${base}.${grande.ext}`, grande.blob);
      if (error) throw new Error(fixMsg(error.message));
      // Miniature : un échec ne bloque pas l'annonce (les listes afficheront la grande photo)
      if (petite.ext === grande.ext)
        await envoyer(`${base}-mini.${petite.ext}`, petite.blob).catch(() => {});
      urls.push(
        client().storage.from("annonces").getPublicUrl(`${base}.${grande.ext}`).data.publicUrl
      ); // adresse publique
    }
    return urls;
  }

  // Envoie la vidéo préparée (js/video.js) dans le dossier de l'annonceur et renvoie son adresse.
  // Le dossier « videos » (database/14) accepte MP4 et WebM, 40 Mo au maximum par fichier.
  async function uploadVideo(blob, uid) {
    const type = blob.type.split(";")[0]; // « video/mp4 » : sans le détail des codecs
    const ext = type === "video/webm" ? "webm" : "mp4";
    const chemin = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await client()
      .storage.from("videos") // dossier public des vidéos
      .upload(chemin, blob, { contentType: type, cacheControl: "31536000" }); // cache 1 an
    if (error) throw new Error(fixMsg(error.message));
    return client().storage.from("videos").getPublicUrl(chemin).data.publicUrl;
  }

  // Chemin d'une vidéo dans le dossier « videos », à partir de son adresse (null sinon)
  const cheminVideo = (url) => {
    const m = String(url || "").match(/\/storage\/v1\/object\/public\/videos\/([^?#]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  // Supprime une vidéo du stockage (ménage : une erreur ne bloque jamais le reste)
  const supprimerVideo = async (url) => {
    const chemin = cheminVideo(url);
    if (!chemin) return; // pas une vidéo de Domi
    try {
      await client().storage.from("videos").remove([chemin]);
    } catch (e) {}
  };

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
    itineraire, // point exact au clic (v8.2)
    uploadVideo, // envoi de la vidéo préparée (v8.3)
    supprimerVideo, // ménage des vidéos (v8.3)
    carteActive, // la base connaît-elle la carte ? (v8.2)
    clicWhatsapp,
    contacterAnnonce,
    signaler,
    getMesAnnonces,
    getMonAnnonce,
    ajouterAnnonce,
    updateAnnonce,
    supprimerAnnonce,
    supprimerPhotos,
    maVerification,
    updateMonProfil,
    adminAnnonces,
    adminUsers,
    adminReports,
    updateReport,
    getVerifications,
    espaceUtilise, // admin : espace utilisé (v8.3)
    decideVerification,
    lienDocument,
    supprimerDocument,
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
