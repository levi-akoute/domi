/* MODÈLE — copiez ce fichier en « config.js » (même dossier) puis remplissez les deux premières lignes. Si vous avez déjà un config.js, ne le remplacez pas. */
/* ═══ CONFIGURATION Domi — c'est le SEUL fichier à modifier pour brancher la base ═══
   Supabase > Project Settings > API : copiez « Project URL » et la clé « anon / publishable ».
   ⚠ Ne collez JAMAIS la clé « service_role » ici. */
window.IMMOCI_CONFIG = {
  SUPABASE_URL: "COLLE_ICI_TON_PROJECT_URL",
  SUPABASE_ANON_KEY: "COLLE_ICI_TA_CLE_ANON",
  SUPPORT_WHATSAPP: "2250544408852",      // numéro du support, format international sans + (ex. 2250700000000)
  EMAIL_DOMAIN: "immoci.app",             // sert à fabriquer l'identifiant interne à partir du numéro de téléphone
  COMMUNES: ["Abobo","Adjamé","Anyama","Attécoubé","Bingerville","Cocody","Koumassi","Marcory","Plateau","Port-Bouët","Songon","Treichville","Yopougon","Grand-Bassam","Yamoussoukro","Bouaké","Daloa","Korhogo","San-Pédro","Man","Gagnoa","Divo","Abengourou"]
};
