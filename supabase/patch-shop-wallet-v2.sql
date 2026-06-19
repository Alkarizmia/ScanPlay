-- ============================================================
-- ScanPlay — Boutique v2 (bouclier série, synthèse, scan bonus)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- PRÉREQUIS :
--   • sync-cloud-complete.sql  OU  fix-auth-complete.sql
--   • migration-scan-coins-system.sql  (scanplay_wallets + transferts)
--
-- PAS DE NOUVELLE TABLE :
--   Shop, coffre, potions, bouclier série, crédits synthèse, scans bonus
--   → stockés dans scanplay_user_stats.data.wallet (JSON)
--   Quota synthèse mensuel (used/month) → data.synthesisMonth (JSON)
--
-- Schéma wallet complet (app localStorage = scanplay-wallet) :
-- {
--   "coins": 100,
--   "xpBoostUntil": null,              -- timestamp ms ou null
--   "lastDailyChest": "2026-05-30",    -- date ISO jour coffre
--   "lastAdRewardDate": "2026-05-30",
--   "adWatchesToday": 0,
--   "lostStreak": 0,
--   "lostStreakAt": null,            -- timestamp ms perte série
--   "extraScansDate": null,          -- date ISO jour (scans bonus Free)
--   "extraScansBought": 0,           -- 0–2 par jour
--   "synthesisBonusCredits": 0,      -- crédits IA achetés en shop
--   "streakFreezeCharges": 0         -- boucliers série (max 3)
-- }
--
-- Schéma synthesisMonth (localStorage = scanplay-synthesis-month) :
-- { "month": "2026-05", "used": 2 }
-- ============================================================


-- 1. NORMALISATION JSON WALLET
-- ------------------------------------------------------------

