-- ═══════════════════════════════════════════════════════════════════
-- 11_audit_securite.sql : corrections de l'audit de sécurité du 2026-11-18 (v7.1)
-- À exécuter UNE fois, APRÈS 10. Peut être relancé sans danger. N'efface aucune donnée.
--
-- ⚠ ORDRE : 1) exécuter CE fichier, 2) PUIS redéployer l'Edge Function
--   « reinitialiser-mot-de-passe » (nouveau code dans supabase/functions/…/index.ts).
--   Le nouveau code utilise les fonctions de la partie 1 : sans ce fichier, il échouerait.
--
-- Résumé des failles corrigées (détails dans docs/SECURITE.md) :
--   1. Codes de récupération : essais comptés de façon atomique (course de vitesse).
--   2. Inscription : le numéro du profil est lié au vrai identifiant de connexion.
--   3. Dates falsifiables : limites anti-spam contournables, annonce épinglée en tête.
--   4. Signalements : comptes jetables ne suffisent plus à masquer une annonce.
--   5. Demandes de vérification : chemin du document forcé dans le dossier du demandeur.
--   6. Photos : uniquement depuis le stockage Domi, dans le dossier de l'annonceur.
--   7. Numéro de contact modifié : l'annonce repasse toujours en validation.
--   8. Stockage : quotas par utilisateur, liste publique des photos fermée.
--   9. Droits d'appel des fonctions sensibles nettoyés.
-- ═══════════════════════════════════════════════════════════════════


-- ═════════ 1. CODES DE RÉCUPÉRATION : opérations atomiques ═════════
-- FAILLE : l'Edge Function lisait le nombre d'essais, comparait le code, puis écrivait
-- « essais + 1 ». En envoyant des centaines de requêtes EN MÊME TEMPS, toutes lisaient
-- « 0 essai » : la limite de 5 essais ne s'appliquait plus et un pirate pouvait tester
-- des milliers de codes pendant les 10 minutes de validité → prise de contrôle du compte.
-- CORRECTION : le comptage se fait dans la base, en une seule opération verrouillée.

