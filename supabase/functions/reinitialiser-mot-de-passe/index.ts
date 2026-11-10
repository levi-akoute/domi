// ═══════════════════════════════════════════════════════════════════
// Edge Function « reinitialiser-mot-de-passe » (Domi v6)
//
// S'exécute sur les serveurs de Supabase, JAMAIS dans le navigateur.
// C'est pour ça qu'elle a le droit d'utiliser la clé service_role
// (fournie automatiquement par Supabase dans SUPABASE_SERVICE_ROLE_KEY).
// Personne ne peut lire ce code ni cette clé avec « Inspecter ».
//
// Deux actions, appelées depuis mot-de-passe-oublie.html :
//   { action: "demander", telephone }                  → envoie un code par email
//   { action: "valider",  telephone, code, password }  → change le mot de passe
//
// Secrets à définir dans Supabase (Edge Functions > Secrets) :
//   BREVO_API_KEY       clé API Brevo (envoi des emails)
//   BREVO_SENDER_EMAIL  adresse expéditrice validée dans Brevo
//   SITE_ORIGINS        (facultatif) adresses autorisées en plus, séparées par des virgules,
//                       ex. « https://domi.ci,https://www.domi.ci » quand vous aurez un domaine
// Guide pas à pas : docs/GUIDE_MOT_DE_PASSE_OUBLIE.md
// ═══════════════════════════════════════════════════════════════════

// Librairie officielle Supabase (même version que le site)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// ───────── Réglages ─────────
const CODE_VALIDITE_MIN = 10; // un code est valable 10 minutes
const MAX_ESSAIS = 5; // 5 essais par code, ensuite il est annulé
const MAX_DEMANDES_HEURE = 3; // 3 codes envoyés par compte et par heure
const MDP_MIN = 8; // longueur minimale du nouveau mot de passe

// ───────── Sites autorisés à appeler cette fonction (CORS) ─────────
// Le navigateur refuse d'afficher la réponse à un site qui n'est pas dans cette liste.
// (C'est une protection en plus : la vraie sécurité est le code, le hash et les limites.)
const ORIGINES = new Set([
  "https://levi-akoute.github.io", // le site en ligne
  "http://127.0.0.1:5500", // Live Server de VS Code (tests sur ton PC)
  "http://localhost:5500", // Live Server (autre écriture)
  ...(Deno.env.get("SITE_ORIGINS") ?? "") // adresses en plus (nom de domaine futur)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]);

// En-têtes CORS adaptés à la requête reçue
function cors(req: Request): Record<string, string> {
  const origine = req.headers.get("Origin") ?? ""; // site qui appelle
  return {
    // On ne renvoie l'origine que si elle est autorisée (sinon le navigateur bloque)
    "Access-Control-Allow-Origin": ORIGINES.has(origine) ? origine : "https://levi-akoute.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", // en-têtes acceptés
    "Access-Control-Allow-Methods": "POST, OPTIONS", // méthodes acceptées
    Vary: "Origin", // la réponse dépend de l'origine (pour les caches)
  };
}

// On répond toujours 200 avec { ok, message } : le site affiche simplement le message.
const reponse = (req: Request, ok: boolean, message: string) =>
  new Response(JSON.stringify({ ok, message }), {
    headers: { ...cors(req), "Content-Type": "application/json" },
  });

// Client Supabase « administrateur » : il ignore les règles RLS (clé service_role).
// Il ne sort JAMAIS de ce serveur.
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!, // adresse du projet (fournie par Supabase)
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // clé secrète (fournie par Supabase)
  { auth: { persistSession: false } } // pas de session à garder côté serveur
);

// Même règle que js/auth.js : 10 chiffres, l'indicatif 225 est retiré s'il est présent
function normaliser(tel: unknown): string | null {
  let d = String(tel ?? "").replace(/\D/g, ""); // chiffres uniquement
  if (d.length === 13 && d.startsWith("225")) d = d.slice(3); // retire l'indicatif
  return /^\d{10}$/.test(d) ? d : null; // 10 chiffres, sinon null
}

// Empreinte SHA-256 du code, « salée » avec l'identifiant de l'utilisateur.
// On ne garde JAMAIS le code en clair dans la base, seulement cette empreinte.
async function empreinte(userId: string, code: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${code}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); // en hexadécimal
}

