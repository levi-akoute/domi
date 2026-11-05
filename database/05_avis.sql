-- ═══ Domi — Avis et notes sur les annonces (à exécuter UNE fois dans Supabase > SQL Editor) ═══
-- Peut être relancé sans danger. N'efface aucune donnée.

alter table public.listings add column if not exists note_moyenne numeric(2,1) not null default 0;
alter table public.listings add column if not exists nb_avis integer not null default 0;
alter table public.listings add column if not exists proprio_note numeric(2,1) not null default 0;
alter table public.listings add column if not exists proprio_nb_avis integer not null default 0;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 800),
  status text not null default 'en_attente' check (status in ('en_attente','approuve','rejete')),
  created_at timestamptz not null default now(),
  unique (listing_id, author_id)            -- un seul avis par personne et par annonce
);
create index if not exists reviews_listing_idx on public.reviews (listing_id, status, created_at desc);

-- Règles à l'insertion : toujours « en attente », pas d'avis sur sa propre annonce, annonce publiée uniquement
create or replace function public.protect_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'en_attente';
    if exists (select 1 from public.listings where id = new.listing_id and owner_id = new.author_id) then
      raise exception 'Vous ne pouvez pas noter votre propre annonce.';
    end if;
    if not exists (select 1 from public.listings where id = new.listing_id and moderation = 'approuvee') then
      raise exception 'Cette annonce n''est pas disponible.';
    end if;
  end if;
  select nullif(trim(coalesce(prenom,'') || ' ' || case when coalesce(nom,'') <> '' then left(nom,1) || '.' else '' end), '')
    into new.author_name from public.profiles where id = new.author_id;
  return new;
end; $$;
drop trigger if exists protect_review_trigger on public.reviews;
create trigger protect_review_trigger before insert on public.reviews
for each row execute procedure public.protect_review();

-- Recalcule la note de l'annonce ET la note moyenne de son annonceur (avis publiés uniquement)
create or replace function public.refresh_ratings(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.listings where id = p_listing;
  perform set_config('immoci.bypass', '1', true);
  update public.listings l set
    note_moyenne = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.listing_id = l.id and r.status = 'approuve'), 0),
    nb_avis = (select count(*) from public.reviews r where r.listing_id = l.id and r.status = 'approuve')
  where l.id = p_listing;
  if v_owner is not null then
    update public.listings l set
      proprio_note = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r join public.listings x on x.id = r.listing_id where x.owner_id = v_owner and r.status = 'approuve'), 0),
      proprio_nb_avis = (select count(*) from public.reviews r join public.listings x on x.id = r.listing_id where x.owner_id = v_owner and r.status = 'approuve')
    where l.owner_id = v_owner;
  end if;
  perform set_config('immoci.bypass', '', true);
end; $$;

create or replace function public.reviews_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.refresh_ratings(old.listing_id);
  else perform public.refresh_ratings(new.listing_id); end if;
  return null;
end; $$;
drop trigger if exists reviews_after_change_trigger on public.reviews;
create trigger reviews_after_change_trigger after insert or update or delete on public.reviews
for each row execute procedure public.reviews_after_change();

-- Sécurité (RLS) : le public ne voit que les avis publiés ; l'auteur voit les siens ; l'admin voit tout
alter table public.reviews enable row level security;
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews for select
  using (status = 'approuve' or author_id = auth.uid() or public.is_admin());
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "reviews_update" on public.reviews;
create policy "reviews_update" on public.reviews for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "reviews_delete" on public.reviews;
create policy "reviews_delete" on public.reviews for delete using (author_id = auth.uid() or public.is_admin());
