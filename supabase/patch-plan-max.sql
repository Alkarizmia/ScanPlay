-- Allow ScanPlay Max plan on private + public profiles.

alter table public.scanplay_profiles
  drop constraint if exists scanplay_profiles_plan_check;

alter table public.scanplay_profiles
  add constraint scanplay_profiles_plan_check
  check (plan in ('free', 'plus', 'pro', 'max'));

alter table public.scanplay_public_profiles
  drop constraint if exists scanplay_public_profiles_plan_check;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'scanplay_public_profiles'
  ) then
    alter table public.scanplay_public_profiles
      drop constraint if exists scanplay_public_profiles_plan_check;
    -- legacy unnamed checks may remain; recreate via validate on sync functions
    begin
      alter table public.scanplay_public_profiles
        add constraint scanplay_public_profiles_plan_check
        check (plan in ('free', 'plus', 'pro', 'max'));
    exception
      when duplicate_object then null;
      when check_violation then null;
    end;
  end if;
end $$;
