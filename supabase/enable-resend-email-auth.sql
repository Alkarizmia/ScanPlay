-- ============================================================
-- ScanPlay — ACTIVER l'email de confirmation (Resend + Supabase)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- AVANT ce SQL, configure le Dashboard Supabase :
--
--   1) Authentication → SMTP Settings
--        Enable Custom SMTP : ON
--        Sender name      : ScanPlay
--        Sender email     : support@scanplay.org
--        Host             : smtp.resend.com
--        Port             : 465  (ou 587)
--        Username         : resend
--        Password         : clé API Resend (re_...)
--
--   2) Authentication → Providers → Email
--        Confirm email : ON
--
--   3) Authentication → URL Configuration
--        Site URL      : https://scanplay.org
--        Redirect URLs : https://scanplay.org/**
--
-- Resend : domaine scanplay.org doit être Verified (Domains)
-- ============================================================


-- 1. Supprimer l'auto-confirmation (empêche l'envoi d'email)
-- ------------------------------------------------------------

drop trigger if exists on_scanplay_auto_confirm on auth.users;
drop function if exists public.auto_confirm_scanplay_user();


-- 2. Profils à l'inscription (si pas déjà fait)
-- ------------------------------------------------------------

create or replace function public.handle_scanplay_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
  values (new.id, 0, 0, 'free', 'fr')
  on conflict (user_id) do nothing;
  insert into public.scanplay_user_stats (user_id, data)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_scanplay_auth_user_created on auth.users;
create trigger on_scanplay_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_scanplay_new_user();


-- 3. Vérification
-- ------------------------------------------------------------

select
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  u.confirmation_sent_at,
  u.created_at,
  case
    when u.email_confirmed_at is not null then '✅ Déjà confirmé'
    when u.confirmation_sent_at is not null then '📧 Email envoyé — en attente du clic'
    else '⚠️ Pas d''email envoyé — vérifie SMTP Resend + Confirm email ON'
  end as statut
from auth.users u
order by u.created_at desc
limit 10;
