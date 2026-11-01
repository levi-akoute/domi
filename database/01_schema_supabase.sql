-- ImmoCI — schéma Supabase v2 (peut être relancé sans danger)
-- Supabase > SQL Editor > New query > coller tout > Run.
create extension if not exists pgcrypto;

-- ───────── TABLES ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '', prenom text not null default '',
  telephone text unique, commune text,
  role text not null default 'proprietaire' check (role in ('proprietaire','agent','admin')),
  verifie boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  titre text not null check (char_length(titre) between 3 and 90),
  type text not null check (type in ('Studio','Appartement','Maison','Villa','Terrain','Commerce','Autre')),
  loyer numeric(14,0) not null check (loyer > 0),
  commune text not null, quartier text not null default '',
  description text not null default '', adresse text,
  cie text, sodeci text,
  avance smallint not null default 0 check (avance >= 0),
  caution smallint not null default 0 check (caution >= 0),
  etage text, chambres smallint not null default 0 check (chambres >= 0),
  statut text not null default 'Disponible' check (statut in ('Disponible','Déjà loué')),   -- disponibilité (choisie par l'annonceur)
  moderation text not null default 'en_attente' check (moderation in ('en_attente','approuvee','rejetee')), -- validation (choisie par l'admin)
  image text, images text[] not null default '{}', video text, telephone text,
  proprietaire_verifie boolean not null default false,   -- badge « Propriétaire vérifié »
  vues bigint not null default 0, clics_whatsapp bigint not null default 0,
  confirmee_le timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null, document_path text,
  status text not null default 'en_attente' check (status in ('en_attente','approuvee','rejetee')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_note text, created_at timestamptz not null default now(), reviewed_at timestamptz
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 100),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'ouvert' check (status in ('ouvert','en_cours','traite','rejete')),
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, listing_id)
);

create index if not exists listings_public_idx on public.listings (moderation, statut, commune, type, loyer);
create index if not exists listings_recent_idx on public.listings (created_at desc);
create index if not exists listings_owner_idx on public.listings (owner_id);
create index if not exists verif_user_idx on public.verification_requests (user_id, created_at desc);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- ───────── FONCTIONS ─────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

-- Crée le profil à chaque inscription (le rôle admin ne peut JAMAIS venir du formulaire)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, nom, prenom, telephone, commune, role)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nom',''), coalesce(new.raw_user_meta_data->>'prenom',''),
    nullif(new.raw_user_meta_data->>'telephone',''), nullif(new.raw_user_meta_data->>'commune',''),
    case when new.raw_user_meta_data->>'role' = 'agent' then 'agent' else 'proprietaire' end)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Un utilisateur connecté ne peut pas se donner le rôle admin ni le badge vérifié.
