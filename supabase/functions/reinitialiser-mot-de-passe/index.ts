// ═══════════════════════════════════════════════════════════════════
// Edge Function « reinitialiser-mot-de-passe » (Domi v5)
//
// S'exécute sur les serveurs de Supabase, JAMAIS dans le navigateur.
// C'est pour ça qu'elle a le droit d'utiliser la clé service_role
// (fournie automatiquement par Supabase dans SUPABASE_SERVICE_ROLE_KEY).
//
// Deux actions, appelées depuis mot-de-passe-oublie.html :
//   { action: "demander", telephone }                  → envoie un code par email
//   { action: "valider",  telephone, code, password }  → change le mot de passe
//
// Secrets à définir dans Supabase (Edge Functions > Secrets) :
//   BREVO_API_KEY       clé API Brevo (envoi des emails)
//   BREVO_SENDER_EMAIL  adresse expéditrice validée dans Brevo
// Guide pas à pas : docs/GUIDE_MOT_DE_PASSE_OUBLIE.md
// ═══════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CODE_VALIDITE_MIN = 10; // minutes
const MAX_ESSAIS = 5; // essais par code
const MAX_DEMANDES_HEURE = 3; // codes envoyés par compte et par heure
const MDP_MIN = 8; // longueur minimale du nouveau mot de passe

// CORS : autorise le navigateur à appeler la fonction depuis le site
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// On répond toujours 200 avec { ok, message } : le site affiche simplement le message.
const reponse = (ok: boolean, message: string) =>
  new Response(JSON.stringify({ ok, message }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// Même règle que js/auth.js : 10 chiffres, l'indicatif 225 est retiré s'il est présent
function normaliser(tel: unknown): string | null {
  let d = String(tel ?? "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("225")) d = d.slice(3);
  return /^\d{10}$/.test(d) ? d : null;
}

// Empreinte SHA-256 du code, « salée » avec l'identifiant de l'utilisateur
async function empreinte(userId: string, code: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${code}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Code à 6 chiffres tiré avec un générateur cryptographique (pas Math.random)
function nouveauCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

async function envoyerEmail(to: string, prenom: string, code: string): Promise<boolean> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  if (!apiKey || !sender) {
    console.error("BREVO_API_KEY ou BREVO_SENDER_EMAIL manquant dans les secrets");
    return false;
  }
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Domi", email: sender },
      to: [{ email: to }],
      subject: `${code} est votre code Domi`,
      textContent: `${bonjour}\n\nVotre code pour choisir un nouveau mot de passe Domi : ${code}\nIl est valable ${CODE_VALIDITE_MIN} minutes.\n\nVous n'avez rien demandé ? Ignorez cet email, votre mot de passe reste inchangé.\n\nL'équipe Domi`,
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
  if (!res.ok) console.error("Brevo a refusé l'envoi :", res.status, await res.text());
  return res.ok;
}

// ───────── Action 1 : envoyer un code ─────────
// SÉCURITÉ : la réponse est IDENTIQUE que le numéro existe ou non. Sinon, n'importe
// qui pourrait tester des numéros pour savoir qui est inscrit sur Domi.
const MSG_ENVOI =
  "Si ce numéro correspond à un compte avec un email de récupération, un code vient d’être envoyé. Pensez à regarder dans vos spams.";

async function demander(tel: string) {
  const { data: profil } = await admin
    .from("profiles")
    .select("id, prenom, email_recuperation")
    .eq("telephone", tel)
    .maybeSingle();
  if (!profil?.email_recuperation) return reponse(true, MSG_ENVOI);

  // Limite : 3 codes par heure et par compte (évite le harcèlement par email)
  const ilYaUneHeure = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("password_resets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profil.id)
    .gte("created_at", ilYaUneHeure);
  if ((count ?? 0) >= MAX_DEMANDES_HEURE) return reponse(true, MSG_ENVOI);

  // Un seul code actif à la fois : les anciens sont annulés
  await admin
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", profil.id)
    .is("used_at", null);

  const code = nouveauCode();
  await admin.from("password_resets").insert({
    user_id: profil.id,
    code_hash: await empreinte(profil.id, code),
    expires_at: new Date(Date.now() + CODE_VALIDITE_MIN * 60_000).toISOString(),
  });
  await envoyerEmail(profil.email_recuperation, profil.prenom ?? "", code);
  return reponse(true, MSG_ENVOI);
}

// ───────── Action 2 : vérifier le code et changer le mot de passe ─────────
async function valider(tel: string, code: unknown, password: unknown) {
  const c = String(code ?? "").trim();
  const pw = String(password ?? "");
  if (!/^\d{6}$/.test(c)) return reponse(false, "Le code contient 6 chiffres.");
  if (pw.length < MDP_MIN)
    return reponse(false, `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`);

  const INVALIDE = "Code invalide ou expiré. Demandez un nouveau code.";
  const { data: profil } = await admin
    .from("profiles")
    .select("id")
    .eq("telephone", tel)
    .maybeSingle();
  if (!profil) return reponse(false, INVALIDE);

  const { data: reset } = await admin
    .from("password_resets")
    .select("*")
    .eq("user_id", profil.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reset) return reponse(false, INVALIDE);

  if (reset.code_hash !== (await empreinte(profil.id, c))) {
    const essais = reset.attempts + 1;
    await admin
      .from("password_resets")
      .update({ attempts: essais, used_at: essais >= MAX_ESSAIS ? new Date().toISOString() : null })
      .eq("id", reset.id);
    return essais >= MAX_ESSAIS
      ? reponse(false, "Trop d’essais. Ce code est annulé : demandez-en un nouveau.")
      : reponse(false, `Code incorrect. Il vous reste ${MAX_ESSAIS - essais} essai(s).`);
  }

  // Code correct : on change le mot de passe avec les droits administrateur
  const { error } = await admin.auth.admin.updateUserById(profil.id, { password: pw });
  if (error) return reponse(false, "Le mot de passe n’a pas pu être changé : " + error.message);
  await admin
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", reset.id);
  return reponse(true, "Mot de passe modifié. Vous pouvez maintenant vous connecter.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reponse(false, "Méthode non autorisée.");
  try {
    const body = await req.json();
    const tel = normaliser(body.telephone);
    if (!tel) return reponse(false, "Numéro invalide : saisissez 10 chiffres (ex. 0700000000).");
    if (body.action === "demander") return await demander(tel);
    if (body.action === "valider") return await valider(tel, body.code, body.password);
    return reponse(false, "Action inconnue.");
  } catch (e) {
    console.error(e);
    return reponse(false, "Erreur inattendue. Réessayez dans quelques minutes.");
  }
});
