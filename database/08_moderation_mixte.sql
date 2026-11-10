-- ═══════════════════════════════════════════════════════════════════
-- 08_moderation_mixte.sql : modération mixte + masquage automatique (v5)
-- À exécuter UNE fois, APRÈS 06 et 07. Peut être relancé sans danger.
--
-- Règles :
--   • Propriétaire VÉRIFIÉ (badge)    → son annonce est publiée immédiatement.
--   • Propriétaire NON vérifié        → son annonce attend la validation de l'admin.
--   • Annonce signalée 3 fois (signalements ouverts, par 3 sources différentes)
--     → elle repasse automatiquement « en attente » et disparaît du public
--       jusqu'à ce que l'admin la revoie.
--
-- Ce fichier remplace la fonction protect_listing de 06 par une version qui
-- contient TOUT (protection des notes + modération mixte).
-- ═══════════════════════════════════════════════════════════════════


-- ───────── 1. protect_listing, version complète ─────────
create or replace function public.protect_listing()
returns trigger language plpgsql security definer set search_path = public
as $$ declare v boolean;
begin
  if current_setting('immoci.bypass', true) = '1' then return new; end if;

  -- Le propriétaire est-il vérifié ? (lu dans la base, jamais depuis le navigateur)
  select coalesce(verifie,false) into v from public.profiles where id = coalesce(new.owner_id, old.owner_id);
  v := coalesce(v,false);

  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      -- NOUVEAU : publication directe si vérifié, sinon validation
      new.moderation := case when v then 'approuvee' else 'en_attente' end;
      new.proprietaire_verifie := v;
      new.vues := 0; new.clics_whatsapp := 0; new.confirmee_le := now();
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
    new.note_moyenne := old.note_moyenne; new.nb_avis := old.nb_avis;
    new.proprio_note := old.proprio_note; new.proprio_nb_avis := old.proprio_nb_avis;
    -- Contenu modifié sur une annonce déjà validée ou refusée :
    --   vérifié     → reste publiée (une annonce refusée repart quand même en validation)
    --   non vérifié → repart en validation
    if old.moderation <> 'en_attente' and
      (new.titre,new.description,new.type,new.loyer,new.commune,new.quartier,new.image,new.images,new.video,new.telephone)
      is distinct from
      (old.titre,old.description,old.type,old.loyer,old.commune,old.quartier,old.image,old.images,old.video,old.telephone)
    then
      new.moderation := case when v and old.moderation = 'approuvee' then 'approuvee' else 'en_attente' end;
    end if;
  end if;
  return new;
end; $$;


-- ───────── 2. Masquage automatique après 3 signalements ─────────
-- Une source = un utilisateur connecté (reporter_id) ; les signalements anonymes
-- comptent ensemble pour UNE seule source, pour qu'une personne seule ne puisse
-- pas faire disparaître l'annonce d'un concurrent.
create or replace function public.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(distinct coalesce(reporter_id::text, 'anonyme')) into n
  from public.reports
  where listing_id = new.listing_id and status in ('ouvert','en_cours');

  if n >= 3 then
    perform set_config('immoci.bypass','1',true);   -- laissez-passer interne
    update public.listings set moderation = 'en_attente'
    where id = new.listing_id and moderation = 'approuvee';
    perform set_config('immoci.bypass','',true);
  end if;
  return null;
end; $$;

drop trigger if exists auto_hide_reported_trigger on public.reports;
create trigger auto_hide_reported_trigger after insert on public.reports
for each row execute procedure public.auto_hide_reported();


-- ───────── Vérification ─────────
-- Doit afficher : auto_hide_reported_trigger
select tgname from pg_trigger where tgname = 'auto_hide_reported_trigger';
