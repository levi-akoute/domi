document.addEventListener("DOMContentLoaded",async()=>{
  const U=ImmoUtils,S=ImmoStorage,user=await ImmoAuth.requireUser();if(!user)return;
  const form=U.qs("#publish-form"),msg=U.qs("#publish-message"),el=n=>form.elements[n],editId=U.getParam("edit"),files=U.qs("#photos"),prev=U.qs("#photo-preview");
  U.fillCommunes(el("commune"));
  const lock=t=>{U.showMessage(msg,t,"error");form.querySelectorAll("button.btn-primary").forEach(b=>b.disabled=true);};
  if(user.role==="admin"){lock("Le compte administrateur n’est pas destiné à publier des biens.");return;}
  el("telephone").value=user.telephone||"";
  let existing=null;
  if(editId){
    existing=await S.getAnnonce(editId).catch(()=>null);
    if(!existing||existing.owner_id!==user.id){lock("Annonce introuvable ou non modifiable.");return;}
    ["titre","type","loyer","statut","description","commune","quartier","adresse","cie","sodeci","avance","caution","etage","chambres","video","telephone"].forEach(n=>{if(el(n)&&existing[n]!=null)el(n).value=existing[n];});
    U.qs("#publish-title").textContent="Modifier votre annonce.";
    prev.innerHTML=(existing.images||[]).map(u=>`<img src="${U.escapeHtml(u)}" alt="">`).join("")+'<p class="fine-print">Photos actuelles. En choisir de nouvelles remplace celles-ci. Modifier le contenu renvoie l’annonce en validation.</p>';
  }
  files.addEventListener("change",()=>{prev.innerHTML=[...files.files].slice(0,6).map(f=>`<img src="${URL.createObjectURL(f)}" alt="">`).join("")+(files.files.length>6?'<p class="fine-print">Seules les 6 premières photos seront envoyées.</p>':"");});
  form.addEventListener("submit",async e=>{
    e.preventDefault();const btn=form.querySelector("button.btn-primary"),label=btn.textContent;btn.disabled=true;btn.textContent="Envoi en cours…";
    try{
      const d=new FormData(form),row={titre:d.get("titre").trim(),type:d.get("type"),loyer:Number(d.get("loyer")),statut:d.get("statut"),description:d.get("description").trim(),commune:d.get("commune"),quartier:d.get("quartier").trim(),adresse:d.get("adresse").trim()||null,cie:d.get("cie"),sodeci:d.get("sodeci"),avance:Number(d.get("avance"))||0,caution:Number(d.get("caution"))||0,etage:d.get("etage").trim()||null,chambres:Number(d.get("chambres"))||0,video:d.get("video").trim()||null,telephone:ImmoAuth.normalize(d.get("telephone"))};
      if(!row.commune)throw new Error("Choisissez une commune.");
      const picked=[...files.files];if(!existing&&!picked.length)throw new Error("Ajoutez au moins une photo du logement.");
      if(picked.length){const urls=await S.uploadPhotos(picked,user.id);if(!urls.length)throw new Error("Aucune image valide.");row.images=urls;row.image=urls[0];}
      if(existing)await S.updateAnnonce(existing.id,row);else await S.ajouterAnnonce({...row,owner_id:user.id});
      location.href="dashboard-proprietaire.html?publie=1";
    }catch(err){U.showMessage(msg,err.message,"error");btn.disabled=false;btn.textContent=label;}
  });
});
