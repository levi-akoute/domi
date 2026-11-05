(function(){
  const U=window.ImmoUtils,S=window.ImmoStorage,PAGE=12,FALLBACK="assets/img/placeholder.svg";
  let all=[],shown=PAGE;
  const rating=a=>Number(a.nb_avis)>0?`${U.icon("star")} ${String(a.note_moyenne).replace(".",",")} <small>· ${a.nb_avis} avis</small>`:"<small>Pas encore d’avis</small>";
  function card(a){
    const I=U.icon,href="maison-detail.html?id="+encodeURIComponent(a.id),img=a.image||FALLBACK,dispo=a.statut==="Disponible";
    return `<article class="listing-card"><a class="listing-image" href="${href}"><img src="${U.escapeHtml(img)}" alt="${U.escapeHtml(a.titre)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'"><span class="status-badge ${dispo?"available":"unavailable"}">${U.escapeHtml(a.statut||"")}</span>${a.proprietaire_verifie?`<span class="verified-badge">${I("check")} Vérifié</span>`:""}${a.video?`<span class="video-badge">${I("play")} Visite vidéo</span>`:""}</a><div class="listing-body"><div class="listing-location">${I("pin")} ${U.escapeHtml(a.commune)}${a.quartier?" · "+U.escapeHtml(a.quartier):""}</div><h3><a href="${href}">${U.escapeHtml(a.titre)}</a></h3><div class="listing-meta"><span>${U.escapeHtml(a.type)}</span><span>${I("bed")} ${Number(a.chambres)||0} ch.</span></div><div class="listing-price">${U.money(a.loyer)} <small>/ mois</small></div><div class="rt">${rating(a)}</div><div class="listing-bottom"><span class="freshness">Confirmée ${U.daysAgo(a.confirmee_le)}</span><a class="arrow-link" href="${href}" aria-label="Voir l’annonce">${I("arrow")}</a></div></div></article>`;
  }
  const skeleton=n=>Array.from({length:n},()=>'<div class="listing-card skeleton"></div>').join("");
  function filtered(){
    const v=s=>U.qs(s)?.value||"",q=v("#filter-q").trim().toLowerCase(),commune=v("#filter-commune"),type=v("#filter-type"),budget=Number(v("#filter-budget"))||Infinity,status=v("#filter-status"),sort=v("#filter-sort");
    const r=all.filter(a=>(!q||`${a.titre} ${a.commune} ${a.quartier} ${a.description}`.toLowerCase().includes(q))&&(!commune||a.commune===commune)&&(!type||a.type===type)&&Number(a.loyer)<=budget&&(!status||a.statut===status));
    if(sort==="prix-asc")r.sort((a,b)=>a.loyer-b.loyer);else if(sort==="prix-desc")r.sort((a,b)=>b.loyer-a.loyer);
    return r;
  }
  function renderCatalog(){
    const items=filtered();U.qs("#all-listings").innerHTML=items.slice(0,shown).map(card).join("");
    U.qs("#results-count").textContent=`${items.length} annonce${items.length>1?"s":""}`;
    U.qs("#empty-state").classList.toggle("hidden",items.length>0);
    U.qs("#load-more").classList.toggle("hidden",items.length<=shown);
  }
  async function initCatalog(){
    U.fillCommunes(U.qs("#filter-commune"),"Toutes les communes");
    const p=new URLSearchParams(location.search);
    U.qs("#filter-commune").value=p.get("commune")||"";U.qs("#filter-type").value=p.get("type")||"";U.qs("#filter-budget").value=p.get("budget")||"";
    const ids=["#filter-q","#filter-commune","#filter-type","#filter-budget","#filter-status","#filter-sort"];
    ids.forEach(s=>U.qs(s).addEventListener("input",()=>{shown=PAGE;renderCatalog();}));
    U.qs("#reset-filters").addEventListener("click",()=>{ids.forEach(s=>U.qs(s).value="");shown=PAGE;renderCatalog();});
    U.qs("#load-more").addEventListener("click",()=>{shown+=PAGE;renderCatalog();});
    U.qs("#all-listings").innerHTML=skeleton(6);
    try{all=await S.getAnnonces();}catch(e){U.qs("#all-listings").innerHTML="";U.qs("#empty-state").classList.remove("hidden");U.qs("#empty-state").innerHTML=`<h3>Chargement impossible</h3><p>${U.escapeHtml(e.message)}</p>`;return;}
    renderCatalog();
  }
  async function initHome(){
    U.fillCommunes(U.qs("#search-commune"),"Toutes les communes");
    const host=U.qs("#home-listings");host.innerHTML=skeleton(3);
    try{const dispo=(await S.getAnnonces()).filter(a=>a.statut==="Disponible"),list=dispo.slice(0,8);if(window.ImmoCarousel)window.ImmoCarousel.addListings(dispo);host.innerHTML=list.length?list.map(card).join(""):'<div class="empty-state" style="grid-column:1/-1"><h3>Les premières annonces arrivent bientôt</h3><p>Vous proposez un bien ? Soyez parmi les premiers à publier.</p></div>';}
    catch(e){host.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><p>${U.escapeHtml(e.message)}</p></div>`;}
    U.qs("#home-search")?.addEventListener("submit",e=>{e.preventDefault();const p=new URLSearchParams(),c=U.qs("#search-commune").value,t=U.qs("#search-type").value,b=U.qs("#search-budget").value;if(c)p.set("commune",c);if(t)p.set("type",t);if(b)p.set("budget",b);location.href="annonces.html?"+p;});
  }
  document.addEventListener("DOMContentLoaded",()=>{if(U.qs("#all-listings"))initCatalog();if(U.qs("#home-listings"))initHome();});
})();
