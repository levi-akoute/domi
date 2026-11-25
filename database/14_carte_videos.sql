-- ═══════════════════════════════════════════════════════════════════
-- 14_carte_videos.sql : miniatures, localisation, vidéos (v8)
-- À exécuter UNE fois, APRÈS 13, et APRÈS avoir publié la v8 du site (/commit).
-- Peut être relancé sans danger. N'efface aucune annonce.
-- Supabase › SQL Editor › New query › coller tout › Run.
-- Le résultat doit afficher uniquement des lignes « ✅ » (8 lignes). S'il y a un ❌, montrez-le à Claude.
--
-- Ce que ce fichier prépare :
--   1. PHOTOS : chaque photo part avec une petite version (« -mini ») pour les listes ;
--   2. CARTE : la position du logement (point exact privé, zone d'environ 300 m publique) ;
--   3. VIDÉOS : la vidéo de présentation est envoyée sur Domi (plus de lien externe) ;
--   4. ADMIN : l'espace utilisé par les fichiers (pour rester dans l'offre gratuite).
-- L'ancien site continue de marcher après ce fichier, et le nouveau site marche avant.
-- ⚠ Si un jour vous relancez un fichier 11 ou 13, relancez ENSUITE ce fichier 14 (il remplace
-- certaines de leurs règles). database/99_verifier_installation.sql le signale.
-- ═══════════════════════════════════════════════════════════════════


-- ═════════ 0. VÉRIFICATION : les fichiers 11 et 13 doivent être exécutés avant ═════════
do $$ begin
  if to_regprocedure('public.quota_ok(text,integer,bigint)') is null then
    raise exception 'Exécutez d''abord database/11_audit_securite.sql, puis relancez ce fichier.';
  end if;
  if to_regprocedure('public.annonces_publiques()') is null then
    raise exception 'Exécutez d''abord database/13_annonces_confidentielles.sql, puis relancez ce fichier.';
  end if;
end $$;


-- ═════════ 1. PHOTOS : place pour les miniatures ═════════
-- Chaque photo = 2 fichiers (grande + petite). Le quota par compte passe donc de 150 à 400
-- fichiers. Le poids maximum reste 60 Mo : les miniatures sont très légères.
drop policy if exists "annonces_insert_own" on storage.objects;
create policy "annonces_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'annonces'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.quota_ok('annonces', 400, 62914560));          -- 400 fichiers, 60 Mo


-- ═════════ 2. CARTE : position du logement ═════════
-- latitude, longitude : point exact posé par l'annonceur (facultatif). Jamais lu par les visiteurs :
--   la table est réservée à son propriétaire et à l'admin (règle listing_read, fichier 13).
-- itineraire : l'annonceur accepte (ou non) de donner le point exact au clic sur « Itinéraire ».
alter table public.listings
  add column if not exists latitude   double precision,
  add column if not exists longitude  double precision,
  add column if not exists itineraire boolean not null default true;

-- Position toujours en Côte d'Ivoire (rectangle autour du pays), ou aucune position.
-- coalesce(…, false) : sans lui, une latitude sans longitude donnerait « inconnu », que
-- PostgreSQL accepte dans une contrainte. Une position à moitié remplie est donc refusée.
alter table public.listings drop constraint if exists listings_position_ci;
alter table public.listings add constraint listings_position_ci check (
  (latitude is null and longitude is null)
  or coalesce(latitude between 4.2 and 10.9 and longitude between -8.8 and -2.3, false)
);