// Comparaison « à temps constant » : prend toujours le même temps, que les textes
// diffèrent dès le 1er caractère ou au dernier. Empêche de deviner un code en
// mesurant les temps de réponse (attaque « temporelle »).
function egaux(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); // accumule les différences
  return diff === 0;
}

// Code à 6 chiffres tiré avec un générateur cryptographique (pas Math.random, prévisible)
function nouveauCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000; // nombre de 0 à 999 999
  return String(n).padStart(6, "0"); // complété par des zéros : « 004213 »
}

// Envoi de l'email contenant le code, via l'API de Brevo
async function envoyerEmail(to: string, prenom: string, code: string): Promise<boolean> {
  const apiKey = Deno.env.get("BREVO_API_KEY"); // clé Brevo (secret)
  const sender = Deno.env.get("BREVO_SENDER_EMAIL"); // expéditeur validé
  if (!apiKey || !sender) {
    console.error("BREVO_API_KEY ou BREVO_SENDER_EMAIL manquant dans les secrets"); // visible dans Logs
    return false;
  }
  // Le prénom vient de la base : on retire les caractères HTML par précaution
  const p = prenom.replace(/[<>&"']/g, "");
  const bonjour = p ? `Bonjour ${p},` : "Bonjour,";
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Domi", email: sender }, // expéditeur affiché
      to: [{ email: to }], // destinataire
      subject: `${code} est votre code Domi`, // objet (le code visible dans la notification)
      // Version texte (pour les messageries simples)
      textContent: `${bonjour}\n\nVotre code pour choisir un nouveau mot de passe Domi : ${code}\nIl est valable ${CODE_VALIDITE_MIN} minutes.\n\nVous n'avez rien demandé ? Ignorez cet email, votre mot de passe reste inchangé.\n\nL'équipe Domi`,
      // Version mise en forme
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#15201E">
        <h2 style="color:#0B3B35">Domi<span style="color:#E07A1F">.</span></h2>
        <p>${bonjour}</p>
        <p>Votre code pour choisir un nouveau mot de passe :</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0B3B35;background:#F7F4EE;padding:16px;text-align:center;border-radius:12px">${code}</p>
        <p>Il est valable <b>${CODE_VALIDITE_MIN} minutes</b>.</p>
        <p style="color:#5C6965;font-size:13px">Vous n'avez rien demandé ? Ignorez cet email, votre mot de passe reste inchangé. Domi ne vous demandera jamais ce code par téléphone ou WhatsApp.</p>
      </div>`,
    }),
  });
  if (!res.ok) console.error("Brevo a refusé l'envoi :", res.status, await res.text()); // pour les Logs
  return res.ok;
}

// ───────── Action 1 : envoyer un code ─────────
// SÉCURITÉ : la réponse est IDENTIQUE que le numéro existe ou non. Sinon, n'importe
// qui pourrait tester des numéros pour savoir qui est inscrit sur Domi.
const MSG_ENVOI =
  "Si ce numéro correspond à un compte avec un email de récupération, un code vient d’être envoyé. Pensez à regarder dans vos spams.";

async function demander(req: Request, tel: string) {
  // Profil correspondant au numéro
  const { data: profil } = await admin
    .from("profiles")
    .select("id, prenom, email_recuperation")
    .eq("telephone", tel)
    .maybeSingle();
  if (!profil?.email_recuperation) return reponse(req, true, MSG_ENVOI); // pas de compte ou pas d'email : même message

  // Ménage : supprime les codes de ce compte vieux de plus d'un jour
  await admin
    .from("password_resets")
    .delete()
    .eq("user_id", profil.id)
    .lt("created_at", new Date(Date.now() - 86400_000).toISOString());

  // Limite : 3 codes par heure et par compte (évite le harcèlement par email)
  const ilYaUneHeure = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("password_resets")
    .select("id", { count: "exact", head: true }) // on compte sans télécharger les lignes
    .eq("user_id", profil.id)
    .gte("created_at", ilYaUneHeure);
  if ((count ?? 0) >= MAX_DEMANDES_HEURE) return reponse(req, true, MSG_ENVOI); // limite atteinte : même message

  // Un seul code actif à la fois : les anciens sont annulés
  await admin
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", profil.id)
    .is("used_at", null);

  const code = nouveauCode(); // nouveau code
  await admin.from("password_resets").insert({
    user_id: profil.id,
    code_hash: await empreinte(profil.id, code), // seulement l'empreinte
    expires_at: new Date(Date.now() + CODE_VALIDITE_MIN * 60_000).toISOString(), // expiration
  });
  await envoyerEmail(profil.email_recuperation, profil.prenom ?? "", code); // envoi
  return reponse(req, true, MSG_ENVOI);
}

// ───────── Action 2 : vérifier le code et changer le mot de passe ─────────
async function valider(req: Request, tel: string, code: unknown, password: unknown) {
  const c = String(code ?? "").trim(); // code saisi
  const pw = String(password ?? ""); // nouveau mot de passe
  if (!/^\d{6}$/.test(c)) return reponse(req, false, "Le code contient 6 chiffres.");
  if (pw.length < MDP_MIN)
    return reponse(req, false, `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`);
  if (pw.length > 72) return reponse(req, false, "Mot de passe trop long (72 caractères maximum).");

  // Message volontairement identique pour « numéro inconnu » et « pas de code valide »
  const INVALIDE = "Code invalide ou expiré. Demandez un nouveau code.";
  const { data: profil } = await admin
    .from("profiles")
    .select("id")
    .eq("telephone", tel)
    .maybeSingle();
  if (!profil) return reponse(req, false, INVALIDE);

  // Dernier code non utilisé et non expiré
  const { data: reset } = await admin
    .from("password_resets")
    .select("*")
    .eq("user_id", profil.id)
    .is("used_at", null) // pas encore utilisé
    .gt("expires_at", new Date().toISOString()) // pas expiré
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reset) return reponse(req, false, INVALIDE);

  // Mauvais code : on compte l'essai, et on annule le code au 5e échec
  if (!egaux(reset.code_hash, await empreinte(profil.id, c))) {
    const essais = reset.attempts + 1;
    await admin
      .from("password_resets")
      .update({ attempts: essais, used_at: essais >= MAX_ESSAIS ? new Date().toISOString() : null })
      .eq("id", reset.id);
    return essais >= MAX_ESSAIS
      ? reponse(req, false, "Trop d’essais. Ce code est annulé : demandez-en un nouveau.")
      : reponse(req, false, `Code incorrect. Il vous reste ${MAX_ESSAIS - essais} essai(s).`);
  }

  // Code correct : on change le mot de passe avec les droits administrateur
  const { error } = await admin.auth.admin.updateUserById(profil.id, { password: pw });
  if (error) return reponse(req, false, "Le mot de passe n’a pas pu être changé : " + error.message);
  // Le code est « consommé » : il ne pourra plus servir
  await admin
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", reset.id);
  return reponse(req, true, "Mot de passe modifié. Vous pouvez maintenant vous connecter.");
}

// ───────── Point d'entrée : chaque appel HTTP arrive ici ─────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) }); // pré-vérification CORS du navigateur
  if (req.method !== "POST") return reponse(req, false, "Méthode non autorisée.");
  try {
    const body = await req.json(); // lit les données envoyées
    const tel = normaliser(body.telephone);
    if (!tel)
      return reponse(req, false, "Numéro invalide : saisissez 10 chiffres (ex. 0700000000).");
    if (body.action === "demander") return await demander(req, tel);
    if (body.action === "valider") return await valider(req, tel, body.code, body.password);
    return reponse(req, false, "Action inconnue.");
  } catch (e) {
    console.error(e); // détail dans les Logs Supabase (jamais montré au visiteur)
    return reponse(req, false, "Erreur inattendue. Réessayez dans quelques minutes.");
  }
});
