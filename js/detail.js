document.addEventListener("DOMContentLoaded",async()=>{
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
  </div>
  <aside class="contact-card"><span class="eyebrow">Prix annoncé</span><div class="detail-price">${U.money(a.loyer)}<small>/ mois</small></div><div class="contact-divider"></div>
    <div class="condition-row"><span>Avance</span><strong>${Number(a.avance)||0} mois</strong></div><div class="condition-row"><span>Caution</span><strong>${Number(a.caution)||0} mois</strong></div><div class="condition-row"><span>Disponibilité</span><strong>${E(a.statut)}</strong></div>
    <a class="btn btn-primary btn-block ${dis}" ${waAttr} id="whatsapp-contact">${I("whatsapp")} Contacter sur WhatsApp</a>
    <a class="btn btn-outline btn-block ${dis}" ${dispo&&phone?`href="tel:+${full}"`:`aria-disabled="true"`}>${I("phone")} Appeler l’annonceur</a>
    <button class="btn btn-outline btn-block" id="share-listing" type="button">${I("share")} Partager cette annonce</button>
    <p class="fine-print">Disponibilité, prix et conditions à confirmer directement avec l’annonceur.</p><button class="report-link" id="report-listing" type="button">Signaler cette annonce</button></aside></div>
  <div class="sticky-contact"><div><strong>${U.money(a.loyer)}</strong><small>/ mois</small></div><a class="btn btn-primary ${dis}" ${waAttr} id="whatsapp-sticky">${I("whatsapp")} WhatsApp</a></div>`;

  main.querySelectorAll(".thumb").forEach(b=>b.addEventListener("click",()=>{U.qs("#gallery-main").src=photos[b.dataset.i];main.querySelectorAll(".thumb").forEach(x=>x.classList.toggle("active",x===b));}));
  ["#whatsapp-contact","#whatsapp-sticky"].forEach(s=>U.qs(s)?.addEventListener("click",()=>{if(dispo)S.clicWhatsapp(a.id);}));
  U.qs("#share-listing").addEventListener("click",async()=>{const d={title:a.titre,text:`${a.titre} — ${U.money(a.loyer)}/mois à ${a.commune}`,url:location.href};try{if(navigator.share)await navigator.share(d);else{await navigator.clipboard.writeText(location.href);U.toast("Lien copié");}}catch(e){}});

  const dlg=document.createElement("dialog");dlg.className="report-dialog";
  dlg.innerHTML=`<form><h3>Signaler cette annonce</h3><label>Motif<select name="reason"><option>Arnaque / demande d’argent suspecte</option><option>Faux prix</option><option>Déjà loué / indisponible</option><option>Photos qui ne correspondent pas</option><option>Autre</option></select></label><label>Détails (facultatif)<textarea name="details" rows="3" maxlength="1000"></textarea></label><div class="publish-actions"><button type="button" class="btn btn-outline" data-close>Annuler</button><button type="submit" class="btn btn-primary">Envoyer</button></div></form>`;
  document.body.appendChild(dlg);
  U.qs("#report-listing").addEventListener("click",()=>dlg.showModal());
  dlg.querySelector("[data-close]").addEventListener("click",()=>dlg.close());
  dlg.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(e.target);
    try{await S.signaler({listing_id:a.id,reporter_id:user?user.id:null,reason:d.get("reason"),details:(d.get("details")||"").trim()||null});dlg.close();U.toast("Merci, votre signalement a été transmis à la modération.");}
    catch(err){U.toast(err.message,"error");}});
});
