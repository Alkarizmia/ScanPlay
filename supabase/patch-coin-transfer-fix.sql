-- ============================================================
-- ScanPlay — FIX transferts ScanCoins (destinataire ne reçoit pas)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Problème : le transfert mettait à jour scanplay_wallets mais pas
-- scanplay_user_stats.data.wallet (blob lu par l'app).
-- ============================================================


-- 1. Ajuster le blob wallet d'un utilisateur
-- ------------------------------------------------------------

create or replace function public.adjust_user_wallet_coins(p_user_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int := 100;
  v_new int;
  v_wallet jsonb;
begin
  if p_user_id is null then
    raise exception 'invalid user';
  end if;

  insert into public.scanplay_user_stats (user_id, data)
  values (p_user_id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  select coalesce((s.data -> 'wallet' ->> 'coins')::int, 100)
  into v_current
  from public.scanplay_user_stats s
  where s.user_id = p_user_id
  for update;

  v_new := greatest(0, v_current + p_delta);

  select coalesce(s.data -> 'wallet', '{}'::jsonb)
  into v_wallet
  from public.scanplay_user_stats s
  where s.user_id = p_user_id;

  v_wallet := v_wallet || jsonb_build_object('coins', v_new);

  update public.scanplay_user_stats
  set data = jsonb_set(coalesce(data, '{}'::jsonb), '{wallet}', v_wallet),
      updated_at = now()
  where user_id = p_user_id;

  return v_new;
end;
$$;


create or replace function public.read_user_wallet_coins(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce(
      (select (s.data -> 'wallet' ->> 'coins')::int
       from public.scanplay_user_stats s
       where s.user_id = p_user_id),
      (select w.coins from public.scanplay_wallets w where w.user_id = p_user_id),
      100
    )
  );
$$;


-- 2. Transfert corrigé (crédite le blob du destinataire)
-- ------------------------------------------------------------

create or replace function public.transfer_coins_to_friend(p_target uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_sender_coins int;
  v_receiver_coins int;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_target is null or p_target = v_me then
    raise exception 'invalid target';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 9999 then
    raise exception 'invalid amount';
  end if;

  if not exists (
    select 1
    from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_target)
        or (fr.from_user_id = p_target and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  perform public.ensure_scanplay_wallet(v_me);
  perform public.ensure_scanplay_wallet(p_target);

  v_sender_coins := public.read_user_wallet_coins(v_me);

  if v_sender_coins < p_amount then
    raise exception 'insufficient coins';
  end if;

  update public.scanplay_wallets
  set coins = v_sender_coins - p_amount,
      updated_at = now()
  where user_id = v_me;

  select w.coins into v_receiver_coins
  from public.scanplay_wallets w
  where w.user_id = p_target
  for update;

  update public.scanplay_wallets
  set coins = coalesce(v_receiver_coins, 100) + p_amount,
      updated_at = now()
  where user_id = p_target;

  perform public.adjust_user_wallet_coins(p_target, p_amount);

  insert into public.scanplay_coin_transfers (from_user_id, to_user_id, amount)
  values (v_me, p_target, p_amount);
end;
$$;


-- 3. Réparer les transferts déjà faits (à exécuter une fois)
--    Aligne le blob wallet sur scanplay_wallets si le serveur est en avance.
-- ------------------------------------------------------------

update public.scanplay_user_stats s
set
  data = jsonb_set(
    coalesce(s.data, '{}'::jsonb),
    '{wallet}',
    coalesce(s.data -> 'wallet', '{}'::jsonb) || jsonb_build_object(
      'coins',
      greatest(
        coalesce((s.data -> 'wallet' ->> 'coins')::int, 100),
        w.coins
      )
    )
  ),
  updated_at = now()
from public.scanplay_wallets w
where s.user_id = w.user_id
  and w.coins > coalesce((s.data -> 'wallet' ->> 'coins')::int, 100);


grant execute on function public.adjust_user_wallet_coins(uuid, int) to authenticated;
grant execute on function public.read_user_wallet_coins(uuid) to authenticated;
grant execute on function public.transfer_coins_to_friend(uuid, int) to authenticated;
