/* ═══ CONFIGURATION ImmoCI — c'est le SEUL fichier à modifier pour brancher la base ═══
   Supabase > Project Settings > API : copiez « Project URL » et la clé « anon / publishable ».
   ⚠ Ne collez JAMAIS la clé « service_role » ici. */
window.IMMOCI_CONFIG = {
  SUPABASE_URL: "https://mplbhzqmffaywlhbxleb.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGJoenFtZmZheXdsaGJ4bGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MjkxNzAsImV4cCI6MjEwOTEwNTE3MH0.EFVGKrZL5pQtelt2nAYfPoropXLtbk3LzMThX5qjTjc",
  SUPPORT_WHATSAPP: "2250160034870", // numéro du support, format international sans + (ex. 2250700000000)
  EMAIL_DOMAIN: "immoci.app", // sert à fabriquer l'identifiant interne à partir du numéro de téléphone
  COMMUNES: [
    "Abobo",
    "Adjamé",
    "Anyama",
    "Attécoubé",
    "Bingerville",
    "Cocody",
    "Koumassi",
    "Marcory",
    "Plateau",
    "Port-Bouët",
    "Songon",
    "Treichville",
    "Yopougon",
    "Grand-Bassam",
    "Yamoussoukro",
    "Bouaké",
    "Daloa",
    "Korhogo",
    "San-Pédro",
    "Man",
    "Gagnoa",
    "Divo",
    "Abengourou",
  ],
};
``;
