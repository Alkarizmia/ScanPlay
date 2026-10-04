/**
 * One-shot: email players with thin scans to re-scan via deep link.
 *
 * Usage:
 *   node scripts/send-rescan-nudge.mjs --dry-run
 *   node scripts/send-rescan-nudge.mjs
 *   node scripts/send-rescan-nudge.mjs --from-thin-decks
 *
 * Default recipients = the warn list (override with --from-thin-decks).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const APP = 'https://scanplay.org';
const CTA = `${APP}/?intent=scan`;
const dryRun = process.argv.includes('--dry-run');
const fromThinDecks = process.argv.includes('--from-thin-decks');

/** Manual warn list (from diagnostic / support). */
const MANUAL_EMAILS = [
  'amina.elfh@gmail.com',
  'adamdulos@gmail.com',
  'el.fahmi.entre@gmail.com',
  'rkbmarwan@gmail.com',
  'yassin.llmss@gmail.com',
  'youssoufelammari21@gmail.com',
];

if (!url || !service || !resendKey) {
  console.error('Missing SUPABASE or RESEND keys in .env');
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isFrench(locale) {
  const tag = (locale ?? 'fr').toLowerCase();
  return tag === 'fr' || tag.startsWith('fr-');
}

function mail(locale) {
  const fr = isFrench(locale);
  const subject = fr
    ? 'ScanPlay : re-scanne ta fiche (meilleure lecture)'
    : 'ScanPlay: re-scan your sheet (better reading)';
  const title = fr ? 'On a amélioré la lecture des fiches' : 'Sheet reading just got better';
  const body = fr
    ? `Si ton dernier scan n’a sorti que quelques cartes, ce n’est pas toi — l’extraction a été renforcée. Rouvre ScanPlay, choisis la même photo, et re-scanne : tu devrais obtenir bien plus de cartes. Tes anciennes fiches restent intactes.`
    : `If your last scan only made a few cards, that’s on us — extraction is stronger now. Open ScanPlay, pick the same photo, and scan again for many more cards. Your old decks stay untouched.`;
  const cta = fr ? 'Re-scanner ma fiche' : 'Re-scan my sheet';
  const html = `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:24px auto;padding:28px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
      <tr>
        <td style="vertical-align:middle;padding:0 10px 0 0;">
          <img src="${APP}/logo.png" alt="ScanPlay" width="40" height="40" style="display:block;border:0;border-radius:10px;" />
        </td>
        <td style="vertical-align:middle;font-weight:800;color:#16a34a;font-size:18px;">ScanPlay</td>
      </tr>
    </table>
    <h1 style="margin:0 0 12px;font-size:1.35rem;">${title}</h1>
    <p style="margin:0 0 20px;line-height:1.55;color:#334155;">${body}</p>
    <p><a href="${CTA}" style="display:inline-block;padding:12px 18px;background:#58cc02;color:#14350c;font-weight:800;text-decoration:none;border-radius:12px;">${cta}</a></p>
    <p style="margin:18px 0 0;font-size:0.82rem;color:#94a3b8;line-height:1.45;">${fr ? 'Astuce : si l’app ne change pas, ferme-la complètement puis rouvre le lien.' : 'Tip: if the app looks unchanged, fully close it then open the link again.'}</p>
  </div>
</body></html>`;
  return { subject, text: `${body}\n\n${CTA}`, html };
}

async function sendResend(to, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ScanPlay <support@scanplay.org>',
      to: [to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${detail.slice(0, 200)}`);
  }
}

async function emailsFromThinDecks() {
  const { data: decks, error } = await admin.from('scanplay_decks').select('user_id, pairs');
  if (error) throw new Error(error.message);

  const byUser = new Map();
  for (const row of decks ?? []) {
    const uid = String(row.user_id);
    const count = Array.isArray(row.pairs) ? row.pairs.length : 0;
    const cur = byUser.get(uid) ?? { thin: 0, healthy: 0, avgSum: 0, n: 0 };
    cur.n += 1;
    cur.avgSum += count;
    if (count <= 7) cur.thin += 1;
    if (count >= 20) cur.healthy += 1;
    byUser.set(uid, cur);
  }

  const userIds = [];
  for (const [uid, stats] of byUser) {
    const avg = stats.n ? stats.avgSum / stats.n : 0;
    const warnHigh =
      (stats.thin >= 1 && stats.healthy === 0) || stats.thin >= 2 || (avg <= 8 && stats.thin >= 1);
    if (warnHigh) userIds.push(uid);
  }
  return userIds;
}

async function resolveTargets() {
  /** @type {{ userId: string, email: string }[]} */
  const targets = [];

  if (fromThinDecks) {
    const userIds = await emailsFromThinDecks();
    console.log(`Thin-deck users: ${userIds.length}`);
    for (const userId of userIds) {
      const { data } = await admin.auth.admin.getUserById(userId);
      const email = data.user?.email;
      if (email) targets.push({ userId, email });
    }
    return targets;
  }

  const wanted = new Set(MANUAL_EMAILS.map((e) => e.toLowerCase()));
  /** @type {Map<string, string>} */
  const found = new Map();
  for (let page = 1; page <= 30 && found.size < wanted.size; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      const email = u.email?.toLowerCase();
      if (email && wanted.has(email) && u.id) found.set(email, u.id);
    }
  }
  for (const email of MANUAL_EMAILS) {
    const userId = found.get(email.toLowerCase());
    if (userId) targets.push({ userId, email });
    else console.warn('email not found', email);
  }
  return targets;
}

const targets = await resolveTargets();
console.log(`Targets: ${targets.length}${dryRun ? ' (dry-run)' : ''}`);

let sent = 0;
let skipped = 0;
let failed = 0;

for (const { userId, email } of targets) {
  const { data: profile } = await admin
    .from('scanplay_profiles')
    .select('locale, email_alerts')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile && profile.email_alerts === false) {
    skipped += 1;
    console.log('skip alerts off', email);
    continue;
  }

  const dedupeKey = `rescan_nudge:${userId}`;
  if (!dryRun) {
    const { error: logErr } = await admin.from('scanplay_email_log').insert({
      user_id: userId,
      kind: 'rescan_nudge',
      dedupe_key: dedupeKey,
    });
    if (logErr?.code === '23505') {
      skipped += 1;
      console.log('skip already sent', email);
      continue;
    }
  }

  try {
    if (dryRun) {
      console.log('dry-run would send', email);
      sent += 1;
    } else {
      await sendResend(email, mail(profile?.locale));
      sent += 1;
      console.log('sent', email);
    }
  } catch (err) {
    failed += 1;
    console.warn('send fail', email, err instanceof Error ? err.message : err);
    if (!dryRun) {
      await admin.from('scanplay_email_log').delete().eq('dedupe_key', dedupeKey);
    }
  }

  await new Promise((r) => setTimeout(r, 350));
}

console.log(JSON.stringify({ sent, skipped, failed, dryRun, fromThinDecks }));
