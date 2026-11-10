-- ═══════════════════════════════════════════════════════════════════
-- 09_securite_renforcee.sql : protections contre les abus (v6)
-- À exécuter UNE fois, APRÈS 06, 07 et 08. Peut être relancé sans danger.
-- N'efface aucune donnée.
--
-- Idée générale : le site (JavaScript) peut être contourné par n'importe qui
-- avec la touche F12. Chaque limite importante doit donc AUSSI exister ici,
-- dans la base, où personne ne peut la désactiver.
-- ═══════════════════════════════════════════════════════════════════


-- ───────── 1. Profil : le numéro de téléphone devient non modifiable ─────────
-- Le numéro est l'identité du compte (il sert à se connecter et à récupérer
-- le mot de passe). Seul un administrateur peut le corriger.
create or replace function public.protect_profile()
returns trigger                       -- fonction appelée automatiquement par un trigger
language plpgsql                      -- écrite en PL/pgSQL (le langage de PostgreSQL)
set search_path = public              -- évite qu'un schéma piégé soit utilisé à la place de « public »
as $$ begin
  -- auth.uid() is not null : la modification vient d'un utilisateur connecté (pas du SQL Editor)
  -- not public.is_admin()  : et cet utilisateur n'est pas administrateur
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;             -- impossible de se donner le rôle admin
    new.verifie := old.verifie;       -- impossible de s'attribuer le badge vérifié
    new.telephone := old.telephone;   -- NOUVEAU : impossible de changer de numéro
    new.created_at := old.created_at; -- la date d'inscription ne bouge pas
  end if;
  new.updated_at := now();            -- on note la date de la dernière modification
  return new;                         -- on renvoie la ligne (éventuellement corrigée)
end; $$;


-- ───────── 2. Limite : 10 nouvelles annonces par jour et par compte ─────────
-- Empêche un fraudeur (ou un robot) de remplir le site de fausses annonces.
create or replace function public.limit_listing_inserts()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;                        -- variable : nombre d'annonces créées récemment
begin
  if auth.uid() is not null and not public.is_admin() then
    select count(*) into n            -- on compte les annonces de ce propriétaire…
    from public.listings
    where owner_id = new.owner_id
      and created_at > now() - interval '1 day';   -- …créées ces dernières 24 heures
    if n >= 10 then
      raise exception 'Limite atteinte : 10 nouvelles annonces par jour. Réessayez demain.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists limit_listing_inserts_trigger on public.listings;
create trigger limit_listing_inserts_trigger before insert on public.listings
for each row execute procedure public.limit_listing_inserts();


-- ───────── 3. Limites sur les signalements ─────────
-- Les signalements sont ouverts aux visiteurs anonymes : sans limite, un robot
-- pourrait en envoyer des milliers.
create or replace function public.limit_reports()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- a) Un utilisateur connecté ne signale qu'une fois la même annonce (tant que c'est ouvert)
  if new.reporter_id is not null and exists (
    select 1 from public.reports
    where listing_id = new.listing_id and reporter_id = new.reporter_id
      and status in ('ouvert','en_cours')
  ) then
    raise exception 'Vous avez déjà signalé cette annonce. Notre équipe s''en occupe.';
  end if;

  -- b) 20 signalements maximum par annonce et par heure (toutes sources confondues)
  select count(*) into n from public.reports
  where listing_id = new.listing_id and created_at > now() - interval '1 hour';
  if n >= 20 then
    raise exception 'Cette annonce a déjà été signalée de nombreuses fois. Merci, elle est en cours d''examen.';
  end if;

  -- c) 60 signalements maximum par minute sur tout le site (protection contre un robot)
  select count(*) into n from public.reports where created_at > now() - interval '1 minute';
  if n >= 60 then
    raise exception 'Trop de signalements en ce moment. Réessayez dans une minute.';
  end if;
  return new;
end; $$;
drop trigger if exists limit_reports_trigger on public.reports;
create trigger limit_reports_trigger before insert on public.reports
for each row execute procedure public.limit_reports();


-- ───────── 4. Une seule demande de vérification en attente par compte ─────────
-- Index « unique partiel » : la règle ne s'applique qu'aux lignes en attente.
-- Le bloc do … exception évite l'échec si des doublons existent déjà.
do $$ begin
  create unique index if not exists verif_one_pending
    on public.verification_requests (user_id) where status = 'en_attente';
exception when others then
  raise notice 'Index non créé : des demandes en double existent déjà. Traitez-les dans l''admin puis relancez ce fichier.';
end $$;


-- ───────── 5. Tailles maximales et formats ─────────
-- « not valid » : la règle s'applique aux nouvelles écritures sans bloquer sur les anciennes lignes.
alter table public.listings drop constraint if exists listings_description_len;
alter table public.listings add constraint listings_description_len
  check (char_length(description) <= 5000) not valid;          -- description : 5 000 caractères max

alter table public.listings drop constraint if exists listings_textes_len;
alter table public.listings add constraint listings_textes_len
  check (char_length(quartier) <= 120
     and (adresse is null or char_length(adresse) <= 200)
     and (etage is null or char_length(etage) <= 60)) not valid;

alter table public.listings drop constraint if exists listings_images_max;
alter table public.listings add constraint listings_images_max
  check (cardinality(images) <= 6) not valid;                   -- 6 photos maximum

alter table public.listings drop constraint if exists listings_telephone_format;
alter table public.listings add constraint listings_telephone_format
  check (telephone is null or telephone ~ '^[0-9]{10,13}$') not valid;   -- chiffres uniquement

alter table public.listings drop constraint if exists listings_loyer_max;
alter table public.listings add constraint listings_loyer_max
  check (loyer <= 100000000) not valid;                         -- 100 millions FCFA max (évite les fautes de frappe)

alter table public.profiles drop constraint if exists profiles_noms_len;
alter table public.profiles add constraint profiles_noms_len
  check (char_length(nom) <= 60 and char_length(prenom) <= 60) not valid;


-- ───────── 6. Fonctions internes : appel direct interdit ─────────
-- Toute fonction du schéma public peut être appelée depuis le site via « rpc ».
-- refresh_ratings ne doit être lancée que par les triggers : on retire le droit d'appel.
revoke execute on function public.refresh_ratings(uuid) from public, anon, authenticated;


-- ───────── 7. Ménage : codes de récupération expirés ─────────
-- Les codes de plus d'un jour ne servent plus à rien : on les supprime.
delete from public.password_resets where created_at < now() - interval '1 day';


-- ───────── Vérification ─────────
-- (Le SQL Editor n'affiche que le résultat de la DERNIÈRE requête : le contrôle
-- ci-dessous est donc placé en dernier. Pour vérifier les triggers, exécutez seule :
--   select tgname from pg_trigger where tgname like 'limit_%';
-- → doit afficher limit_listing_inserts_trigger et limit_reports_trigger.)

-- ───────── Contrôle des anciennes annonces ─────────
-- ⚠ Une règle « not valid » est quand même vérifiée lors de la PROCHAINE modification
-- d'une ligne. Cette requête liste les annonces qui ne respectent pas les nouvelles
-- règles (résultat attendu : aucune ligne). S'il y en a, corrigez-les dans
-- Table Editor > listings, sinon leur propriétaire ne pourra plus les modifier.
select id, titre, telephone from public.listings
where (telephone is not null and telephone !~ '^[0-9]{10,13}$')
   or char_length(description) > 5000
   or char_length(quartier) > 120
   or cardinality(images) > 6
   or loyer > 100000000;
