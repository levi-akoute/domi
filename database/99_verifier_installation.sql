-- ═══════════════════════════════════════════════════════════════════
-- 99_verifier_installation.sql : ce qui est installé dans Supabase (LECTURE SEULE)
-- Ne modifie RIEN. À exécuter quand vous voulez, autant de fois que vous voulez.
-- Supabase › SQL Editor › New query › coller tout › Run.
--
-- Résultat : une ligne par fichier de database/.
--   ✅ installé      tout ce que crée ce fichier est présent dans la base
--   ❌ manque        la colonne « detail » dit ce qui manque : exécutez ce fichier
--   ➖ ponctuel      fichier d'usage unique (nettoyage, dépannage) : rien à vérifier
--
-- Comment ça marche : chaque fichier crée des éléments précis (tables, colonnes, fonctions,
-- déclencheurs, règles). On demande simplement à la base si ces éléments existent.
-- ═══════════════════════════════════════════════════════════════════

with
-- Ce qui existe dans la base (catalogue interne de PostgreSQL)
fonctions as (select p.proname as nom from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
declencheurs as (select tgname as nom from pg_trigger where not tgisinternal),
regles as (select polname as nom, pg_get_expr(polqual, polrelid) as condition from pg_policy),
contraintes as (select conname as nom from pg_constraint),
colonnes as (select table_name || '.' || column_name as nom from information_schema.columns where table_schema = 'public'),

-- Ce que chaque fichier doit avoir créé
elements(fichier, quoi, present) as (values
  ('01_schema_supabase', 'table listings', to_regclass('public.listings') is not null),
  ('01_schema_supabase', 'table profiles', to_regclass('public.profiles') is not null),
  ('01_schema_supabase', 'table reports', to_regclass('public.reports') is not null),
  ('01_schema_supabase', 'table favorites', to_regclass('public.favorites') is not null),
  ('01_schema_supabase', 'table verification_requests', to_regclass('public.verification_requests') is not null),
  ('01_schema_supabase', 'fonction is_admin', exists (select 1 from fonctions where nom = 'is_admin')),
  ('01_schema_supabase', 'déclencheur protect_listing_trigger', exists (select 1 from declencheurs where nom = 'protect_listing_trigger')),
  ('01_schema_supabase', 'déclencheur on_auth_user_created', exists (select 1 from declencheurs where nom = 'on_auth_user_created')),

  ('05_avis', 'table reviews', to_regclass('public.reviews') is not null),
  ('05_avis', 'colonne listings.note_moyenne', exists (select 1 from colonnes where nom = 'listings.note_moyenne')),
  ('05_avis', 'déclencheur protect_review_trigger', exists (select 1 from declencheurs where nom = 'protect_review_trigger')),

  ('06_securite', 'contrainte listings_video_http', exists (select 1 from contraintes where nom = 'listings_video_http')),
  ('06_securite', 'contrainte listings_image_http', exists (select 1 from contraintes where nom = 'listings_image_http')),

  ('07_mot_de_passe_oublie', 'table password_resets', to_regclass('public.password_resets') is not null),
  ('07_mot_de_passe_oublie', 'colonne profiles.email_recuperation', exists (select 1 from colonnes where nom = 'profiles.email_recuperation')),

  ('08_moderation_mixte', 'déclencheur auto_hide_reported_trigger', exists (select 1 from declencheurs where nom = 'auto_hide_reported_trigger')),

  ('09_securite_renforcee', 'déclencheur limit_listing_inserts_trigger', exists (select 1 from declencheurs where nom = 'limit_listing_inserts_trigger')),
  ('09_securite_renforcee', 'déclencheur limit_reports_trigger', exists (select 1 from declencheurs where nom = 'limit_reports_trigger')),
  ('09_securite_renforcee', 'contrainte listings_telephone_format', exists (select 1 from contraintes where nom = 'listings_telephone_format')),

  ('10_suppression_pieces_identite', 'fonction forget_verification_document', exists (select 1 from fonctions where nom = 'forget_verification_document')),
  ('10_suppression_pieces_identite', 'règle verif_files_delete_admin', exists (select 1 from regles where nom = 'verif_files_delete_admin')),

  ('11_audit_securite', 'fonction reset_creer', exists (select 1 from fonctions where nom = 'reset_creer')),
  ('11_audit_securite', 'fonction photos_domi_ok', exists (select 1 from fonctions where nom = 'photos_domi_ok')),
  ('11_audit_securite', 'déclencheur protect_verification_trigger', exists (select 1 from declencheurs where nom = 'protect_verification_trigger')),
  ('11_audit_securite', 'contrainte listings_photos_domi', exists (select 1 from contraintes where nom = 'listings_photos_domi')),

  ('12_a_la_une', 'colonne listings.a_la_une_jusqu_au', exists (select 1 from colonnes where nom = 'listings.a_la_une_jusqu_au')),
  ('12_a_la_une', 'déclencheur protect_a_la_une_trigger', exists (select 1 from declencheurs where nom = 'protect_a_la_une_trigger')),
  ('12_a_la_une', 'déclencheur lock_role_trigger', exists (select 1 from declencheurs where nom = 'lock_role_trigger')),

  ('13_annonces_confidentielles', 'fonction annonces_publiques', exists (select 1 from fonctions where nom = 'annonces_publiques')),
  ('13_annonces_confidentielles', 'fonction contacter_annonce', exists (select 1 from fonctions where nom = 'contacter_annonce')),
  ('13_annonces_confidentielles', 'fonction avis_publics', exists (select 1 from fonctions where nom = 'avis_publics')),
  -- La règle listing_read du fichier 13 ne parle plus des annonces « approuvées »
  ('13_annonces_confidentielles', 'règle listing_read (propriétaire et admin seulement)',
     exists (select 1 from regles where nom = 'listing_read' and condition not like '%approuvee%')),
  ('13_annonces_confidentielles', 'règle reviews_read (auteur et admin seulement)',
     exists (select 1 from regles where nom = 'reviews_read' and condition not like '%approuve%'))
)

-- Une ligne par fichier : ✅ si tout est présent, sinon ❌ et la liste de ce qui manque
select fichier,
       case when bool_and(present) then '✅ installé' else '❌ manque' end as etat,
       coalesce(string_agg(quoi, ', ') filter (where not present), '') as detail
from elements
group by fichier

union all
select '00_nettoyage_ancienne_version', '➖ ponctuel', 'nettoyage d''une très ancienne version : rien à vérifier'

union all
-- 02 : les annonces d'exemple devaient être supprimées avant l'ouverture (on compte celles qui restent)
select '02_donnees_exemple',
       case when n = 0 then '✅ retirées' else '⚠ à supprimer' end,
       n || ' annonce(s) d''exemple encore dans la base'
from (select count(*) as n from public.listings where description like '[EXEMPLE]%') x

union all
-- 03 : au moins un compte admin (on affiche seulement le nombre)
select '03_creer_admin',
       case when n > 0 then '✅ installé' else '❌ manque' end,
       n || ' compte(s) admin'
from (select count(*) as n from public.profiles where role = 'admin') x

union all
select '04_reinitialiser_mot_de_passe', '➖ ponctuel', 'outil de dépannage d''un compte : rien à vérifier'

order by fichier;
