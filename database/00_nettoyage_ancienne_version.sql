-- ⚠ À exécuter UNIQUEMENT si vous aviez déjà lancé l'ancien schéma (version 1).
-- Cela supprime les anciennes tables ImmoCI et leurs données, puis vous relancez 01 et 02.
drop table if exists public.favorites cascade;
drop table if exists public.reports cascade;
drop table if exists public.verification_requests cascade;
drop table if exists public.listings cascade;
drop table if exists public.profiles cascade;
