-- ═══════════════════════════════════════════════════════════════════
-- 10_suppression_pieces_identite.sql : effacer les pièces d'identité après décision (v7)
-- À exécuter UNE fois, APRÈS 09. Peut être relancé sans danger. N'efface aucune donnée.
--
-- Pourquoi ? La politique de confidentialité promet que les pièces d'identité ne sont
-- gardées que le temps de la vérification. Avant ce fichier, rien ne les supprimait :
-- elles restaient pour toujours dans le bucket privé « verifications ».
--
-- Fonctionnement (côté site, js/admin.js) : quand l'admin valide ou refuse une demande,
--   1. le fichier est supprimé du stockage (il faut la règle n°1 ci-dessous) ;
--   2. la fonction n°2 efface le chemin du fichier dans la demande.
-- La demande elle-même (qui, quand, accepté ou refusé) est gardée : c'est la preuve
-- que la vérification a eu lieu, sans conserver la pièce.
--
-- ⚠ Une suppression directe dans la table storage.objects est interdite par Supabase :
-- les fichiers doivent être supprimés par le site (API Storage), d'où le partage des rôles.
-- ═══════════════════════════════════════════════════════════════════


-- ───────── 1. L'admin peut supprimer les fichiers du bucket « verifications » ─────────
-- for delete : règle qui s'applique aux suppressions ;
-- to authenticated : seulement les personnes connectées ;
-- using (...) : la ligne doit être dans le bucket « verifications » ET l'appelant doit être admin.
drop policy if exists "verif_files_delete_admin" on storage.objects;
create policy "verif_files_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'verifications' and public.is_admin());


-- ───────── 2. Oublier le chemin du document d'une demande ─────────
-- security definer : la fonction s'exécute avec les droits de son créateur (elle peut modifier
-- la table), MAIS elle vérifie elle-même que l'appelant est admin avant de faire quoi que ce soit.
create or replace function public.forget_verification_document(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.verification_requests
     set document_path = null          -- le fichier n'existe plus : on efface son adresse
   where id = p_id;
end; $$;
-- Les visiteurs non connectés ne peuvent pas l'appeler
revoke execute on function public.forget_verification_document(uuid) from anon;


-- ───────── Vérification ─────────
-- Doit afficher une ligne : verif_files_delete_admin
select policyname from pg_policies where policyname = 'verif_files_delete_admin';
