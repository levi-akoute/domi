document.addEventListener("DOMContentLoaded",async()=>{
  const U=ImmoUtils,S=ImmoStorage,E=U.escapeHtml,user=await ImmoAuth.requireAdmin();if(!user)return;
  const msg=U.qs("#admin-message"),filter=U.qs("#ads-filter");
  const run=async(fn,ok)=>{try{await fn();if(ok)U.toast(ok);}catch(e){U.showMessage(msg,e.message,"error");}render();};
  const table=(head,rows,empty)=>rows.length?`<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`:`<p class="muted">${empty}</p>`;
  const d=x=>new Date(x).toLocaleDateString("fr-FR");
  async function render(){
    let ads,users,reps,ver;
    try{[ads,users,reps,ver]=await Promise.all([S.adminAnnonces(),S.adminUsers(),S.adminReports(),S.getVerifications()]);}catch(e){U.showMessage(msg,e.message,"error");return;}
    const nAds=ads.filter(a=>a.moderation==="en_attente").length,nRep=reps.filter(r=>r.status==="ouvert").length,nVer=ver.filter(v=>v.status==="en_attente").length;
    U.qs("#admin-stats").innerHTML=[["Utilisateurs",users.length],["Annonces",ads.length],["Annonces à valider",nAds],["Signalements ouverts",nRep],["Vérifications en attente",nVer]].map(([l,v])=>`<div class="stat-card"><span>${l}</span><strong>${v}</strong></div>`).join("");
    const f=filter.value,shown=ads.filter(a=>f==="tous"||a.moderation===f);
    const mb={en_attente:"pending",approuvee:"available",rejetee:"unavailable"},ml={en_attente:"À valider",approuvee:"Publiée",rejetee:"Refusée"};
    U.qs("#admin-ads").innerHTML=table(["Annonce","Annonceur","Loyer","État","Actions"],shown.map(a=>`<tr><td><strong>${E(a.titre)}</strong><small>${E(a.commune)} · ${d(a.created_at)}</small></td><td>${E(a.profiles?`${a.profiles.prenom} ${a.profiles.nom}`:"—")}<small>${E(a.profiles?.telephone||a.telephone||"")}</small></td><td>${U.money(a.loyer)}</td><td><span class="status-badge static ${mb[a.moderation]}">${ml[a.moderation]}</span></td><td><div class="table-actions"><a class="mini-btn" href="maison-detail.html?id=${a.id}" target="_blank" rel="noopener">Voir</a>${a.moderation!=="approuvee"?`<button class="mini-btn" data-mod="${a.id}" data-to="approuvee">Approuver</button>`:""}${a.moderation!=="rejetee"?`<button class="mini-btn danger" data-mod="${a.id}" data-to="rejetee">Refuser</button>`:""}<button class="mini-btn danger" data-del="${a.id}">Supprimer</button></div></td></tr>`),"Aucune annonce dans cette catégorie.");
    U.qs("#admin-reports").innerHTML=table(["Annonce","Motif","Date","Statut","Action"],reps.map(r=>`<tr><td>${r.listings?`<a class="text-link" href="maison-detail.html?id=${r.listings.id}" target="_blank" rel="noopener">${E(r.listings.titre)}</a>`:"—"}</td><td>${E(r.reason)}<small>${E(r.details||"")}</small></td><td>${d(r.created_at)}</td><td>${E(r.status)}</td><td>${r.status==="ouvert"||r.status==="en_cours"?`<div class="table-actions"><button class="mini-btn" data-rep="${r.id}" data-to="traite">Traité</button><button class="mini-btn" data-rep="${r.id}" data-to="rejete">Rejeter</button></div>`:"—"}</td></tr>`),"Aucun signalement.");
    U.qs("#admin-verifications").innerHTML=table(["Compte","Document","Date","Statut","Action"],ver.map(v=>`<tr><td>${E(v.profiles?`${v.profiles.prenom} ${v.profiles.nom}`:"—")}<small>${E(v.profiles?.telephone||"")}</small></td><td>${E(v.document_type)}</td><td>${d(v.created_at)}</td><td>${E(v.status)}</td><td><div class="table-actions">${v.document_path?`<button class="mini-btn" data-doc="${E(v.document_path)}">Voir le document</button>`:""}${v.status==="en_attente"?`<button class="mini-btn" data-ver="${v.id}" data-ok="1">Valider</button><button class="mini-btn danger" data-ver="${v.id}" data-ok="0">Rejeter</button>`:""}</div></td></tr>`),"Aucune demande.");
    U.qs("#admin-users").innerHTML=table(["Nom","Téléphone","Rôle","Commune","Vérifié"],users.map(u=>`<tr><td>${E(u.prenom)} ${E(u.nom)}</td><td>${E(u.telephone||"")}</td><td>${E(u.role)}</td><td>${E(u.commune||"")}</td><td>${u.verifie?"✓":"—"}</td></tr>`),"Aucun utilisateur.");
    const q=s=>document.querySelectorAll(s);
    q("[data-mod]").forEach(b=>b.onclick=()=>run(()=>S.updateAnnonce(b.dataset.mod,{moderation:b.dataset.to}),"Annonce mise à jour"));
    q("[data-del]").forEach(b=>b.onclick=()=>{if(confirm("Supprimer définitivement cette annonce ?"))run(()=>S.supprimerAnnonce(b.dataset.del),"Annonce supprimée");});
    q("[data-rep]").forEach(b=>b.onclick=()=>run(()=>S.updateReport(b.dataset.rep,b.dataset.to),"Signalement mis à jour"));
    q("[data-ver]").forEach(b=>b.onclick=()=>{const ok=b.dataset.ok==="1",note=ok?null:prompt("Motif du refus (visible par l’utilisateur) :");if(!ok&&note===null)return;run(()=>S.decideVerification(b.dataset.ver,ok,note),ok?"Compte vérifié":"Demande refusée");});
    q("[data-doc]").forEach(b=>b.onclick=async()=>{const w=window.open("","_blank");try{w.location=await S.lienDocument(b.dataset.doc);}catch(e){w&&w.close();U.showMessage(msg,e.message,"error");}});
  }
  filter.addEventListener("change",render);render();
});
