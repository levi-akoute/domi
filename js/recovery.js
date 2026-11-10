document.addEventListener("DOMContentLoaded", () => {
  const a = document.getElementById("support-link");
  if (a)
    a.href = window.ImmoUtils.supportLink(
      "Bonjour, j’ai oublié le mot de passe de mon compte Domi. Mon numéro : "
    );
});