create or replace function public.normalize_scanplay_wallet(p_wallet jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  w jsonb := coalesce(p_wallet, '{}'::jsonb);
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
begin
  -- Reset scans bonus si jour différent
  if coalesce(w ->> 'extraScansDate', '') is distinct from today then
    w := w || jsonb_build_object('extraScansDate', today, 'extraScansBought', 0);
  end if;

  return jsonb_build_object(
    'coins', greatest(0, least(999999, coalesce((w ->> 'coins')::int, 100))),
    'xpBoostUntil', case
      when w ->> 'xpBoostUntil' is null or w ->> 'xpBoostUntil' = 'null' then null
      else (w ->> 'xpBoostUntil')::bigint
    end,
    'lastDailyChest', w ->> 'lastDailyChest',
    'lastAdRewardDate', w ->> 'lastAdRewardDate',
    'adWatchesToday', greatest(0, least(99, coalesce((w ->> 'adWatchesToday')::int, 0))),
    'lostStreak', greatest(0, coalesce((w ->> 'lostStreak')::int, 0)),
    'lostStreakAt', case
      when w ->> 'lostStreakAt' is null or w ->> 'lostStreakAt' = 'null' then null
      else (w ->> 'lostStreakAt')::bigint
    end,
    'extraScansDate', coalesce(w ->> 'extraScansDate', today),
    'extraScansBought', greatest(0, least(2, coalesce((w ->> 'extraScansBought')::int, 0))),
    'synthesisBonusCredits', greatest(0, least(99, coalesce((w ->> 'synthesisBonusCredits')::int, 0))),
    'streakFreezeCharges', greatest(0, least(3, coalesce((w ->> 'streakFreezeCharges')::int, 0)))
  );
end;
$$;

comment on function public.normalize_scanplay_wallet(jsonb) is
  'Fusionne un blob wallet avec les valeurs par défaut ScanPlay boutique v2.';


-- 2. NORMALISATION QUOTA SYNTHÈSE MENSUEL
-- ------------------------------------------------------------

create or replace function public.normalize_synthesis_month(p_blob jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  b jsonb := coalesce(p_blob, '{}'::jsonb);
  current_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  if coalesce(b ->> 'month', '') is distinct from current_month then
    return jsonb_build_object('month', current_month, 'used', 0);
  end if;

  return jsonb_build_object(
    'month', current_month,
    'used', greatest(0, least(999, coalesce((b ->> 'used')::int, 0)))
  );
end;
$$;

comment on function public.normalize_synthesis_month(jsonb) is
  'Quota synthèse IA consommé ce mois (hors crédits bonus wallet).';


-- 3. MIGRATION DES DONNÉES EXISTANTES
-- ------------------------------------------------------------

update public.scanplay_user_stats s
set
  data = jsonb_set(
    jsonb_set(
      coalesce(s.data, '{}'::jsonb),
      '{wallet}',
      public.normalize_scanplay_wallet(coalesce(s.data -> 'wallet', '{}'::jsonb))
    ),
    '{synthesisMonth}',
    public.normalize_synthesis_month(coalesce(s.data -> 'synthesisMonth', '{}'::jsonb))
  ),
  updated_at = now()
where true;


-- 4. ALIGNER scanplay_wallets.coins SUR LE BLOB (max des deux)
-- ------------------------------------------------------------

insert into public.scanplay_wallets (user_id, coins)
select
  s.user_id,
  greatest(
    100,
    coalesce((public.normalize_scanplay_wallet(s.data -> 'wallet') ->> 'coins')::int, 100)
  )
from public.scanplay_user_stats s
where not exists (
  select 1 from public.scanplay_wallets w where w.user_id = s.user_id
);

update public.scanplay_wallets w
set
  coins = greatest(
    w.coins,
    coalesce((public.normalize_scanplay_wallet(s.data -> 'wallet') ->> 'coins')::int, 100)
  ),
  updated_at = now()
from public.scanplay_user_stats s
where s.user_id = w.user_id
  and coalesce((public.normalize_scanplay_wallet(s.data -> 'wallet') ->> 'coins')::int, 100) > w.coins;


-- 5. METTRE À JOUR ensure_scanplay_wallet (lit le blob normalisé)
-- ------------------------------------------------------------

create or replace function public.ensure_scanplay_wallet(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int := 100;
  v_wallet jsonb;
begin
  if p_user_id is null then
    return;
  end if;

  select public.normalize_scanplay_wallet(coalesce(s.data -> 'wallet', '{}'::jsonb))
  into v_wallet
  from public.scanplay_user_stats s
  where s.user_id = p_user_id;

  v_coins := greatest(100, coalesce((v_wallet ->> 'coins')::int, 100));

  insert into public.scanplay_wallets (user_id, coins)
  values (p_user_id, v_coins)
  on conflict (user_id) do update
  set
    coins = greatest(scanplay_wallets.coins, excluded.coins),
    updated_at = now();
end;
$$;


-- 6. RPC : lire le wallet normalisé (debug / futur client)
-- ------------------------------------------------------------

create or replace function public.get_my_wallet_blob()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(s.data, '{}'::jsonb)
  into v_data
  from public.scanplay_user_stats s
  where s.user_id = auth.uid();

  return jsonb_build_object(
    'wallet', public.normalize_scanplay_wallet(v_data -> 'wallet'),
    'synthesisMonth', public.normalize_synthesis_month(v_data -> 'synthesisMonth')
  );
end;
$$;

comment on function public.get_my_wallet_blob() is
  'Retourne wallet + synthesisMonth normalisés pour l''utilisateur connecté.';


-- 7. RPC : fusionner un push wallet depuis l''app (optionnel, sync cloud)
-- ------------------------------------------------------------

create or replace function public.merge_wallet_blob(p_wallet jsonb, p_synthesis_month jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_data jsonb;
  v_wallet jsonb;
  v_coins int;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  v_wallet := public.normalize_scanplay_wallet(p_wallet);

  insert into public.scanplay_user_stats (user_id, data)
  values (v_me, '{}'::jsonb)
  on conflict (user_id) do nothing;

  select coalesce(data, '{}'::jsonb) into v_data
  from public.scanplay_user_stats
  where user_id = v_me;

  v_data := jsonb_set(v_data, '{wallet}', v_wallet);

  if p_synthesis_month is not null then
    v_data := jsonb_set(
      v_data,
      '{synthesisMonth}',
      public.normalize_synthesis_month(p_synthesis_month)
    );
  end if;

  update public.scanplay_user_stats
  set data = v_data, updated_at = now()
  where user_id = v_me;

  v_coins := (v_wallet ->> 'coins')::int;
  perform public.sync_wallet_coins(v_coins);

  return jsonb_build_object(
    'wallet', v_wallet,
    'synthesisMonth', public.normalize_synthesis_month(v_data -> 'synthesisMonth')
  );
end;
$$;

comment on function public.merge_wallet_blob(jsonb, jsonb) is
  'Fusionne le blob wallet/synthesisMonth poussé par l''app (sync boutique).';


-- 8. DROITS
-- ------------------------------------------------------------

grant execute on function public.normalize_scanplay_wallet(jsonb) to authenticated;
grant execute on function public.normalize_synthesis_month(jsonb) to authenticated;
grant execute on function public.get_my_wallet_blob() to authenticated;
grant execute on function public.merge_wallet_blob(jsonb, jsonb) to authenticated;


-- 9. VÉRIFICATION
-- ------------------------------------------------------------
-- select public.normalize_scanplay_wallet('{"coins":50}'::jsonb);
-- select * from public.get_my_wallet_blob();
-- select user_id, data -> 'wallet', data -> 'synthesisMonth'
-- from public.scanplay_user_stats limit 5;
