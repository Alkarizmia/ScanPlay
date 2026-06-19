-- ============================================================
-- ScanPlay — DÉBLOQUER LA CONNEXION (sans attendre SMTP Brevo)
-- Supabase → SQL Editor → Run
--
-- Puis dans le Dashboard (obligatoire) :
--   Authentication → Providers → Email → "Confirm email" → OFF
--   Authentication → URL Configuration
--     Site URL : https://scanplay.org
--     Redirect URLs : https://scanplay.org/**
-- ============================================================


-- 1. Confirmer TOUS les comptes existants (connexion possible sans email)
-- ------------------------------------------------------------

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;


-- 2. Auto-confirmer les NOUVEAUX comptes (pas besoin d'email SMTP)
-- ------------------------------------------------------------

create or replace function public.auto_confirm_scanplay_user()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id
    and email_confirmed_at is null;
  return new;
end;
$$;

drop trigger if exists on_scanplay_auto_confirm on auth.users;
create trigger on_scanplay_auto_confirm
  after insert on auth.users
  for each row
  execute function public.auto_confirm_scanplay_user();


-- 3. Profils ScanPlay manquants
-- ------------------------------------------------------------

insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
select u.id, 0, 0, 'free', 'fr'
from auth.users u
where not exists (select 1 from public.scanplay_profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.scanplay_user_stats (user_id, data)
select u.id, '{}'::jsonb
from auth.users u
where not exists (select 1 from public.scanplay_user_stats s where s.user_id = u.id)
on conflict (user_id) do nothing;


-- 4. Vérification
-- ------------------------------------------------------------

select
  email,
  email_confirmed_at is not null as peut_se_connecter,
  confirmation_sent_at,
  created_at
from auth.users
order by created_at desc
limit 10;

select
  case
    when (select count(*) from auth.users where email_confirmed_at is null) = 0
    then '✅ Tous les comptes confirmés — désactive Confirm email dans Dashboard puis reconnecte-toi'
    else '❌ Encore des comptes non confirmés'
  end as statut;