-- protect_listing (modération) : déplacer l'épingle compte comme une modification du contenu
-- (un compte non vérifié repart en validation). Le reste de la fonction est identique au fichier 11.
create or replace function public.protect_listing()
returns trigger language plpgsql security definer set search_path = public
as $$ declare v boolean;
begin
  if current_setting('immoci.bypass', true) = '1' then return new; end if;   -- fonctions internes

  -- Le propriétaire est-il vérifié ? (lu dans la base, jamais depuis le navigateur)
  select coalesce(verifie, false) into v from public.profiles where id = coalesce(new.owner_id, old.owner_id);
  v := coalesce(v, false);

  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      new.moderation := case when v then 'approuvee' else 'en_attente' end;   -- modération mixte (08)
      new.proprietaire_verifie := v;
      new.vues := 0; new.clics_whatsapp := 0;
      new.note_moyenne := 0; new.nb_avis := 0; new.proprio_note := 0; new.proprio_nb_avis := 0;
      new.confirmee_le := now();
      new.created_at := now();      -- date de création fixée par le serveur
      new.updated_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  new.updated_at := now();
  if auth.uid() is not null and not public.is_admin() then
    new.owner_id := old.owner_id;
    new.moderation := old.moderation;
    new.proprietaire_verifie := old.proprietaire_verifie;
    new.vues := old.vues; new.clics_whatsapp := old.clics_whatsapp;
    new.note_moyenne := old.note_moyenne; new.nb_avis := old.nb_avis;
    new.proprio_note := old.proprio_note; new.proprio_nb_avis := old.proprio_nb_avis;
    new.created_at := old.created_at;                         -- date de création figée
    if new.confirmee_le is distinct from old.confirmee_le then
      new.confirmee_le := now();                              -- « confirmer » = maintenant, jamais une date choisie
    end if;
    if old.moderation <> 'en_attente' then
      if new.telephone is distinct from old.telephone then
        new.moderation := 'en_attente';                       -- numéro changé → toujours revalidé
      elsif (new.titre, new.description, new.type, new.loyer, new.commune, new.quartier, new.adresse,
             new.image, new.images, new.video, new.cie, new.sodeci, new.avance, new.caution, new.etage, new.chambres,
             new.latitude, new.longitude)                     -- NOUVEAU (v8) : position de l'épingle
         is distinct from
            (old.titre, old.description, old.type, old.loyer, old.commune, old.quartier, old.adresse,
             old.image, old.images, old.video, old.cie, old.sodeci, old.avance, old.caution, old.etage, old.chambres,
             old.latitude, old.longitude)
      then
        -- vérifié : reste publiée ; non vérifié (ou annonce refusée) : repart en validation
        new.moderation := case when v and old.moderation = 'approuvee' then 'approuvee' else 'en_attente' end;
      end if;
    end if;
  end if;
  return new;
end; $$;

