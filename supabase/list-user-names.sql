-- Liste tous les pseudos ScanPlay (SQL Editor, rôle postgres / service).

select
  coalesce(nullif(trim(pp.display_name), ''), '(sans pseudo)') as display_name,
  u.email,
  u.created_at,
  u.id as user_id
from auth.users u
left join public.scanplay_public_profiles pp on pp.user_id = u.id
order by lower(coalesce(pp.display_name, '')), u.created_at;

-- Uniquement les noms, une ligne par pseudo :
-- select display_name
-- from public.scanplay_public_profiles
-- order by lower(display_name);
