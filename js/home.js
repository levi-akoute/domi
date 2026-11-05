/* Carrousel de la page d'accueil : défilement automatique, points, flèches, glissement au doigt, pause au survol */
(function(){
  const U=window.ImmoUtils,reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let idx=0,timer=null,paused=false;
  const slides=()=>document.querySelectorAll("#slides .slide");
  function go(i){
    const n=slides().length;if(!n)return;idx=(i+n)%n;
    U.qs("#slides").style.transform=`translateX(-${idx*100}%)`;
    document.querySelectorAll("#banner-dots button").forEach((d,k)=>{d.classList.toggle("on",k===idx);d.setAttribute("aria-current",String(k===idx));});
    slides().forEach((s,k)=>s.setAttribute("aria-hidden",String(k!==idx)));
  }
  function restart(){clearInterval(timer);if(!reduce)timer=setInterval(()=>{if(!paused)go(idx+1);},5000);}
  function buildDots(){
    U.qs("#banner-dots").innerHTML=Array.from({length:slides().length},(_,k)=>`<button type="button" aria-label="Aller à la bannière ${k+1}"></button>`).join("");
    document.querySelectorAll("#banner-dots button").forEach((b,k)=>b.addEventListener("click",()=>{go(k);restart();}));
    go(idx);
  }
  function addListings(list){
    const track=U.qs("#slides");if(!track)return;
    list.filter(a=>a.image).slice(0,3).forEach(a=>track.insertAdjacentHTML("beforeend",`<a class="slide photo" href="maison-detail.html?id=${encodeURIComponent(a.id)}"><img src="${U.escapeHtml(a.image)}" alt="${U.escapeHtml(a.titre)}" loading="lazy"><span class="tag"><small>${U.escapeHtml(a.commune)}${a.quartier?" · "+U.escapeHtml(a.quartier):""}</small><strong>${U.escapeHtml(a.titre)}</strong><b>${U.money(a.loyer)} / mois</b></span></a>`));
    buildDots();
  }
  document.addEventListener("DOMContentLoaded",()=>{
    const root=U.qs("#banner");if(!root)return;
    buildDots();restart();
    U.qs("#banner-prev").addEventListener("click",()=>{go(idx-1);restart();});
    U.qs("#banner-next").addEventListener("click",()=>{go(idx+1);restart();});
    ["mouseenter","focusin"].forEach(e=>root.addEventListener(e,()=>{paused=true;}));
    ["mouseleave","focusout"].forEach(e=>root.addEventListener(e,()=>{paused=false;}));
    let x0=null;
    root.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;},{passive:true});
    root.addEventListener("touchend",e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40){go(idx+(dx<0?1:-1));restart();}x0=null;});
  });
  window.ImmoCarousel={addListings};
})();
