-- ═══════════════════════════════════════════════════════════════════
-- 12_a_la_une.sql : mise en avant « À la une » + verrouillage des rôles (v7.2)
-- À exécuter UNE fois, APRÈS 11. Peut être relancé sans danger. N'efface aucune donnée.
-- Supabase › SQL Editor › New query › coller tout › Run.
--
-- Tant que ce fichier n'est pas exécuté, le site fonctionne normalement : la vitrine
-- montre les dernières annonces, et seuls les boutons « À la une » de l'admin échouent.
-- ═══════════════════════════════════════════════════════════════════


-- ═════════ 1. « À LA UNE » ═════════
-- Une annonce est « à la une » tant que cette date est dans le futur.
-- null (vide) = annonce normale. À la date de fin, elle redevient normale TOUTE SEULE :
-- rien à désactiver, aucun risque d'oubli.
alter table public.listings add column if not exists a_la_une_jusqu_au timestamptz;

-- Règles, vérifiées ici dans la base (le JavaScript peut être contourné avec F12) :
--   a) seul un administrateur peut mettre ou retirer une annonce à la une ;
--   b) seulement les annonces de propriétaires VÉRIFIÉS (la vitrine ne doit jamais montrer une arnaque) ;
--   c) au plus 93 jours d'avance (protège contre une faute de frappe : « 2062 » au lieu de « 2026 »).
create or replace function public.protect_a_la_une()
returns trigger language plpgsql security definer set search_path = public
as $$ declare v boolean;
begin
  -- Fonctions internes (compteurs de vues et de clics) : elles ne touchent pas à cette colonne
  if current_setting('immoci.bypass', true) = '1' then return new; end if;

  -- a) Un utilisateur connecté qui n'est pas admin : la valeur est remise à l'ancienne (ou vide)
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.a_la_une_jusqu_au := null;
    else
      new.a_la_une_jusqu_au := old.a_la_une_jusqu_au;
    end if;
    return new;
  end if;

  -- Admin (ou SQL Editor) : contrôles seulement si la date est nouvelle ou modifiée
  if new.a_la_une_jusqu_au is not null
     and (tg_op = 'INSERT' or new.a_la_une_jusqu_au is distinct from old.a_la_une_jusqu_au) then
    -- b) propriétaire vérifié ? (lu dans son profil)
    select coalesce(verifie, false) into v from public.profiles where id = new.owner_id;
    if not coalesce(v, false) then
      raise exception 'À la une : réservé aux annonces de propriétaires vérifiés.';
    end if;
    -- c) durée raisonnable
    if new.a_la_une_jusqu_au > now() + interval '93 days' then
      raise exception 'À la une : 93 jours au maximum à partir d''aujourd''hui.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists protect_a_la_une_trigger on public.listings;
create trigger protect_a_la_une_trigger before insert or update on public.listings
for each row execute procedure public.protect_a_la_une();


-- ═════════ 2. VERROUILLAGE DES RÔLES ═════════
-- Avant : un admin pouvait, avec F12, changer le rôle de n'importe qui (nommer d'autres
-- admins, ou retirer le rôle d'admin à Levi). Le site n'a aucun bouton pour ça, donc ce
-- verrou ne gêne rien.
-- Après : PLUS PERSONNE ne peut changer un rôle depuis le site, même un admin.
-- Seul le SQL Editor de Supabase le peut (là, auth.uid() est vide) :
--   update public.profiles set role = 'admin' where telephone = '07XXXXXXXX';
create or replace function public.lock_role()
returns trigger language plpgsql set search_path = public
as $$ begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Le rôle d''un compte se change uniquement depuis Supabase (SQL Editor).';
  end if;
  return new;
end; $$;

drop trigger if exists lock_role_trigger on public.profiles;
create trigger lock_role_trigger before update on public.profiles
for each row execute procedure public.lock_role();


-- ═════════ 3. VÉRIFICATION ═════════
-- Doit afficher 2 lignes : protect_a_la_une_trigger (listings) et lock_role_trigger (profiles)
select tgname as declencheur, tgrelid::regclass as table_concernee
from pg_trigger
where tgname in ('protect_a_la_une_trigger', 'lock_role_trigger');