-- a) Créer un code : verrou par compte + limite de 3 par heure + annulation des anciens
create or replace function public.reset_creer(p_user uuid, p_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- pg_advisory_xact_lock : une seule demande à la fois pour ce compte (les autres attendent)
  perform pg_advisory_xact_lock(hashtext('domi-reset:' || p_user::text));
  delete from public.password_resets                       -- ménage : codes de plus d'un jour
   where user_id = p_user and created_at < now() - interval '1 day';
  select count(*) into n from public.password_resets       -- codes créés dans la dernière heure
   where user_id = p_user and created_at > now() - interval '1 hour';
  if n >= 3 then return false; end if;                     -- limite atteinte : aucun email envoyé
  update public.password_resets set used_at = now()        -- un seul code actif : les anciens sont annulés
   where user_id = p_user and used_at is null;
  insert into public.password_resets (user_id, code_hash, expires_at)
  values (p_user, p_hash, now() + interval '10 minutes');  -- valable 10 minutes
  return true;
end; $$;

-- b) Compter un essai AVANT de comparer : « for update » verrouille la ligne, donc deux
--    requêtes simultanées passent l'une après l'autre. Au-delà de 5 essais : plus rien.
create or replace function public.reset_essai(p_user uuid)
returns table (reset_id uuid, code_hash text, essai int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.password_resets r
     set attempts = r.attempts + 1,                                     -- +1, de façon atomique
         used_at  = case when r.attempts + 1 >= 5 then now() else r.used_at end -- 5e essai : code annulé
   where r.id = (select x.id from public.password_resets x              -- dernier code actif du compte
                  where x.user_id = p_user and x.used_at is null and x.expires_at > now()
                  order by x.created_at desc limit 1
                  for update)
     and r.attempts < 5
  returning r.id, r.code_hash, r.attempts::int;
end; $$;

-- c) Code correct : on le consomme et on déconnecte tous les appareils du compte
--    (si un pirate avait une session ouverte, elle est coupée).
create or replace function public.reset_terminer(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.password_resets set used_at = coalesce(used_at, now()) where user_id = p_user;
  begin
    delete from auth.sessions where user_id = p_user;    -- toutes les sessions de ce compte
  exception when others then
    raise notice 'Sessions non supprimées : %', sqlerrm; -- sans gravité : le mot de passe est changé
  end;
end; $$;

-- Ces 3 fonctions ne doivent être appelées QUE par l'Edge Function (clé service_role)
revoke execute on function public.reset_creer(uuid, text) from public, anon, authenticated;
revoke execute on function public.reset_essai(uuid) from public, anon, authenticated;
revoke execute on function public.reset_terminer(uuid) from public, anon, authenticated;
grant execute on function public.reset_creer(uuid, text), public.reset_essai(uuid), public.reset_terminer(uuid) to service_role;


-- ═════════ 2. INSCRIPTION : numéro lié à l'identifiant de connexion ═════════
-- FAILLE : le numéro du profil venait d'un champ envoyé par le navigateur, séparé de
-- l'identifiant de connexion (0700000000@immoci.app). Avec F12, quelqu'un pouvait
-- s'inscrire avec SON identifiant mais le numéro d'une autre personne dans le profil :
-- la vraie personne ne pouvait ensuite plus jamais s'inscrire (numéro « déjà pris »),
-- et le compte pirate portait son numéro (usurpation, demande de badge…).
-- CORRECTION : le numéro est lu dans l'identifiant de connexion lui-même. Toute
-- inscription qui ne passe pas par le format du site est refusée.
-- ⚠ Conséquence : « Add user » dans le tableau de bord Supabase avec un vrai email est
--   refusé aussi. Pour créer un compte, passer par le site.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  -- substring(... from 'motif') : extrait les 10 chiffres de « 0700000000@immoci.app »
  v_tel   text := substring(lower(new.email) from '^([0-9]{10})@immoci\.app$');
  v_email text := nullif(lower(trim(new.raw_user_meta_data->>'email_recuperation')), '');
begin
  if v_tel is null then
    raise exception 'Inscription refusée : utilisez le formulaire du site Domi.';
  end if;
  -- Email de récupération mal formé ou trop long : ignoré (l'inscription continue)
  if v_email is not null and (v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 120) then
    v_email := null;
  end if;
  insert into public.profiles (id, nom, prenom, telephone, commune, role, email_recuperation)
  values (new.id,
    left(coalesce(new.raw_user_meta_data->>'nom', ''), 60),        -- 60 caractères max
    left(coalesce(new.raw_user_meta_data->>'prenom', ''), 60),
    v_tel,                                                          -- numéro = identifiant de connexion
    left(nullif(new.raw_user_meta_data->>'commune', ''), 60),
    case when new.raw_user_meta_data->>'role' = 'agent' then 'agent' else 'proprietaire' end, -- jamais admin
    v_email)
  on conflict (id) do nothing;
  return new;
end; $$;

-- Format du numéro dans les profils (10 chiffres) pour les nouvelles écritures
alter table public.profiles drop constraint if exists profiles_telephone_format;
alter table public.profiles add constraint profiles_telephone_format
  check (telephone is null or telephone ~ '^[0-9]{10}$') not valid;


-- ═════════ 3 + 6 + 7. ANNONCES : dates, photos, numéro de contact ═════════
-- FAILLE 3 : created_at et confirmee_le étaient modifiables depuis le navigateur.
--   • created_at dans le passé → l'annonce n'était pas comptée dans la limite de
--     10 annonces par jour (database/09) → spam illimité ;
--   • created_at dans le futur → annonce épinglée en tête de liste pour toujours ;
--   • confirmee_le dans le futur → jamais masquée après 45 jours, « confirmée aujourd'hui » à vie.
-- FAILLE 7 : un annonceur vérifié pouvait changer le numéro de contact d'une annonce
--   publiée sans nouvelle validation (arnaque classique : gagner la confiance puis
--   remplacer le numéro). Et certains champs (avance, caution…) échappaient à la revalidation.
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
      new.created_at := now();      -- NOUVEAU : date de création fixée par le serveur
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
    new.created_at := old.created_at;                         -- NOUVEAU : date de création figée
    if new.confirmee_le is distinct from old.confirmee_le then
      new.confirmee_le := now();                              -- NOUVEAU : « confirmer » = maintenant, jamais une date choisie
    end if;
    if old.moderation <> 'en_attente' then
      if new.telephone is distinct from old.telephone then
        new.moderation := 'en_attente';                       -- NOUVEAU : numéro changé → toujours revalidé
      elsif (new.titre, new.description, new.type, new.loyer, new.commune, new.quartier, new.adresse,
             new.image, new.images, new.video, new.cie, new.sodeci, new.avance, new.caution, new.etage, new.chambres)
         is distinct from
            (old.titre, old.description, old.type, old.loyer, old.commune, old.quartier, old.adresse,
             old.image, old.images, old.video, old.cie, old.sodeci, old.avance, old.caution, old.etage, old.chambres)
      then
        -- vérifié : reste publiée ; non vérifié (ou annonce refusée) : repart en validation
        new.moderation := case when v and old.moderation = 'approuvee' then 'approuvee' else 'en_attente' end;
      end if;
    end if;
  end if;
  return new;
end; $$;

-- FAILLE 6 : les photos acceptaient n'importe quelle adresse https (et le tableau
-- « images » n'était même pas contrôlé). Un annonceur pouvait, via l'API, afficher des
-- images hébergées chez lui : il voyait alors l'adresse IP de chaque visiteur (traceur),
-- ou réutilisait les photos d'un autre annonceur.
-- CORRECTION : photos obligatoirement dans le stockage Domi, dans le dossier de l'annonceur.
create or replace function public.photos_domi_ok(p_owner uuid, p_image text, p_images text[])
returns boolean language sql immutable as $$
  select (p_image is null
          or p_image like 'https://mplbhzqmffaywlhbxleb.supabase.co/storage/v1/object/public/annonces/' || p_owner::text || '/%')
     and not exists (select 1 from unnest(coalesce(p_images, '{}')) u
                     where u not like 'https://mplbhzqmffaywlhbxleb.supabase.co/storage/v1/object/public/annonces/' || p_owner::text || '/%');
$$;
alter table public.listings drop constraint if exists listings_photos_domi;
alter table public.listings add constraint listings_photos_domi
  check (public.photos_domi_ok(owner_id, image, images)) not valid;
-- ⚠ Si un jour le projet Supabase change, remplacer « mplbhzqmffaywlhbxleb » ci-dessus.

-- Lien vidéo : uniquement les plateformes vidéo connues (un lien vers un faux site de
-- « paiement de la caution » affiché comme « Voir la visite vidéo » est un piège efficace)
alter table public.listings drop constraint if exists listings_video_hosts;
alter table public.listings add constraint listings_video_hosts
  check (video is null or video ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com|vimeo\.com|drive\.google\.com)(/|$)') not valid;


-- ═════════ 3 (suite). SIGNALEMENTS, AVIS : dates et statut forcés ═════════
-- FAILLE : un signalement envoyé avec une date ancienne n'était pas compté dans les
-- limites (20 par heure et par annonce, 60 par minute) → inondation possible.
create or replace function public.limit_reports()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then
    new.created_at := now();          -- NOUVEAU : date fixée par le serveur
    new.status := 'ouvert';           -- NOUVEAU : un signalement commence toujours « ouvert »
  end if;
  -- a) Un utilisateur connecté ne signale qu'une fois la même annonce (tant que c'est ouvert)
  if new.reporter_id is not null and exists (
    select 1 from public.reports
    where listing_id = new.listing_id and reporter_id = new.reporter_id and status in ('ouvert','en_cours')
  ) then
    raise exception 'Vous avez déjà signalé cette annonce. Notre équipe s''en occupe.';
  end if;
  -- b) 20 signalements maximum par annonce et par heure
  select count(*) into n from public.reports
   where listing_id = new.listing_id and created_at > now() - interval '1 hour';
  if n >= 20 then
    raise exception 'Cette annonce a déjà été signalée de nombreuses fois. Merci, elle est en cours d''examen.';
  end if;
  -- c) 60 signalements maximum par minute sur tout le site
  select count(*) into n from public.reports where created_at > now() - interval '1 minute';
  if n >= 60 then
    raise exception 'Trop de signalements en ce moment. Réessayez dans une minute.';
  end if;
  return new;
