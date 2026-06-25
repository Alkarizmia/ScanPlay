/**
 * Assemble supabase/setup-complete-production.sql from ordered migration files.
 * Run: node scripts/build-supabase-setup.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const supabaseDir = join(root, 'supabase');
const outPath = join(supabaseDir, 'setup-complete-production.sql');

/** Execution order — final RPC versions only, no duplicate bases. */
const FILES = [
  'sync-cloud-complete.sql',
  'migration-exam-history.sql',
  'migration-social.sql',
  'migration-social-friend-requests.sql',
  'fix-multiplayer-rooms.sql',
  'patch-friend-profile-plan.sql',
  'stripe-subscription-complete.sql',
  'migration-friend-achievements.sql',
  'patch-display-name-enforcement.sql',
  'patch-friend-presence.sql', // last_seen_at column — before RPCs that reference it
  'patch-public-avatar-url.sql',
  'patch-friend-profile-stats-fix.sql',
  'patch-friend-offline-display.sql',
  'patch-friend-presence-fix.sql',
  'migration-scan-coins-system.sql',
  'patch-shop-wallet-v2.sql',
];

const PRODUCTION_AUTH = `
-- ============================================================
-- PRODUCTION AUTH (scanplay.org + Resend SMTP)
-- Dashboard AVANT test inscription :
--   Authentication → SMTP (smtp.resend.com, resend, re_...)
--   Providers → Email → Confirm email ON
--   URL Configuration → https://scanplay.org + https://scanplay.org/**
-- ============================================================

drop trigger if exists on_scanplay_auto_confirm on auth.users;
drop function if exists public.auto_confirm_scanplay_user();
`;

const HEADER = `-- ============================================================
-- ScanPlay — SETUP COMPLET PRODUCTION (nouveau projet Supabase)
-- Généré par: node scripts/build-supabase-setup.mjs
--
-- Usage:
--   1. Nouveau projet Supabase → SQL Editor → New query
--   2. Coller TOUT ce fichier → Run (1–3 min)
--   3. Configurer Auth SMTP + URLs (voir fin du fichier)
--   4. Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
--   5. Importer auth.users + données depuis l'ancien projet (voir migrate-users-data.sql)
--
-- Idempotent: safe à relancer (IF NOT EXISTS, CREATE OR REPLACE).
-- ============================================================

`;

const parts = [HEADER];

for (const file of FILES) {
  const path = join(supabaseDir, file);
  const content = readFileSync(path, 'utf8');
  parts.push(`\n\n-- ═══════════════════════════════════════════════════════════\n`);
  parts.push(`-- SOURCE: ${file}\n`);
  parts.push(`-- ═══════════════════════════════════════════════════════════\n\n`);
  parts.push(content.trim());
  parts.push('\n');
}

parts.push(PRODUCTION_AUTH);

parts.push(`
-- ============================================================
-- FIN — Vérification rapide
-- ============================================================

select 'tables' as kind, count(*)::text as n
from pg_tables
where schemaname = 'public' and tablename like 'scanplay_%'
union all
select 'functions' as kind, count(*)::text as n
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like '%scanplay%'
    or p.proname in (
      'ensure_scanplay_profile', 'search_players', 'list_my_friends', 'send_friend_request',
      'sync_public_profile_stats', 'transfer_coins_to_friend', 'create_path_room'
    )
  );
`);

writeFileSync(outPath, parts.join(''), 'utf8');
console.log(`Wrote ${outPath} (${parts.join('').length} chars, ${FILES.length} files)`);
