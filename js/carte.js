/* ═══════════════════════════════════════════════════════════════════
   carte.js : carte OpenStreetMap (v8.2)

   Utilisé par : publier.html (l'annonceur place une épingle) et
   maison-detail.html (le visiteur voit une zone).

   Librairie : Leaflet 1.9.4 (licence BSD), rangée sur Domi dans assets/vendor/leaflet/
   (pas de CDN : la page reste rapide, et la règle de sécurité CSP reste stricte).
   Fond de carte : OpenStreetMap, gratuit et sans compte. Il faut afficher
   « © OpenStreetMap » (fait ci-dessous) et rester raisonnable en nombre d'affichages.

   Rien n'est chargé tant qu'on n'ouvre pas la carte : un visiteur qui ne la regarde pas
   ne consomme rien sur son forfait.

   Expose : window.ImmoCarte
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  // Centre approximatif de chaque commune : sert à placer la carte du formulaire au bon endroit.
  const CENTRES = {
    Abobo: [5.418, -4.02],
    Adjamé: [5.365, -4.024],
    Anyama: [5.4945, -4.0516],
    Attécoubé: [5.344, -4.033],
    Bingerville: [5.3556, -3.8854],
    Cocody: [5.36, -3.97],
    Koumassi: [5.2965, -3.953],
    Marcory: [5.303, -3.9826],
    Plateau: [5.323, -4.0167],
    "Port-Bouët": [5.2555, -3.93],
    Songon: [5.313, -4.255],
    Treichville: [5.2986, -4.008],
    Yopougon: [5.345, -4.087],
    "Grand-Bassam": [5.2118, -3.7388],
    Yamoussoukro: [6.8276, -5.2893],
    Bouaké: [7.6906, -5.0303],
    Daloa: [6.8774, -6.4502],
    Korhogo: [9.458, -5.6296],
    "San-Pédro": [4.7485, -6.6363],
    Man: [7.4125, -7.5538],
    Gagnoa: [6.1319, -5.9506],
    Divo: [5.8372, -5.3572],
    Abengourou: [6.7297, -3.4964],
  };
  const PAYS = [7.5, -5.5]; // centre de la Côte d'Ivoire (aucune commune choisie)

  // Limites de la Côte d'Ivoire, avec une petite marge (même règle dans la base, database/14)
  const dansLePays = (lat, lng) => lat >= 4.2 && lat <= 10.9 && lng >= -8.8 && lng <= -2.3;

  // Charge Leaflet une seule fois (style + programme) et renvoie window.L
  let promesse = null;
  function charger() {
    if (promesse) return promesse;
    promesse = new Promise((ok, ko) => {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "assets/vendor/leaflet/leaflet.css";
      const prog = document.createElement("script");
      prog.src = "assets/vendor/leaflet/leaflet.js";
      prog.onload = () => (window.L ? ok(window.L) : ko(new Error("carte")));
      prog.onerror = () => {
        promesse = null; // on pourra réessayer
        ko(new Error("La carte n’a pas pu se charger. Vérifiez votre connexion."));
      };
      document.head.append(style, prog);
    });
    return promesse;
  }

  // Crée une carte dans le bloc donné, centrée sur [latitude, longitude]
  function creer(L, bloc, centre, zoom) {
    const carte = L.map(bloc, { scrollWheelZoom: false }).setView(centre, zoom); // molette : la page défile
    carte.attributionControl.setPrefix(false); // seulement « © OpenStreetMap » (obligatoire), sans le logo de Leaflet
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(carte);
    return carte;
  }

  // Épingle orange dessinée (pas d'image à télécharger). Textes fixes : aucun risque d'injection.
  const epingle = (L) =>
    L.divIcon({
      className: "epingle",
      html: '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 41S3 27 3 15.5a13 13 0 0 1 26 0C29 27 16 41 16 41z"/><circle cx="16" cy="15.5" r="5"/></svg>',
      iconSize: [32, 42],
      iconAnchor: [16, 41], // la pointe de l'épingle
    });

  // Zone publique : cercle d'environ 300 m autour du point arrondi (le logement est à l'intérieur)
  const zone = (L, centre) =>
    L.circle(centre, {
      radius: 300,
      color: "#0b3b35",
      weight: 2,
      fillColor: "#e07a1f",
      fillOpacity: 0.18,
    });

  window.ImmoCarte = {
    charger,
    creer,
    epingle,
    zone,
    dansLePays,
    centreCommune: (nom) => CENTRES[nom] || null,
    PAYS,
  };
})();
