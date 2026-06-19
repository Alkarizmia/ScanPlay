-- ============================================================
-- ScanPlay — Lister les demandes d'ami en attente (page Amis)
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

create or replace function public.list_pending_friend_requests()
returns table (
  request_id uuid,
  from_user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fr.id as request_id,
    fr.from_user_id,
    coalesce(p.display_name, 'Joueur') as display_name,
    coalesce(p.avatar_id, 'avatar1') as avatar_id,
    coalesce(p.level, 1) as level,
    fr.created_at
  from public.scanplay_friend_requests fr
  left join public.scanplay_public_profiles p on p.user_id = fr.from_user_id
  where fr.to_user_id = auth.uid()
    and fr.status = 'pending'
  order by fr.created_at desc
  limit 20;
$$;

grant execute on function public.list_pending_friend_requests() to authenticated;
