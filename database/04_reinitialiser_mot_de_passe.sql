-- Support : réinitialiser le mot de passe d'un utilisateur qui l'a oublié (il n'y a pas d'envoi SMS/email).
-- Remplacez le numéro et le mot de passe temporaire, puis Run. Demandez à l'utilisateur de le changer dans « Mon espace ».
update auth.users
set encrypted_password = crypt('MotDePasseTemporaire123', gen_salt('bf')), updated_at = now()
where email = '0700000000@immoci.app';
