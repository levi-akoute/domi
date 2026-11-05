document.addEventListener("DOMContentLoaded",()=>{
  const U=window.ImmoUtils;
  document.querySelectorAll("[data-wa]").forEach(a=>{a.href=U.supportLink(a.dataset.wa);a.target="_blank";a.rel="noopener";});
  const n=U.supportNumber(),el=document.getElementById("support-number");
  if(el)el.textContent="+"+n.slice(0,3)+" "+(n.slice(3).match(/.{1,2}/g)||[]).join(" ");
});
