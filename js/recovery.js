document.addEventListener("DOMContentLoaded",()=>{
  const n=(window.IMMOCI_CONFIG||{}).SUPPORT_WHATSAPP,a=document.getElementById("support-link");
  if(a&&n)a.href="https://wa.me/"+n+"?text="+encodeURIComponent("Bonjour, j’ai oublié le mot de passe de mon compte Domi. Mon numéro : ");
});
