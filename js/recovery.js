/* ═══════════════════════════════════════════════════════════════════
   recovery.js : page « Mot de passe oublié » (mot-de-passe-oublie.html)

   Étape 1 : l'utilisateur saisit son numéro → la fonction serveur envoie
             un code à 6 chiffres sur son email de récupération.
   Étape 2 : il saisit le code + son nouveau mot de passe → la fonction
             serveur vérifie le code et change le mot de passe.
   Le travail sensible est fait côté serveur (supabase/functions/…) :
   ce fichier ne fait qu'afficher les étapes et transmettre les saisies.
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const U = window.ImmoUtils; // boîte à outils
  const S = window.ImmoStorage; // accès à la base et à la fonction serveur
  const ask = U.qs("#step-ask"); // formulaire de l'étape 1
  const reset = U.qs("#step-reset"); // formulaire de l'étape 2
  const msg = U.qs("#recovery-message"); // zone des messages
  let telephone = ""; // numéro saisi à l'étape 1, réutilisé à l'étape 2

  // Lien de secours vers le support WhatsApp (pour les comptes sans email)
  U.qs("#support-link").href = U.supportLink(
    "Bonjour, j’ai oublié le mot de passe de mon compte Domi. Mon numéro : "
  );

  // Désactive le bouton pendant l'envoi (évite les doubles clics) et change son texte
  const busy = (form, on, label) => {
    const b = form.querySelector("button[type=submit]");
    b.disabled = on;
    if (label) b.textContent = label;
  };

  // Demande un code puis passe à l'étape 2
  async function envoyerCode() {
    const res = await S.demanderCodeReset(telephone); // appel de la fonction serveur
    U.qs("#reset-intro").textContent = res.message; // « Si ce numéro correspond… »
    ask.classList.add("hidden"); // cache l'étape 1
    reset.classList.remove("hidden"); // montre l'étape 2
    msg.classList.add("hidden"); // efface les anciens messages
    reset.elements.code.focus(); // place le curseur dans le champ du code
  }

  // ÉTAPE 1 : envoi du numéro
  ask.addEventListener("submit", async (e) => {
    e.preventDefault(); // pas de rechargement de page
    try {
      telephone = window.ImmoAuth.normalize(ask.elements.telephone.value); // vérifie le format (10 chiffres)
    } catch (err) {
      U.showMessage(msg, err.message, "error"); // numéro mal saisi
      return;
    }
    busy(ask, true, "Envoi en cours…");
    try {
      await envoyerCode();
    } catch (err) {
      U.showMessage(msg, err.message, "error"); // service indisponible…
    }
    busy(ask, false, "Recevoir un code");
  });

  // ÉTAPE 2 : envoi du code et du nouveau mot de passe
  reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(reset); // lit les champs
    if (d.get("password") !== d.get("password2")) {
      // les deux saisies doivent être identiques
      U.showMessage(msg, "Les deux mots de passe ne sont pas identiques.", "error");
      return;
    }
    busy(reset, true, "Vérification…");
    try {
      const res = await S.validerCodeReset(telephone, d.get("code"), d.get("password"));
      reset.classList.add("hidden"); // succès : on cache le formulaire
      U.showMessage(msg, res.message, "success"); // « Mot de passe modifié »
      msg.insertAdjacentHTML(
        "beforeend",
        ' <a class="text-link" href="connexion.html">Se connecter →</a>' // lien vers la connexion
      );
    } catch (err) {
      U.showMessage(msg, err.message, "error"); // code faux, expiré, trop d'essais…
      busy(reset, false, "Changer mon mot de passe");
    }
  });

  // « Renvoyer un code »
  U.qs("#resend").addEventListener("click", async () => {
    try {
      await envoyerCode();
      U.toast("Nouveau code demandé");
    } catch (err) {
      U.showMessage(msg, err.message, "error");
    }
  });

  // « Changer de numéro » : retour à l'étape 1
  U.qs("#change-number").addEventListener("click", () => {
    reset.classList.add("hidden");
    ask.classList.remove("hidden");
    msg.classList.add("hidden");
  });
});