-- Ce que les visiteurs lisent (remplace la version du fichier 13) : 3 informations en plus.
--   zone_lat, zone_lng   : centre d'un carré d'environ 330 m qui contient le logement. Le point exact
--                          reste caché : impossible de retrouver la maison à partir de la zone.
--   itineraire_possible  : l'annonceur a posé une épingle ET accepte de donner le point exact au clic.
-- (Le type de retour change : il faut supprimer l'ancienne version avant de créer la nouvelle.)
drop function if exists public.annonces_publiques();
create function public.annonces_publiques()
returns table (
  id uuid, titre text, "type" text, loyer numeric, commune text, quartier text,
  description text, cie text, sodeci text, avance smallint, caution smallint,
  etage text, chambres smallint, statut text, moderation text,
  image text, images text[], video text, proprietaire_verifie boolean,
  confirmee_le timestamptz, note_moyenne numeric, nb_avis integer,
  proprio_note numeric, proprio_nb_avis integer,
  a_la_une boolean, est_a_moi boolean, rang bigint,
  zone_lat double precision, zone_lng double precision, itineraire_possible boolean
)
language sql stable security definer set search_path = public
as $$
  select l.id, l.titre, l.type, l.loyer, l.commune, l.quartier,
         l.description, l.cie, l.sodeci, l.avance, l.caution,
         l.etage, l.chambres, l.statut, l.moderation,
         l.image, l.images, l.video, l.proprietaire_verifie,
         l.confirmee_le, l.note_moyenne, l.nb_avis,
         l.proprio_note, l.proprio_nb_avis,
         coalesce(l.a_la_une_jusqu_au > now(), false) and l.proprietaire_verifie,  -- a_la_une
         coalesce(l.owner_id = auth.uid(), false),                                -- est_a_moi
         row_number() over (order by l.created_at desc),                           -- rang
         (floor(l.latitude / 0.003) + 0.5) * 0.003,                                -- zone_lat
         (floor(l.longitude / 0.003) + 0.5) * 0.003,                               -- zone_lng
         l.itineraire and l.latitude is not null                                   -- itineraire_possible
  from public.listings l
  where l.moderation = 'approuvee';   -- annonces validées seulement
$$;
revoke execute on function public.annonces_publiques() from public;
grant execute on function public.annonces_publiques() to anon, authenticated;

-- Point exact d'UNE annonce, donné seulement au clic sur « Itinéraire » (comme le numéro).
-- Vide si l'annonce n'est pas publiée et disponible, si l'annonceur n'a pas posé d'épingle
-- ou s'il a choisi de ne montrer que la zone.
-- Limite honnête (comme pour le numéro, fichier 13) : un programmeur pourrait demander les points un
-- par un. L'annonceur qui préfère ne rien donner décoche « J'accepte… » dans le formulaire : seule la zone sort.
create or replace function public.itineraire_annonce(p_id uuid)
returns table (latitude double precision, longitude double precision)
language sql stable security definer set search_path = public
as $$
  select l.latitude, l.longitude
  from public.listings l
  where l.id = p_id
    and l.moderation = 'approuvee' and l.statut = 'Disponible'
    and l.itineraire and l.latitude is not null and l.longitude is not null;
$$;
revoke execute on function public.itineraire_annonce(uuid) from public;
grant execute on function public.itineraire_annonce(uuid) to anon, authenticated;


-- ═════════ 3. VIDÉOS ═════════
-- Dossier public « videos » : 40 Mo par fichier au maximum, MP4 ou WebM seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('videos', 'videos', true, 41943040, array['video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Envoi : dans son propre dossier, 12 vidéos et 240 Mo au maximum par compte
drop policy if exists "videos_insert_own" on storage.objects;
create policy "videos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.quota_ok('videos', 12, 251658240));            -- 12 vidéos, 240 Mo
-- Liste des fichiers : le propriétaire et l'admin seulement (une vidéo s'affiche par son adresse)
drop policy if exists "videos_read" on storage.objects;
create policy "videos_read" on storage.objects for select to authenticated
  using (bucket_id = 'videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
-- Suppression : le propriétaire et l'admin seulement
drop policy if exists "videos_delete_own" on storage.objects;
create policy "videos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Vidéo d'une annonce : obligatoirement dans le dossier de SON annonceur sur Domi. Plus de lien
-- externe (TikTok, YouTube…) : un lien vers un faux site affiché comme « Voir la vidéo » était un
-- piège possible. « not valid » : les anciennes annonces ne sont pas touchées.
create or replace function public.video_domi_ok(p_owner uuid, p_video text)
returns boolean language sql immutable as $$
  select p_video is null
      or p_video like 'https://mplbhzqmffaywlhbxleb.supabase.co/storage/v1/object/public/videos/' || p_owner::text || '/%'
$$;
alter table public.listings drop constraint if exists listings_video_hosts;
alter table public.listings add constraint listings_video_hosts
  check (public.video_domi_ok(owner_id, video)) not valid;
-- ⚠ Si un jour le projet Supabase change, remplacer « mplbhzqmffaywlhbxleb » ci-dessus.


-- ═════════ 4. ADMIN : espace utilisé par les fichiers ═════════
-- Utilisé par la page admin pour afficher l'espace occupé (offre gratuite : 1 Go au total).
create or replace function public.espace_utilise()
returns table (dossier text, fichiers bigint, octets bigint)
language plpgsql stable security definer set search_path = public, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''équipe Domi.';
  end if;
  return query
    select o.bucket_id::text, count(*)::bigint, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
     group by o.bucket_id;
end; $$;
revoke execute on function public.espace_utilise() from public, anon;
grant execute on function public.espace_utilise() to authenticated;


-- Prévient l'API de Supabase (PostgREST) qu'il y a de nouvelles fonctions et colonnes
notify pgrst, 'reload schema';


-- ═════════ 5. VÉRIFICATION ═════════
-- Toutes les lignes doivent être ✅
select element, case when ok then '✅' else '❌ montrez cette ligne à Claude' end as etat
from (values
  ('photos : quota de 400 fichiers',
   exists (select 1 from pg_policy where polname = 'annonces_insert_own' and pg_get_expr(polwithcheck, polrelid) like '%400%')),
  ('carte : colonnes latitude, longitude, itineraire',
   (select count(*) = 3 from information_schema.columns
     where table_schema = 'public' and table_name = 'listings' and column_name in ('latitude', 'longitude', 'itineraire'))),
  ('carte : position en Côte d''Ivoire seulement',
   exists (select 1 from pg_constraint where conname = 'listings_position_ci')),
  ('carte : zone publique et point exact au clic',
   (select count(*) = 2 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and ((p.proname = 'annonces_publiques' and pg_get_function_result(p.oid) like '%zone_lat%')
            or p.proname = 'itineraire_annonce'))),
  ('vidéos : dossier de 40 Mo par fichier',
   exists (select 1 from storage.buckets where id = 'videos' and public and file_size_limit = 41943040)),
  ('vidéos : règles d''envoi, de lecture et de suppression',
   (select count(*) = 3 from pg_policy where polname in ('videos_insert_own', 'videos_read', 'videos_delete_own'))),
  ('vidéos : seulement celles de Domi',
   exists (select 1 from pg_constraint where conname = 'listings_video_hosts' and pg_get_constraintdef(oid) like '%video_domi_ok%')),
  ('admin : espace utilisé',
   exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'espace_utilise'))
) as t(element, ok);
