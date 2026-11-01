document.addEventListener("DOMContentLoaded",async()=>{
  const U=window.ImmoUtils,tabs=[...document.querySelectorAll("[data-tab]")],login=U.qs("#login-form"),register=U.qs("#register-form"),msg=U.qs("#auth-message");
  U.fillCommunes(register.elements.commune);
  function tab(n){tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===n));login.classList.toggle("hidden",n!=="login");register.classList.toggle("hidden",n!=="register");U.qs("#auth-title").textContent=n==="login"?"Bienvenue sur Domi":"Créez votre espace annonceur";msg.classList.add("hidden");}
  tabs.forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));if(U.getParam("inscription"))tab("register");
  const u0=await ImmoAuth.currentUser();if(u0){location.href=u0.role==="admin"?"admin.html":"dashboard-proprietaire.html";return;}
  const busy=(f,on)=>f.querySelectorAll("button").forEach(b=>b.disabled=on);
  login.addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(login);busy(login,true);
    try{const u=await ImmoAuth.login(d.get("telephone"),d.get("password"));location.href=u&&u.role==="admin"?"admin.html":"dashboard-proprietaire.html";}
    catch(err){U.showMessage(msg,err.message,"error");busy(login,false);}});
  register.addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(register);busy(register,true);
    try{await ImmoAuth.register({nom:d.get("nom").trim(),prenom:d.get("prenom").trim(),telephone:d.get("telephone"),role:d.get("role"),commune:d.get("commune"),password:d.get("password")});location.href="dashboard-proprietaire.html";}
    catch(err){U.showMessage(msg,err.message,"error");busy(register,false);}});
});
