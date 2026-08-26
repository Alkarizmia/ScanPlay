-- ScanPlay — tuto pseudo (Profil), une fois par compte
-- Supabase → SQL Editor → Run
--
-- has_seen_pseudo_tuto = false par défaut.
-- Passe à true dès que le joueur valide OK ou clique Passer.
-- Ne revient jamais (tous appareils, toutes sessions).

alter table public.scanplay_profiles
  add column if not exists has_seen_pseudo_tuto boolean not null default false;

comment on column public.scanplay_profiles.has_seen_pseudo_tuto is
  'Tuto Profil « choisis ton pseudo » déjà vu (OK ou Passer). false = pas encore affiché.';

-- Si un ancien patch timestamp a déjà tourné
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scanplay_profiles'
      and column_name = 'pseudo_onboarding_done_at'
  ) then
    update public.scanplay_profiles
    set has_seen_pseudo_tuto = true
    where pseudo_onboarding_done_at is not null
      and has_seen_pseudo_tuto = false;
  end if;
end $$;

-- Comptes qui ont déjà un vrai pseudo : pas de tuto surprise
update public.scanplay_profiles p
set has_seen_pseudo_tuto = true
from public.scanplay_public_profiles pp
where p.user_id = pp.user_id
  and p.has_seen_pseudo_tuto = false
  and coalesce(trim(pp.display_name), '') !~* '^ID-[0-9]{4}$'
  and lower(trim(pp.display_name)) not in ('joueur', 'player');

create or replace function public.mark_pseudo_onboarding_done()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.scanplay_profiles (user_id, has_seen_pseudo_tuto, updated_at)
  values (auth.uid(), true, now())
  on conflict (user_id) do update
    set has_seen_pseudo_tuto = true,
        updated_at = now();
end;
$$;

revoke all on function public.mark_pseudo_onboarding_done() from public;
grant execute on function public.mark_pseudo_onboarding_done() to authenticated;
