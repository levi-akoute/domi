-- ═══════════════════════════════════════════════════════════════════
-- 06_securite.sql : corrections de sécurité (v5)
-- À exécuter UNE fois : Supabase > SQL Editor > New query > coller > Run.
-- Peut être relancé sans danger. N'efface aucune donnée.
--
-- ⚠ Ordre : exécutez 06, puis 07, puis 08. Si vous avez déjà exécuté 08,
--   ne relancez pas 06 seul (08 contient une version plus complète de
--   protect_listing ; 06 l'écraserait par une version sans modération mixte).
-- ═══════════════════════════════════════════════════════════════════


-- ───────── FAILLE 1 : liens « javascript: » dans les annonces ─────────
-- Un fraudeur pouvait saisir « javascript:... » comme lien de visite vidéo.
-- Si un administrateur cliquait dessus, le code s'exécutait avec SA session.
-- Le site filtre maintenant ces liens (safeUrl dans utils.js), mais la base
-- doit aussi les refuser : le JavaScript du navigateur peut être contourné.
--
-- « ~* » = correspond à l'expression régulière, sans tenir compte des majuscules.
-- « not valid » = la règle s'applique aux nouvelles écritures, sans bloquer
-- si une ancienne ligne ne la respecte pas (évite un échec de la commande).
alter table public.listings drop constraint if exists listings_video_http;
alter table public.listings add constraint listings_video_http
  check (video is null or video ~* '^https?://') not valid;

alter table public.listings drop constraint if exists listings_image_http;
alter table public.listings add constraint listings_image_http
  check (image is null or image ~* '^https?://') not valid;


-- ───────── FAILLE 2 : un propriétaire pouvait truquer ses notes ─────────
-- Les colonnes note_moyenne, nb_avis, proprio_note et proprio_nb_avis
-- (ajoutées par 05_avis.sql) n'étaient pas protégées : un propriétaire
-- pouvait écrire « 5 étoiles, 200 avis » sur sa propre annonce.
-- On réécrit protect_listing pour remettre ces valeurs à leur ancienne
-- valeur quand ce n'est pas un administrateur qui modifie.

-- Sécurité : on s'assure que ces colonnes existent (au cas où 05_avis.sql
-- n'aurait pas été exécuté), sinon la fonction ci-dessous planterait.
alter table public.listings add column if not exists note_moyenne numeric(2,1) not null default 0;
alter table public.listings add column if not exists nb_avis integer not null default 0;
alter table public.listings add column if not exists proprio_note numeric(2,1) not null default 0;
alter table public.listings add column if not exists proprio_nb_avis integer not null default 0;

create or replace function public.protect_listing()
returns trigger language plpgsql security definer set search_path = public
as $$ declare v boolean;
begin
  -- Les fonctions internes (compteurs, recalcul des notes) activent ce « laissez-passer »
  if current_setting('immoci.bypass', true) = '1' then return new; end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      select coalesce(verifie,false) into v from public.profiles where id = new.owner_id;
      new.moderation := 'en_attente';
      new.proprietaire_verifie := coalesce(v,false);
      new.vues := 0; new.clics_whatsapp := 0; new.confirmee_le := now();
      -- NOUVEAU : une annonce commence sans note
      new.note_moyenne := 0; new.nb_avis := 0;
      new.proprio_note := 0; new.proprio_nb_avis := 0;
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
    -- NOUVEAU : les notes ne peuvent être changées que par le recalcul automatique
    new.note_moyenne := old.note_moyenne; new.nb_avis := old.nb_avis;
    new.proprio_note := old.proprio_note; new.proprio_nb_avis := old.proprio_nb_avis;
    -- Toute modification du contenu d'une annonce validée la renvoie en validation
    if old.moderation <> 'en_attente' and
      (new.titre,new.description,new.type,new.loyer,new.commune,new.quartier,new.image,new.images,new.video,new.telephone)
      is distinct from
      (old.titre,old.description,old.type,old.loyer,old.commune,old.quartier,old.image,old.images,old.video,old.telephone)
    then new.moderation := 'en_attente'; end if;
  end if;
  return new;
end; $$;


-- ───────── Vérification ─────────
-- Doit afficher 2 lignes : listings_image_http et listings_video_http
select conname from pg_constraint
where conrelid = 'public.listings'::regclass and conname like 'listings_%_http'
order by conname;
