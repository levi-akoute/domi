document.addEventListener("DOMContentLoaded",async()=>{
  document.body.classList.add("is-detail");
  const U=window.ImmoUtils,S=window.ImmoStorage,A=window.ImmoAuth,main=U.qs("#detail-content"),FALLBACK="assets/img/placeholder.svg";
  const notFound='<div class="empty-state"><h1>Annonce introuvable</h1><p>Cette annonce n’existe pas, n’est plus publiée ou a été supprimée.</p><a class="btn btn-primary" href="annonces.html">Retour aux annonces</a></div>';
  let a=null;try{a=await S.getAnnonce(U.getParam("id"));}catch(e){}
  if(!a){main.innerHTML=notFound;return;}
  const user=await A.currentUser(),mine=user&&user.id===a.owner_id,pub=a.moderation==="approuvee";
  if(pub&&!sessionStorage.getItem("v_"+a.id)){sessionStorage.setItem("v_"+a.id,"1");S.vue(a.id);}
  document.title=a.titre+" — Domi";
  const photos=(a.images&&a.images.length?a.images:[a.image]).filter(Boolean);if(!photos.length)photos.push(FALLBACK);
  const phone=String(a.telephone||"").replace(/\D/g,""),full=phone.startsWith("225")?phone:"225"+phone,dispo=a.statut==="Disponible"&&pub;
  const wa=phone?`https://wa.me/${full}?text=${encodeURIComponent("Bonjour, je vous contacte au sujet de votre annonce Domi : "+a.titre)}`:"#";
  const waAttr=dispo&&phone?`href="${wa}" target="_blank" rel="noopener"`:`aria-disabled="true"`,dis=dispo&&phone?"":"disabled-link";
  const E=U.escapeHtml,I=U.icon;
  main.innerHTML=`<a class="back-link" href="annonces.html">${I("arrow","flip")} Retour aux annonces</a>
  ${!pub?`<div class="notice info">${a.moderation==="rejetee"?"Cette annonce a été refusée par la modération.":"Cette annonce est en attente de validation."} Elle n’est visible que par vous${user&&user.role==="admin"?" et les administrateurs":""}.</div>`:""}
  <div class="detail-heading"><div><div class="listing-location">${I("pin")} ${E(a.commune)}${a.quartier?" · "+E(a.quartier):""}</div><h1>${E(a.titre)}</h1><p>${E(a.type)} · ${Number(a.chambres)||0} chambre(s) · ${E(a.etage||"Étage non précisé")}</p></div><div class="badge-stack"><span class="status-badge static ${a.statut==="Disponible"?"available":"unavailable"}">${E(a.statut)}</span>${a.proprietaire_verifie?`<span class="verified-badge static">${I("check")} Propriétaire vérifié</span>`:""}</div></div>
  <div class="detail-layout"><div class="detail-main-column">
    <div class="detail-photo"><img id="gallery-main" src="${E(photos[0])}" alt="${E(a.titre)}" onerror="this.onerror=null;this.src='${FALLBACK}'">${a.video?`<a class="video-overlay" href="${E(a.video)}" target="_blank" rel="noopener">${I("play")} Voir la visite vidéo</a>`:""}</div>
    ${photos.length>1?`<div class="thumbs">${photos.map((p,i)=>`<button type="button" class="thumb ${i?"":"active"}" data-i="${i}" aria-label="Photo ${i+1}"><img src="${E(p)}" alt="" loading="lazy"></button>`).join("")}</div>`:""}
    <section class="detail-section"><h2>Description</h2><p>${E(a.description||"Aucune description fournie.").replace(/\n/g,"<br>")}</p></section>
    <section class="detail-section"><h2>Caractéristiques</h2><div class="feature-grid"><div><small>${I("bolt")} Compteur CIE</small><strong>${E(a.cie||"Non renseigné")}</strong></div><div><small>${I("drop")} Compteur SODECI</small><strong>${E(a.sodeci||"Non renseigné")}</strong></div><div><small>Avance</small><strong>${Number(a.avance)||0} mois</strong></div><div><small>Caution</small><strong>${Number(a.caution)||0} mois</strong></div><div><small>${I("bed")} Chambres</small><strong>${Number(a.chambres)||0}</strong></div><div><small>Annonce confirmée</small><strong>${U.daysAgo(a.confirmee_le)}</strong></div></div></section>
    <section class="safety-note"><strong>Conseils de sécurité</strong><ul><li>Visitez le logement avant de verser de l’argent.</li><li>Vérifiez l’identité de l’annonceur et que c’est bien lui qui détient le bien.</li><li>Demandez un reçu écrit pour tout paiement.</li><li>Ne transmettez jamais de code confidentiel ni de code Mobile Money.</li></ul></section>
    <section class="detail-section" id="reviews-section"></section>
  </div>
  <aside class="contact-card"><span class="eyebrow">Prix annoncé</span><div class="detail-price">${U.money(a.loyer)}<small>/ mois</small></div><div class="contact-divider"></div>
    <div class="condition-row"><span>Avance</span><strong>${Number(a.avance)||0} mois</strong></div><div class="condition-row"><span>Caution</span><strong>${Number(a.caution)||0} mois</strong></div><div class="condition-row"><span>Disponibilité</span><strong>${E(a.statut)}</strong></div>
    <a class="btn btn-primary btn-block ${dis}" ${waAttr} id="whatsapp-contact">${I("whatsapp")} Contacter sur WhatsApp</a>
    <a class="btn btn-outline btn-block ${dis}" ${dispo&&phone?`href="tel:+${full}"`:`aria-disabled="true"`}>${I("phone")} Appeler l’annonceur</a>
    <button class="btn btn-outline btn-block" id="share-listing" type="button">${I("share")} Partager cette annonce</button>
    <p class="fine-print">Disponibilité, prix et conditions à confirmer directement avec l’annonceur.</p><button class="report-link" id="report-listing" type="button">Signaler cette annonce</button><a class="support-link" href="${U.supportLink("Bonjour Domi, j’ai un doute sur cette annonce : "+a.titre+" — "+location.href)}" target="_blank" rel="noopener">Un doute ? Écrire au support</a></aside></div>
  <div class="sticky-contact"><div><strong>${U.money(a.loyer)}</strong><small>/ mois</small></div><a class="btn btn-primary ${dis}" ${waAttr} id="whatsapp-sticky">${I("whatsapp")} WhatsApp</a></div>`;

  main.querySelectorAll(".thumb").forEach(b=>b.addEventListener("click",()=>{U.qs("#gallery-main").src=photos[b.dataset.i];main.querySelectorAll(".thumb").forEach(x=>x.classList.toggle("active",x===b));}));
  ["#whatsapp-contact","#whatsapp-sticky"].forEach(s=>U.qs(s)?.addEventListener("click",()=>{if(dispo)S.clicWhatsapp(a.id);}));
  U.qs("#share-listing").addEventListener("click",async()=>{const d={title:a.titre,text:`${a.titre} — ${U.money(a.loyer)}/mois à ${a.commune}`,url:location.href};try{if(navigator.share)await navigator.share(d);else{await navigator.clipboard.writeText(location.href);U.toast("Lien copié");}}catch(e){}});

  // Photo en grand (plein écran)
  let li=0;const lb=document.createElement("dialog");lb.className="lightbox";
  lb.innerHTML=`<button type="button" class="lb-close" aria-label="Fermer">×</button><button type="button" class="lb-nav lb-prev" aria-label="Photo précédente">${I("arrow","flip")}</button><img alt=""><button type="button" class="lb-nav lb-next" aria-label="Photo suivante">${I("arrow")}</button><div class="lb-count"></div>`;
  document.body.appendChild(lb);
  const showPhoto=i=>{li=(i+photos.length)%photos.length;const im=lb.querySelector("img");im.src=photos[li];im.alt=a.titre;lb.querySelector(".lb-count").textContent=`${li+1} / ${photos.length}`;};
  if(photos.length<2)lb.querySelectorAll(".lb-nav").forEach(b=>{b.hidden=true;});
  U.qs("#gallery-main").addEventListener("click",()=>{showPhoto(Number(main.querySelector(".thumb.active")?.dataset.i||0));lb.showModal();});
  lb.querySelector(".lb-close").onclick=()=>lb.close();lb.querySelector(".lb-prev").onclick=()=>showPhoto(li-1);lb.querySelector(".lb-next").onclick=()=>showPhoto(li+1);
  lb.addEventListener("click",e=>{if(e.target===lb)lb.close();});
  lb.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")showPhoto(li-1);if(e.key==="ArrowRight")showPhoto(li+1);});

  const dlg=document.createElement("dialog");dlg.className="report-dialog";
  dlg.innerHTML=`<form><h3>Signaler cette annonce</h3><label>Motif<select name="reason"><option>Arnaque / demande d’argent suspecte</option><option>Faux prix</option><option>Déjà loué / indisponible</option><option>Photos qui ne correspondent pas</option><option>Autre</option></select></label><label>Détails (facultatif)<textarea name="details" rows="3" maxlength="1000"></textarea></label><div class="publish-actions"><button type="button" class="btn btn-outline" data-close>Annuler</button><button type="submit" class="btn btn-primary">Envoyer</button></div></form>`;
  document.body.appendChild(dlg);
  U.qs("#report-listing").addEventListener("click",()=>dlg.showModal());
  dlg.querySelector("[data-close]").addEventListener("click",()=>dlg.close());
  dlg.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(e.target);
    try{await S.signaler({listing_id:a.id,reporter_id:user?user.id:null,reason:d.get("reason"),details:(d.get("details")||"").trim()||null});dlg.close();U.toast("Merci, votre signalement a été transmis à la modération.");}
    catch(err){U.toast(err.message,"error");}});

  // ---- Avis et notes ----
  const rs=U.qs("#reviews-section"),fmt=n=>String(n).replace(".",","),SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>';
  const stars=n=>Array.from({length:5},(_,k)=>`<svg class="star ${k<Math.round(n)?"on":""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>`).join("");
  async function renderReviews(){
    if(!rs)return;
    let list;try{list=await S.getAvis(a.id);}catch(e){rs.remove();return;}
    const mineR=user&&!mine?await S.monAvis(a.id,user.id).catch(()=>null):null,nb=Number(a.nb_avis)||list.length,note=Number(a.note_moyenne)||0;
    let form="";
    if(pub&&!mine){
      if(!user)form='<p class="muted">Pour donner votre avis, <a class="text-link" href="connexion.html">connectez-vous</a>.</p>';
      else if(mineR)form=`<div class="notice info">Votre avis ${mineR.status==="en_attente"?"est en attente de validation par notre équipe.":mineR.status==="rejete"?"n’a pas été retenu.":"est publié. Merci !"}</div>`;
      else form=`<form id="review-form" class="stack review-form"><h3>Donner mon avis</h3><div class="rate-input" role="radiogroup" aria-label="Votre note sur 5">${[5,4,3,2,1].map(n=>`<input type="radio" name="rating" id="r${n}" value="${n}" required><label for="r${n}" title="${n} sur 5">${SVG}</label>`).join("")}</div><label>Votre commentaire (facultatif)<textarea name="comment" maxlength="800" rows="3" placeholder="Comment s’est passée votre expérience avec ce logement ou cet annonceur ?"></textarea></label><label class="check"><input type="checkbox" required> Je confirme avoir visité ou loué ce bien. Mon avis sera relu avant publication.</label><button class="btn btn-primary" type="submit">Envoyer mon avis</button></form>`;
    }
    rs.innerHTML=`<h2>Avis</h2><div class="rating-summary">${nb?`<div class="big">${fmt(note)}</div><div>${stars(note)}<small>${nb} avis sur cette annonce</small></div>`:'<p class="muted" style="margin:0">Soyez le premier à donner votre avis.</p>'}${Number(a.proprio_nb_avis)>0?`<div class="owner-rating"><small>Note de l’annonceur</small><strong>${fmt(a.proprio_note)} / 5</strong><small>${a.proprio_nb_avis} avis au total</small></div>`:""}</div>${list.map(r=>`<article class="review"><header><strong>${E(r.author_name||"Utilisateur")}</strong><span>${stars(r.rating)}</span><small>${new Date(r.created_at).toLocaleDateString("fr-FR")}</small></header>${r.comment?`<p>${E(r.comment)}</p>`:""}</article>`).join("")}${form}`;
    U.qs("#review-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),b=e.target.querySelector("button[type=submit]");b.disabled=true;
      try{await S.ajouterAvis({listing_id:a.id,author_id:user.id,rating:Number(f.get("rating")),comment:(f.get("comment")||"").trim()||null});U.toast("Merci ! Votre avis sera publié après relecture.");renderReviews();}
      catch(err){U.toast(/duplicate|unique/i.test(err.message)?"Vous avez déjà donné votre avis sur cette annonce.":err.message,"error");b.disabled=false;}});
  }
  renderReviews();
});
