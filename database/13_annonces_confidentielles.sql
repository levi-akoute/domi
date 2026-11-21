-- ═══════════════════════════════════════════════════════════════════
-- 13_annonces_confidentielles.sql : ce que les visiteurs peuvent lire (v7.3)
-- À exécuter UNE fois, APRÈS 12, et APRÈS avoir publié la v7.3 du site (/commit).
-- Peut être relancé sans danger. N'efface aucune donnée.
-- Supabase › SQL Editor › New query › coller tout › Run.
--
-- AVANT : avec la touche F12, n'importe qui pouvait lire TOUTES les colonnes des annonces
-- publiées, même celles que le site n'affiche pas :
--   • le numéro de TOUS les annonceurs, d'un seul coup (une seule requête suffisait) ;
--   • les vues, les clics WhatsApp, le repère, les dates, l'identifiant du propriétaire ;
--   • pour les avis : l'identifiant de leur auteur.
--
-- APRÈS :
--   • les visiteurs lisent les annonces par la fonction annonces_publiques(), qui ne
--     renvoie QUE ce que le site affiche ;
--   • le numéro n'est donné qu'au clic sur « Contacter », une annonce à la fois
--     (fonction contacter_annonce) ;
--   • la table complète des annonces n'est lisible que par leur propriétaire et l'admin ;
--   • même principe pour les avis (fonction avis_publics).
--
-- ⚠ ORDRE : publier d'abord la v7.3. L'ancien site lit la table directement : si ce fichier
-- passait avant, les visiteurs ne verraient plus aucune annonce jusqu'à la publication.
-- Le nouveau site, lui, fonctionne avant ET après ce fichier.
-- ═══════════════════════════════════════════════════════════════════


-- ═════════ 0. VÉRIFICATION : le fichier 12 doit être exécuté avant ═════════
-- (la colonne « À la une » et sa protection viennent du fichier 12)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'protect_a_la_une_trigger') then
    raise exception 'Exécutez d''abord database/12_a_la_une.sql, puis relancez ce fichier.';
  end if;
end $$;


-- ═════════ 1. ANNONCES : lecture publique limitée ═════════
-- « security definer » : la fonction lit la table avec les droits de son créateur, donc
-- malgré la règle du point 3. C'est voulu : c'est ELLE qui choisit les colonnes montrées.
-- Absents volontairement : telephone, adresse (repère), vues, clics_whatsapp, owner_id,
-- created_at, updated_at, a_la_une_jusqu_au.
-- Calculés à la place :
--   a_la_une  : vrai/faux (la date de fin, qui est une info commerciale, reste cachée) ;
--   est_a_moi : vrai si le visiteur connecté est le propriétaire (remplace owner_id) ;
--   rang      : 1 = la plus récente (remplace la date de publication pour le tri).
create or replace function public.annonces_publiques()
returns table (
  id uuid, titre text, "type" text, loyer numeric, commune text, quartier text,
  description text, cie text, sodeci text, avance smallint, caution smallint,
  etage text, chambres smallint, statut text, moderation text,
  image text, images text[], video text, proprietaire_verifie boolean,
  confirmee_le timestamptz, note_moyenne numeric, nb_avis integer,
  proprio_note numeric, proprio_nb_avis integer,
  a_la_une boolean, est_a_moi boolean, rang bigint
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
         row_number() over (order by l.created_at desc)                            -- rang
  from public.listings l
  where l.moderation = 'approuvee';   -- annonces validées seulement
$$;
revoke execute on function public.annonces_publiques() from public;
grant execute on function public.annonces_publiques() to anon, authenticated;


-- ═════════ 2. NUMÉRO : seulement au clic sur « Contacter » ═════════
-- Renvoie le numéro d'UNE annonce publiée et disponible (sinon : vide), et compte +1 clic
-- pour les statistiques du propriétaire (remplace increment_whatsapp, gardée pour l'ancien site).
-- Limite honnête : un programmeur pourrait encore appeler cette fonction annonce par annonce,
-- comme sur tous les sites d'annonces. Mais il n'y a plus de liste complète en une requête.
create or replace function public.contacter_annonce(p_id uuid)
returns text language plpgsql security definer set search_path = public
as $$ declare v_tel text;
begin
  select telephone into v_tel from public.listings
   where id = p_id and moderation = 'approuvee' and statut = 'Disponible';
  if v_tel is null then
    return null;   -- introuvable, non publiée, déjà louée ou sans numéro
  end if;
  -- +1 clic : on passe le verrou des compteurs, comme increment_whatsapp (fichier 01)
  perform set_config('immoci.bypass', '1', true);
  update public.listings set clics_whatsapp = clics_whatsapp + 1 where id = p_id;
  perform set_config('immoci.bypass', '', true);
  return v_tel;
end; $$;
revoke execute on function public.contacter_annonce(uuid) from public;
grant execute on function public.contacter_annonce(uuid) to anon, authenticated;


-- ═════════ 3. TABLE DES ANNONCES : propriétaire et admin seulement ═════════
-- Avant : « annonce validée OU la mienne OU je suis admin ».
-- Après : « la mienne OU je suis admin ». Les visiteurs passent par le point 1.
-- Les fonctions internes (avis, signalements, compteurs, limites) ne sont pas gênées :
-- elles sont toutes « security definer ».
drop policy if exists "listing_read" on public.listings;
create policy "listing_read" on public.listings for select
  using (owner_id = auth.uid() or public.is_admin());


-- ═════════ 4. AVIS : même principe ═════════
-- Le site affiche le prénom (+ initiale), la note, le commentaire et la date.
-- L'identifiant de l'auteur et le statut ne sortent plus.
create or replace function public.avis_publics(p_listing uuid)
returns table (id uuid, author_name text, rating smallint, comment text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.id, r.author_name, r.rating, r.comment, r.created_at
  from public.reviews r
  where r.listing_id = p_listing and r.status = 'approuve';   -- avis publiés seulement
$$;
revoke execute on function public.avis_publics(uuid) from public;
grant execute on function public.avis_publics(uuid) to anon, authenticated;

-- La table des avis : l'auteur (pour voir « votre avis est en attente ») et l'admin.
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews for select
  using (author_id = auth.uid() or public.is_admin());


-- ═════════ 5. VÉRIFICATION ═════════
-- Doit afficher 5 lignes :
--   annonces_publiques, avis_publics, contacter_annonce (fonctions)
--   listing_read : (owner_id = auth.uid()) OR is_admin()
--   reviews_read : (author_id = auth.uid()) OR is_admin()
select p.proname as element, 'fonction' as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('annonces_publiques', 'contacter_annonce', 'avis_publics')
union all
select polname, pg_get_expr(polqual, polrelid)
  from pg_policy
 where polname in ('listing_read', 'reviews_read');
