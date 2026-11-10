/* ═══════════════════════════════════════════════════════════════════
   recovery.js : page « Mot de passe oublié » (mot-de-passe-oublie.html)

   Étape 1 : l'utilisateur saisit son numéro → la fonction serveur envoie
             un code à 6 chiffres sur son email de récupération.
   Étape 2 : il saisit le code + son nouveau mot de passe → la fonction
             serveur vérifie le code et change le mot de passe.
   Le travail sensible est fait côté serveur (supabase/functions/...).
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const U = window.ImmoUtils;
  const S = window.ImmoStorage;
  const ask = U.qs("#step-ask");
  const reset = U.qs("#step-reset");
  const msg = U.qs("#recovery-message");
  let telephone = ""; // numéro saisi à l'étape 1, réutilisé à l'étape 2

  U.qs("#support-link").href = U.supportLink(
    "Bonjour, j’ai oublié le mot de passe de mon compte Domi. Mon numéro : "
  );

  // Désactive le bouton pendant l'envoi pour éviter les doubles clics
  const busy = (form, on, label) => {
    const b = form.querySelector("button[type=submit]");
    b.disabled = on;
    if (label) b.textContent = label;
  };

  async function envoyerCode() {
    const res = await S.demanderCodeReset(telephone);
    U.qs("#reset-intro").textContent = res.message;
    ask.classList.add("hidden");
    reset.classList.remove("hidden");
    msg.classList.add("hidden");
    reset.elements.code.focus();
  }

  ask.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      telephone = window.ImmoAuth.normalize(ask.elements.telephone.value); // vérifie le format
    } catch (err) {
      U.showMessage(msg, err.message, "error");
      return;
    }
    busy(ask, true, "Envoi en cours…");
    try {
      await envoyerCode();
    } catch (err) {
      U.showMessage(msg, err.message, "error");
    }
    busy(ask, false, "Recevoir un code");
  });

  reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(reset);
    if (d.get("password") !== d.get("password2")) {
      U.showMessage(msg, "Les deux mots de passe ne sont pas identiques.", "error");
      return;
    }
    busy(reset, true, "Vérification…");
    try {
      const res = await S.validerCodeReset(telephone, d.get("code"), d.get("password"));
      reset.classList.add("hidden");
      U.showMessage(msg, res.message, "success");
      msg.insertAdjacentHTML(
        "beforeend",
        ' <a class="text-link" href="connexion.html">Se connecter →</a>'
      );
    } catch (err) {
      U.showMessage(msg, err.message, "error");
      busy(reset, false, "Changer mon mot de passe");
    }
  });

  U.qs("#resend").addEventListener("click", async () => {
    try {
      await envoyerCode();
      U.toast("Nouveau code demandé");
    } catch (err) {
      U.showMessage(msg, err.message, "error");
    }
  });
  U.qs("#change-number").addEventListener("click", () => {
    reset.classList.add("hidden");
    ask.classList.remove("hidden");
    msg.classList.add("hidden");
  });
});