end; $$;

-- Avis : même règle pour la date (sinon un avis pouvait être placé en tête pour toujours)
create or replace function public.protect_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'en_attente';
    new.created_at := now();          -- NOUVEAU : date fixée par le serveur
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


-- ═════════ 4. SIGNALEMENTS : fin du sabotage par comptes jetables ═════════
-- FAILLE : 3 signalements de 3 comptes différents masquaient une annonce. Un compte se
-- crée en 30 secondes sans vérification : un concurrent pouvait faire disparaître
-- n'importe quelle annonce avec 3 comptes jetables, encore et encore.
-- CORRECTION : seuls comptent les comptes inscrits depuis au moins 7 jours (les
-- anonymes comptent toujours pour UNE seule source), et il en faut 5 pour l'annonce
-- d'un propriétaire vérifié. Les autres signalements restent visibles par l'admin.
create or replace function public.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int; seuil int;
begin
  select count(distinct coalesce(r.reporter_id::text, 'anonyme')) into n
    from public.reports r
    left join public.profiles p on p.id = r.reporter_id
   where r.listing_id = new.listing_id
     and r.status in ('ouvert','en_cours')
     and (r.reporter_id is null or p.created_at < now() - interval '7 days');   -- comptes « anciens » seulement
  select case when proprietaire_verifie then 5 else 3 end into seuil
    from public.listings where id = new.listing_id;
  if n >= coalesce(seuil, 3) then
    perform set_config('immoci.bypass', '1', true);
    update public.listings set moderation = 'en_attente' where id = new.listing_id and moderation = 'approuvee';
    perform set_config('immoci.bypass', '', true);
  end if;
  return null;
