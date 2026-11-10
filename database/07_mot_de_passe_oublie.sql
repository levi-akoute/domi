-- ═══════════════════════════════════════════════════════════════════
-- 07_mot_de_passe_oublie.sql : récupération du mot de passe par code email (v5)
-- À exécuter UNE fois, après 06. Peut être relancé sans danger.
-- Guide complet (avec l'Edge Function et Brevo) : docs/GUIDE_MOT_DE_PASSE_OUBLIE.md
-- ═══════════════════════════════════════════════════════════════════


-- ───────── 1. Email de récupération dans le profil ─────────
-- Les comptes Domi utilisent un faux email interne (0700000000@immoci.app).
-- On ajoute un VRAI email, facultatif, qui sert uniquement à recevoir le code.
alter table public.profiles add column if not exists email_recuperation text;

-- Format minimal : quelque chose@quelque.chose, 120 caractères max
alter table public.profiles drop constraint if exists profiles_email_recuperation_format;
alter table public.profiles add constraint profiles_email_recuperation_format
  check (email_recuperation is null
         or (email_recuperation ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email_recuperation) <= 120));

-- Lisible par : l'utilisateur lui-même et l'admin (règle « profile_read » déjà en place).
-- Modifiable par : l'utilisateur lui-même (règle « profile_update » déjà en place).


-- ───────── 2. L'inscription enregistre l'email s'il est fourni ─────────
-- Même fonction qu'avant (01_schema), avec une colonne en plus.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_email text := nullif(lower(trim(new.raw_user_meta_data->>'email_recuperation')), '');
begin
  -- Un email mal formé est ignoré plutôt que de faire échouer l'inscription
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;

  insert into public.profiles (id, nom, prenom, telephone, commune, role, email_recuperation)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nom',''), coalesce(new.raw_user_meta_data->>'prenom',''),
    nullif(new.raw_user_meta_data->>'telephone',''), nullif(new.raw_user_meta_data->>'commune',''),
    -- le rôle admin ne peut JAMAIS venir du formulaire d'inscription
    case when new.raw_user_meta_data->>'role' = 'agent' then 'agent' else 'proprietaire' end,
    v_email)
  on conflict (id) do nothing;
  return new;
end; $$;


-- ───────── 3. Table des codes (SECRÈTE) ─────────
-- On ne stocke jamais le code lui-même, seulement son empreinte (hash SHA-256) :
-- même quelqu'un qui lirait la table ne pourrait pas retrouver le code.
create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,          -- validité : 10 minutes
  attempts smallint not null default 0,     -- 5 essais maximum
  used_at timestamptz,                      -- rempli quand le code est utilisé ou annulé
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on public.password_resets (user_id, created_at desc);

-- RLS activé SANS aucune règle = personne ne peut lire ni écrire depuis le site,
-- ni visiteur, ni utilisateur connecté, ni même l'admin via le site.
-- Seule l'Edge Function (qui utilise la clé service_role, côté serveur) y a accès.
alter table public.password_resets enable row level security;


-- ───────── Vérification ─────────
-- Doit afficher : email_recuperation | text
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'email_recuperation';
