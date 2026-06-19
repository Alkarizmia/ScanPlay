-- ============================================================
-- ScanPlay — Système ScanCoins (monnaie, shop, transferts amis)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Prérequis : migration-social-friend-requests.sql (table amis)
--
-- Ce script ajoute :
--   • scanplay_wallets          → solde ScanCoins (transferts entre amis)
--   • scanplay_coin_transfers   → historique des envois
--   • transfer_coins_to_friend  → RPC utilisée par l'app
--   • ensure_scanplay_wallet    → création portefeuille à l'inscription
--
-- État shop (coffre quotidien, potion XP x2, pub, flamme perdue…) :
--   synchronisé dans scanplay_user_stats.data.wallet (JSON local app)
--   Migration complète boutique v2 : patch-shop-wallet-v2.sql
--   Exemple :
--   {
--     "coins": 100,
--     "xpBoostUntil": null,
--     "lastDailyChest": "2026-05-30",
--     "lastAdRewardDate": "2026-05-30",
--     "adWatchesToday": 2,
--     "lostStreak": 0,
--     "lostStreakAt": null,
--     "extraScansDate": "2026-05-30",
--     "extraScansBought": 0,
--     "synthesisBonusCredits": 0,
--     "streakFreezeCharges": 0
--   }
--   Quota synthèse : data.synthesisMonth → { "month": "2026-05", "used": 1 }
-- ============================================================


-- 1. TABLE PORTEFEUILLE
-- ------------------------------------------------------------

create table if not exists public.scanplay_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins int not null default 100 check (coins >= 0 and coins <= 999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scanplay_wallets is
  'Solde ScanCoins côté serveur (transferts entre amis). Shop/coffre = blob user_stats.data.wallet.';


-- 2. HISTORIQUE DES TRANSFERTS
-- ------------------------------------------------------------

create table if not exists public.scanplay_coin_transfers (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null check (amount > 0 and amount <= 9999),
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists scanplay_coin_transfers_from_idx
  on public.scanplay_coin_transfers (from_user_id, created_at desc);

create index if not exists scanplay_coin_transfers_to_idx
  on public.scanplay_coin_transfers (to_user_id, created_at desc);

comment on table public.scanplay_coin_transfers is
  'Journal des envois ScanCoins entre amis.';


-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.scanplay_wallets enable row level security;
alter table public.scanplay_coin_transfers enable row level security;

drop policy if exists "wallet read own" on public.scanplay_wallets;
drop policy if exists "scanplay_wallets_select_own" on public.scanplay_wallets;

create policy "scanplay_wallets_select_own"
  on public.scanplay_wallets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "coin transfers read own" on public.scanplay_coin_transfers;
drop policy if exists "scanplay_coin_transfers_select_own" on public.scanplay_coin_transfers;

create policy "scanplay_coin_transfers_select_own"
  on public.scanplay_coin_transfers for select
  to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());


-- 4. FONCTIONS UTILITAIRES
-- ------------------------------------------------------------

create or replace function public.ensure_scanplay_wallet(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int := 100;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(
    nullif((s.data -> 'wallet' ->> 'coins')::int, null),
    100
  )
  into v_coins
  from public.scanplay_user_stats s
  where s.user_id = p_user_id;

  if v_coins is null or v_coins < 0 then
    v_coins := 100;
  end if;

  insert into public.scanplay_wallets (user_id, coins)
  values (p_user_id, v_coins)
  on conflict (user_id) do nothing;
end;
$$;

comment on function public.ensure_scanplay_wallet(uuid) is
  'Crée un portefeuille (100 ScanCoins par défaut) si absent.';


create or replace function public.get_my_wallet()
returns table (coins int, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform public.ensure_scanplay_wallet(auth.uid());

  return query
  select w.coins, w.updated_at
  from public.scanplay_wallets w
  where w.user_id = auth.uid();
end;
$$;


create or replace function public.sync_wallet_coins(p_coins int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_new int;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_coins is null or p_coins < 0 or p_coins > 999999 then
    raise exception 'invalid coins';
  end if;

  perform public.ensure_scanplay_wallet(v_me);

  update public.scanplay_wallets
  set coins = p_coins,
      updated_at = now()
  where user_id = v_me
  returning coins into v_new;

  return v_new;
end;
$$;

comment on function public.sync_wallet_coins(int) is
  'Met à jour le solde serveur depuis le blob wallet local (sync cloud).';


-- 5. TRANSFERT ENTRE AMIS
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


create or replace function public.list_recent_coin_transfers(p_limit int default 20)
returns table (
  id uuid,
  direction text,
  other_user_id uuid,
  amount int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  return query
  (
    select
      t.id,
      'sent'::text as direction,
      t.to_user_id as other_user_id,
      t.amount,
      t.created_at
    from public.scanplay_coin_transfers t
    where t.from_user_id = v_me

    union all

    select
      t.id,
      'received'::text as direction,
      t.from_user_id as other_user_id,
      t.amount,
      t.created_at
    from public.scanplay_coin_transfers t
    where t.to_user_id = v_me
  )
  order by created_at desc
  limit v_limit;
end;
$$;


-- 6. PORTEFEUILLE À L'INSCRIPTION + ensure_scanplay_profile
-- ------------------------------------------------------------

create or replace function public.ensure_scanplay_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.scanplay_profiles (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  insert into public.scanplay_user_stats (user_id, data)
  values (auth.uid(), '{}'::jsonb)
  on conflict (user_id) do nothing;

  perform public.ensure_scanplay_wallet(auth.uid());
end;
$$;


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

  insert into public.scanplay_wallets (user_id, coins)
  values (new.id, 100)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_scanplay_auth_user_created on auth.users;
create trigger on_scanplay_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_scanplay_new_user();


-- 7. BACKFILL UTILISATEURS EXISTANTS
-- ------------------------------------------------------------

insert into public.scanplay_wallets (user_id, coins)
select
  u.id,
  greatest(
    0,
    coalesce(
      nullif((s.data -> 'wallet' ->> 'coins')::int, null),
      100
    )
  )
from auth.users u
left join public.scanplay_user_stats s on s.user_id = u.id
on conflict (user_id) do update
set
  coins = greatest(
    scanplay_wallets.coins,
    excluded.coins
  ),
  updated_at = now()
where scanplay_wallets.coins < excluded.coins;


-- 8. PERMISSIONS
-- ------------------------------------------------------------

grant select on public.scanplay_wallets to authenticated;
grant select on public.scanplay_coin_transfers to authenticated;

grant execute on function public.adjust_user_wallet_coins(uuid, int) to authenticated;
grant execute on function public.read_user_wallet_coins(uuid) to authenticated;
grant execute on function public.ensure_scanplay_wallet(uuid) to authenticated;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.sync_wallet_coins(int) to authenticated;
grant execute on function public.transfer_coins_to_friend(uuid, int) to authenticated;
grant execute on function public.list_recent_coin_transfers(int) to authenticated;
grant execute on function public.ensure_scanplay_profile() to authenticated;


-- ============================================================
-- FIN — Vérifications rapides (optionnel) :
--
-- select * from public.get_my_wallet();
-- select * from public.list_recent_coin_transfers(10);
-- ============================================================