-- (auth.uid() est null dans le SQL Editor : c'est ce qui permet de vous promouvoir admin.)
create or replace function public.protect_profile()
returns trigger language plpgsql set search_path = public
as $$ begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role; new.verifie := old.verifie;
  end if;
  new.updated_at := now(); return new;
end; $$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
drop trigger if exists protect_profile_trigger on public.profiles;
create trigger protect_profile_trigger before update on public.profiles
for each row execute procedure public.protect_profile();

-- Un annonceur ne peut pas s'auto-valider, tricher sur les compteurs ou usurper le badge.
-- Toute modification de contenu d'une annonce validée/refusée la renvoie en modération.
create or replace function public.protect_listing()
returns trigger language plpgsql security definer set search_path = public
as $$ declare v boolean;
begin
  if current_setting('immoci.bypass', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      select coalesce(verifie,false) into v from public.profiles where id = new.owner_id;
      new.moderation := 'en_attente'; new.proprietaire_verifie := coalesce(v,false);
      new.vues := 0; new.clics_whatsapp := 0; new.confirmee_le := now();
    end if;
    return new;
  end if;
  new.updated_at := now();
  if auth.uid() is not null and not public.is_admin() then
    new.owner_id := old.owner_id; new.moderation := old.moderation;
    new.proprietaire_verifie := old.proprietaire_verifie;
    new.vues := old.vues; new.clics_whatsapp := old.clics_whatsapp;
    if old.moderation <> 'en_attente' and
      (new.titre,new.description,new.type,new.loyer,new.commune,new.quartier,new.image,new.images,new.video,new.telephone)
      is distinct from
      (old.titre,old.description,old.type,old.loyer,old.commune,old.quartier,old.image,old.images,old.video,old.telephone)
    then new.moderation := 'en_attente'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists protect_listing_trigger on public.listings;
create trigger protect_listing_trigger before insert or update on public.listings
for each row execute procedure public.protect_listing();

-- Compteurs : appelables par les visiteurs, uniquement sur les annonces publiées
create or replace function public.increment_view(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform set_config('immoci.bypass','1',true);
  update public.listings set vues = vues + 1 where id = p_id and moderation = 'approuvee'; end; $$;
create or replace function public.increment_whatsapp(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform set_config('immoci.bypass','1',true);
  update public.listings set clics_whatsapp = clics_whatsapp + 1 where id = p_id and moderation = 'approuvee'; end; $$;
grant execute on function public.increment_view(uuid), public.increment_whatsapp(uuid) to anon, authenticated;

-- Décision admin sur une demande de vérification (donne le badge au profil ET à ses annonces)
create or replace function public.decide_verification(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.verification_requests
     set status = case when p_approve then 'approuvee' else 'rejetee' end,
         reviewer_id = auth.uid(), reviewer_note = p_note, reviewed_at = now()
   where id = p_id returning user_id into v_user;
  if v_user is null then raise exception 'Demande introuvable'; end if;
  if p_approve then
    update public.profiles set verifie = true where id = v_user;
    update public.listings set proprietaire_verifie = true where owner_id = v_user;
  end if;
end; $$;
revoke execute on function public.decide_verification(uuid, boolean, text) from anon;

-- ───────── SÉCURITÉ (RLS) ─────────
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.verification_requests enable row level security;
alter table public.reports enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "profile_read" on public.profiles;
create policy "profile_read" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profile_update" on public.profiles;
create policy "profile_update" on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "listing_read" on public.listings;
create policy "listing_read" on public.listings for select
  using (moderation = 'approuvee' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "listing_insert" on public.listings;
create policy "listing_insert" on public.listings for insert with check (owner_id = auth.uid());
drop policy if exists "listing_update" on public.listings;
create policy "listing_update" on public.listings for update
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists "listing_delete" on public.listings;
create policy "listing_delete" on public.listings for delete using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "verif_read" on public.verification_requests;
create policy "verif_read" on public.verification_requests for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "verif_insert" on public.verification_requests;
create policy "verif_insert" on public.verification_requests for insert
  with check (user_id = auth.uid() and status = 'en_attente');

drop policy if exists "reports_read" on public.reports;
create policy "reports_read" on public.reports for select using (public.is_admin());
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert to anon, authenticated
  with check (reporter_id is null or reporter_id = auth.uid());
drop policy if exists "reports_update" on public.reports;
create policy "reports_update" on public.reports for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "favorites_self" on public.favorites;
create policy "favorites_self" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── STOCKAGE DES FICHIERS ─────────
-- annonces = photos publiques ; verifications = pièces d'identité PRIVÉES (visibles seulement par leur auteur et l'admin)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('annonces','annonces',true,3145728,array['image/jpeg','image/png','image/webp']),
  ('verifications','verifications',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "annonces_read" on storage.objects;
create policy "annonces_read" on storage.objects for select using (bucket_id = 'annonces');
drop policy if exists "annonces_insert_own" on storage.objects;
create policy "annonces_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'annonces' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "annonces_delete_own" on storage.objects;
create policy "annonces_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'annonces' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "verif_files_insert_own" on storage.objects;
create policy "verif_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "verif_files_read" on storage.objects;
create policy "verif_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'verifications' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
