-- Devenir administrateur.
-- 1) Créez d'abord votre compte normalement sur le site (connexion.html?inscription=1).
-- 2) Remplacez 0700000000 par VOTRE numéro (10 chiffres, tel que saisi à l'inscription), puis Run.
update public.profiles set role = 'admin' where telephone = '0700000000';
select id, prenom, nom, telephone, role from public.profiles where role = 'admin';  -- doit afficher votre ligne
-- 3) Sur le site : déconnectez-vous, reconnectez-vous → vous arrivez sur admin.html
