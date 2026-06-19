-- ============================================================
-- ScanPlay — DIAGNOSTIC auth email
-- Supabase → SQL Editor → Run
--
-- ⚠️ Ce SQL ne teste PAS l'envoi SMTP (Brevo).
--    Pour SMTP : Supabase → Logs → Auth Logs
--    ou test Magic Link dans Authentication → Users
-- ============================================================


-- 1. Trigger auto-confirmation encore actif ? (doit être ABSENT)
-- Si présent → les emails sont contournés OU conflit avec Confirm email
-- ------------------------------------------------------------

select
  tgname as trigger_name,
  case
    when tgname = 'on_scanplay_auto_confirm' then '❌ PROBLÈME : supprime ce trigger (enable-email-auth.sql section 4)'
    else 'OK'
  end as status
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal
  and tgname like '%scanplay%'
order by tgname;

-- Aucune ligne = OK (pas de trigger scanplay sur auth.users)
-- Si on_scanplay_auto_confirm apparaît → ré-exécute enable-email-auth.sql section 4


-- 2. Fonction auto_confirm encore présente ?
-- ------------------------------------------------------------

select
  proname as function_name,
  case
    when proname = 'auto_confirm_scanplay_user' then '❌ À supprimer (enable-email-auth.sql)'
    when proname = 'handle_scanplay_new_user' then '✅ OK (profil à l''inscription)'
    when proname = 'ensure_scanplay_profile' then '✅ OK (RPC app)'
    else proname
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'auto_confirm_scanplay_user',
    'handle_scanplay_new_user',
    'ensure_scanplay_profile'
  );


-- 3. Utilisateurs — confirmation email (état réel en base)
-- ------------------------------------------------------------

select
  email,
  created_at,
  confirmation_sent_at,
  email_confirmed_at,
  case
    when email_confirmed_at is not null then '✅ Confirmé'
    when confirmation_sent_at is not null then '⏳ Email envoyé, en attente de clic'
    else '❌ Pas confirmé (email jamais envoyé ou échec SMTP)'
  end as etat_email,
  case
    when email_confirmed_at is null
     and confirmation_sent_at is null
     and created_at > now() - interval '1 hour'
    then '→ Vérifie SMTP Brevo + Auth Logs Supabase'
    else ''
  end as action
from auth.users
order by created_at desc
limit 20;


-- 4. Comptes récents sans profil ScanPlay (bug sync)
-- ------------------------------------------------------------

select
  u.email,
  u.created_at,
  p.user_id is not null as a_profil,
  s.user_id is not null as a_stats
from auth.users u
left join public.scanplay_profiles p on p.user_id = u.id
left join public.scanplay_user_stats s on s.user_id = u.id
order by u.created_at desc
limit 10;


-- 5. Tables sync présentes ?
-- ------------------------------------------------------------

select
  tablename,
  '✅ OK' as status
from pg_tables
where schemaname = 'public'
  and tablename in (
    'scanplay_profiles',
    'scanplay_decks',
    'scanplay_mistakes',
    'scanplay_user_stats'
  )
order by tablename;

-- Doit retourner 4 lignes


-- 6. Résumé rapide (une ligne)
-- ------------------------------------------------------------

select
  (select count(*) from auth.users) as total_users,
  (select count(*) from auth.users where email_confirmed_at is not null) as users_confirmes,
  (select count(*) from auth.users where email_confirmed_at is null) as users_non_confirmes,
  (select count(*) from auth.users
   where email_confirmed_at is null
     and confirmation_sent_at is not null) as en_attente_clic_lien,
  (select count(*) from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relname = 'users'
     and tgname = 'on_scanplay_auto_confirm') as trigger_auto_confirm_actif,
  case
    when exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth' and c.relname = 'users'
        and tgname = 'on_scanplay_auto_confirm'
    ) then '❌ Trigger auto-confirm actif — ré-exécute enable-email-auth.sql'
    else '✅ Pas de auto-confirm SQL'
  end as diagnostic_sql,
  'SMTP : voir Auth Logs (pas testable en SQL)' as note_smtp;
