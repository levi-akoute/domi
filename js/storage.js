/* Couche de données Domi → Supabase. Toutes les fonctions sont asynchrones (await). */
(function(){
  const C=window.IMMOCI_CONFIG||{};
  const url=String(C.SUPABASE_URL||"").trim().replace(/\/+$/,""),key=String(C.SUPABASE_ANON_KEY||"").trim();
  const configured=!!(window.supabase&&url&&key&&!/COLLE_ICI/.test(url+key)&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url));
  const sb=configured?window.supabase.createClient(url,key):null;
  const NET="Impossible de joindre la base de données. Vérifiez votre connexion Internet et l’URL dans js/config.js (elle doit ressembler à https://xxxx.supabase.co).";
  const fixMsg=m=>/failed to fetch|networkerror|load failed/i.test(m||"")?NET:m;
  const client=()=>{if(!sb)throw new Error("Base de données non configurée : renseignez js/config.js (voir docs/GUIDE_MISE_EN_LIGNE.md).");return sb;};
  const ok=async q=>{const {data,error}=await q;if(error)throw new Error(fixMsg(error.message));return data;};
  const L=()=>client().from("listings");

  // Public
  const getAnnonces=()=>ok(L().select("*").eq("moderation","approuvee").order("created_at",{ascending:false}).limit(500));
  const getAnnonce=id=>ok(L().select("*").eq("id",id).maybeSingle());
  const vue=id=>client().rpc("increment_view",{p_id:id}).then(()=>{},()=>{});
  const clicWhatsapp=id=>client().rpc("increment_whatsapp",{p_id:id}).then(()=>{},()=>{});
  const signaler=r=>ok(client().from("reports").insert(r));

  // Annonceur
  const getMesAnnonces=uid=>ok(L().select("*").eq("owner_id",uid).order("created_at",{ascending:false}));
  const ajouterAnnonce=d=>ok(L().insert(d).select().single());
  const updateAnnonce=(id,p)=>ok(L().update(p).eq("id",id).select().single());
  const supprimerAnnonce=id=>ok(L().delete().eq("id",id));
  const maVerification=uid=>ok(client().from("verification_requests").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(1));

  // Admin
  const adminAnnonces=()=>ok(L().select("*, profiles(nom,prenom,telephone)").order("created_at",{ascending:false}).limit(300));
  const adminUsers=()=>ok(client().from("profiles").select("*").order("created_at",{ascending:false}));
  const adminReports=()=>ok(client().from("reports").select("*, listings(id,titre)").order("created_at",{ascending:false}).limit(200));
  const updateReport=(id,status)=>ok(client().from("reports").update({status}).eq("id",id));
  const getVerifications=()=>ok(client().from("verification_requests").select("*, profiles(nom,prenom,telephone)").order("created_at",{ascending:false}));
  const decideVerification=(id,approve,note)=>ok(client().rpc("decide_verification",{p_id:id,p_approve:approve,p_note:note||null}));
  const lienDocument=async path=>{const {data,error}=await client().storage.from("verifications").createSignedUrl(path,300);if(error)throw new Error(fixMsg(error.message));return data.signedUrl;};

  // Fichiers : photos compressées (WebP 1280 px max) → bucket public « annonces »
  async function compress(file,max=1280){
    const bmp=await createImageBitmap(file),r=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement("canvas");c.width=Math.round(bmp.width*r);c.height=Math.round(bmp.height*r);
    c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
    const toBlob=(t,q)=>new Promise(res=>c.toBlob(res,t,q));
    const w=await toBlob("image/webp",.8);
    return w&&w.type==="image/webp"?{blob:w,ext:"webp"}:{blob:await toBlob("image/jpeg",.82),ext:"jpg"};
  }
  async function uploadPhotos(files,uid){
    const urls=[];
    for(const f of [...files].slice(0,6)){
      if(!f.type.startsWith("image/"))continue;
      const {blob,ext}=await compress(f),path=`${uid}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const {error}=await client().storage.from("annonces").upload(path,blob,{contentType:blob.type,cacheControl:"31536000"});
      if(error)throw new Error(fixMsg(error.message));
      urls.push(client().storage.from("annonces").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }
  async function soumettreVerification(file,type,uid){
    if(file.size>5*1024*1024)throw new Error("Fichier trop lourd (5 Mo maximum).");
    const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,""),path=`${uid}/${Date.now()}.${ext}`;
    const up=await client().storage.from("verifications").upload(path,file,{contentType:file.type});
    if(up.error)throw new Error(fixMsg(up.error.message));
    return ok(client().from("verification_requests").insert({user_id:uid,document_type:type,document_path:path}));
  }
  window.ImmoStorage={fixMsg,isConfigured:()=>configured,client,getAnnonces,getAnnonce,vue,clicWhatsapp,signaler,getMesAnnonces,ajouterAnnonce,updateAnnonce,supprimerAnnonce,maVerification,adminAnnonces,adminUsers,adminReports,updateReport,getVerifications,decideVerification,lienDocument,uploadPhotos,soumettreVerification};
})();