end; $$;


-- ═════════ 5. DEMANDES DE VÉRIFICATION : document dans SON dossier ═════════
-- FAILLE : le chemin du document était libre. Une demande pouvait désigner le fichier
-- d'une autre personne ; à la décision, l'admin aurait supprimé la pièce de cette personne.
create or replace function public.protect_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'en_attente';                          -- toujours en attente au départ
    new.reviewer_id := null; new.reviewer_note := null; new.reviewed_at := null;
    new.created_at := now();
    -- le document doit être dans le dossier du demandeur : « <son identifiant>/… »
    if new.document_path is null or new.document_path not like new.user_id::text || '/%'
       or new.document_path like '%..%' then
      raise exception 'Document invalide.';
    end if;
    if char_length(coalesce(new.document_type, '')) > 60 then
      raise exception 'Type de document invalide.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists protect_verification_trigger on public.verification_requests;
create trigger protect_verification_trigger before insert on public.verification_requests
for each row execute procedure public.protect_verification();


-- ═════════ 8. STOCKAGE : quotas et liste des photos ═════════
-- FAILLE (quota) : un compte gratuit pouvait envoyer des milliers de fichiers de 3 Mo
-- par l'API et remplir le stockage gratuit (1 Go) : plus personne ne pouvait publier.
-- CORRECTION : 150 fichiers et 60 Mo par compte pour les photos, 5 fichiers et 25 Mo
-- pour les pièces d'identité ; photos limitées à 2 Mo (le site les compresse à ~300 Ko).
create or replace function public.quota_ok(p_bucket text, p_max_fichiers int, p_max_octets bigint)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select count(*) < p_max_fichiers
     and coalesce(sum((metadata->>'size')::bigint), 0) < p_max_octets
    from storage.objects
   where bucket_id = p_bucket and (storage.foldername(name))[1] = auth.uid()::text;  -- fichiers de l'appelant
$$;

drop policy if exists "annonces_insert_own" on storage.objects;
create policy "annonces_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'annonces'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.quota_ok('annonces', 150, 62914560));          -- 150 fichiers, 60 Mo
drop policy if exists "verif_files_insert_own" on storage.objects;
create policy "verif_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'verifications'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.quota_ok('verifications', 5, 26214400));       -- 5 fichiers, 25 Mo
update storage.buckets set file_size_limit = 2097152 where id = 'annonces';  -- 2 Mo par photo

-- FAILLE (liste) : n'importe qui pouvait LISTER toutes les photos du bucket « annonces »
-- (identifiants des annonceurs, photos d'annonces refusées ou supprimées).
-- CORRECTION : seuls l'annonceur (son dossier) et l'admin peuvent lister. Les photos
-- restent affichées normalement : un bucket public sert ses fichiers par leur adresse
-- sans passer par cette règle.
drop policy if exists "annonces_read" on storage.objects;
create policy "annonces_read" on storage.objects for select to authenticated
  using (bucket_id = 'annonces' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- ═════════ 9. DROITS D'APPEL DES FONCTIONS SENSIBLES ═════════
-- « revoke … from anon » ne suffit pas : PostgreSQL donne aussi le droit à « public »
-- (tout le monde). Ces fonctions vérifiaient déjà is_admin(), on ferme quand même la porte.
revoke execute on function public.decide_verification(uuid, boolean, text) from public, anon;
grant execute on function public.decide_verification(uuid, boolean, text) to authenticated;
revoke execute on function public.forget_verification_document(uuid) from public, anon;
grant execute on function public.forget_verification_document(uuid) to authenticated;


-- ═════════ CONTRÔLES (résultat attendu : AUCUNE ligne) ═════════
-- Profils dont le numéro ne correspond pas à l'identifiant de connexion (comptes créés
-- avant cette correction en contournant le site). S'il y en a : me les montrer.
-- Annonces dont les photos ou la vidéo ne respectent pas les nouvelles règles : elles
-- s'affichent toujours, mais leur propriétaire devra corriger ces champs à la prochaine modification.
select 'profil' as quoi, p.id::text as id, p.telephone as detail
  from public.profiles p join auth.users u on u.id = p.id
 where p.telephone is distinct from substring(lower(u.email) from '^([0-9]{10})@immoci\.app$')
union all
select 'annonce', l.id::text, l.titre
  from public.listings l
 where not public.photos_domi_ok(l.owner_id, l.image, l.images)
    or (l.video is not null and l.video !~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com|vimeo\.com|drive\.google\.com)(/|$)');
