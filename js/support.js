/* ═══════════════════════════════════════════════════════════════════
   support.js : page « Support » (support.html)

   Les liens WhatsApp de la page portent un attribut data-wa="message".
   Ce script les transforme en vrais liens wa.me avec ce message pré-rempli,
   et affiche le numéro du support joliment formaté.
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const U = window.ImmoUtils; // boîte à outils

  // Pour chaque lien qui a un attribut data-wa…
  document.querySelectorAll("[data-wa]").forEach((a) => {
    a.href = U.supportLink(a.dataset.wa); // …lien WhatsApp vers le support avec le message
    a.target = "_blank"; // ouverture dans un nouvel onglet / l'application WhatsApp
    a.rel = "noopener"; // sécurité : la nouvelle page ne peut pas contrôler celle-ci
  });

  const n = U.supportNumber(); // ex. "2250544408852"
  const el = document.getElementById("support-number"); // où afficher le numéro
  if (el)
    // "2250544408852" → "+225 05 44 40 88 52" : indicatif, puis les chiffres 2 par 2
    el.textContent = "+" + n.slice(0, 3) + " " + (n.slice(3).match(/.{1,2}/g) || []).join(" ");
});
