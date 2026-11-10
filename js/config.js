/* ═══════════════════════════════════════════════════════════════════
   config.js : LE fichier de réglages de Domi
   C'est le seul fichier à modifier pour brancher le site à SA base Supabase.

   Chargé en 2e position sur chaque page (juste après la librairie Supabase).
   Expose : window.IMMOCI_CONFIG (lu par utils.js, storage.js et auth.js)

   Où trouver les valeurs ? Supabase > Project Settings > API :
     • « Project URL »            → SUPABASE_URL
     • clé « anon / publishable » → SUPABASE_ANON_KEY

   Cette clé « anon » est PUBLIQUE par nature : elle donne seulement les droits
   d'un visiteur anonyme, et les règles RLS de la base décident du reste.
   ⚠ Ne collez JAMAIS ici la clé « service_role » : elle ignore toutes les
   règles de sécurité et donnerait à n'importe qui le contrôle total de la base.
   ═══════════════════════════════════════════════════════════════════ */

// window.IMMOCI_CONFIG : objet global (accessible depuis tous les autres fichiers JS)
window.IMMOCI_CONFIG = {
  // Adresse du projet Supabase (forme https://xxxx.supabase.co)
  SUPABASE_URL: "https://mplbhzqmffaywlhbxleb.supabase.co",

  // Clé publique « anon » du projet (commence par eyJ… ou sb_publishable_…)
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGJoenFtZmZheXdsaGJ4bGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MjkxNzAsImV4cCI6MjEwOTEwNTE3MH0.EFVGKrZL5pQtelt2nAYfPoropXLtbk3LzMThX5qjTjc",

  // Numéro WhatsApp du support : format international, sans « + » ni espaces
  SUPPORT_WHATSAPP: "2250160034870",

  // Domaine des identifiants internes : le numéro 0700000000 devient 0700000000@immoci.app.
  // ⚠ NE JAMAIS MODIFIER : tous les comptes existants ne pourraient plus se connecter.
  EMAIL_DOMAIN: "immoci.app",

  // Communes proposées dans les listes déroulantes (filtres, inscription, publication).
  // Pour en ajouter une : ajoutez une ligne "Nom", à l'endroit voulu.
  COMMUNES: [
    "Abobo", // commune d'Abidjan
    "Adjamé", // commune d'Abidjan
    "Anyama", // commune d'Abidjan
    "Attécoubé", // commune d'Abidjan
    "Bingerville", // commune d'Abidjan
    "Cocody", // commune d'Abidjan
    "Koumassi", // commune d'Abidjan
    "Marcory", // commune d'Abidjan
    "Plateau", // commune d'Abidjan
    "Port-Bouët", // commune d'Abidjan
    "Songon", // commune d'Abidjan
    "Treichville", // commune d'Abidjan
    "Yopougon", // commune d'Abidjan
    "Grand-Bassam", // ville proche d'Abidjan
    "Yamoussoukro", // capitale politique
    "Bouaké", // ville de l'intérieur
    "Daloa", // ville de l'intérieur
    "Korhogo", // ville de l'intérieur
    "San-Pédro", // ville de l'intérieur
    "Man", // ville de l'intérieur
    "Gagnoa", // ville de l'intérieur
    "Divo", // ville de l'intérieur
    "Abengourou", // ville de l'intérieur
  ], // fin de la liste des communes
}; // fin de l'objet de configuration
