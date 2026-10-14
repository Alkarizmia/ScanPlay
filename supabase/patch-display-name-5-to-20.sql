-- ScanPlay — Pseudos 5–20 caractères (garde "déjà pris")
-- Supabase → SQL Editor → Run
--
-- Corrige la plage côté serveur. L'unicité (index + display_name_taken) reste.

create or replace function public.check_display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    char_length(trim(coalesce(p_name, ''))) between 5 and 20
    and not exists (
      select 1
      from public.scanplay_public_profiles p
      where lower(trim(p.display_name)) = lower(left(trim(coalesce(p_name, '')), 20))
        and (auth.uid() is null or p.user_id <> auth.uid())
    );
$$;

comment on function public.check_display_name_available(text) is
  'true si le pseudo est libre (5–20 car., casse ignorée, hors soi-même)';
