/**
 * Ask recent active users for a short starred testimonial.
 *
 * Usage:
 *   node scripts/send-testimonial-ask.mjs --dry-run
 *   node scripts/send-testimonial-ask.mjs
 *   node scripts/send-testimonial-ask.mjs --days=2
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
const CTA = `${APP}/avis.html`;
const dryRun = process.argv.includes('--dry-run');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const DAYS = Math.max(1, Number(daysArg?.split('=')[1] ?? 2) || 2);

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
    ? '30 secondes : ton avis ScanPlay ⭐'
    : '30 seconds: your ScanPlay review ⭐';
  const title = fr ? 'Ton avis compte vraiment' : 'Your review really helps';
  const body = fr
    ? `Tu as utilisé ScanPlay récemment. Pour montrer aux écoles (et aux autres élèves) que ça marche, laisse une note et 2–3 phrases — ça prend 30 secondes.`
    : `You used ScanPlay recently. To show schools (and other students) it works, leave a star rating and 2–3 sentences — it takes 30 seconds.`;
  const cta = fr ? 'Donner mon avis' : 'Leave my review';
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
    <p style="margin:18px 0 0;font-size:0.82rem;color:#94a3b8;line-height:1.45;">${fr ? 'Merci — ça aide ScanPlay à convaincre les écoles.' : 'Thank you — this helps ScanPlay show schools it works.'}</p>
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

async function listActiveUsers(sinceIso) {
  const out = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const user of users) {
      const last = user.last_sign_in_at || user.updated_at || user.created_at;
      if (!last) continue;
      if (new Date(last).toISOString() >= sinceIso && user.email) {
        out.push({ id: user.id, email: user.email, last });
      }
    }
    if (users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }
  return out;
}

const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
console.log(`Active since ${since} (${DAYS}d) — dryRun=${dryRun}`);

const active = await listActiveUsers(since);
console.log(`Candidates: ${active.length}`);

let sent = 0;
let skipped = 0;
let failed = 0;

for (const row of active) {
  const { data: profile } = await admin
    .from('scanplay_profiles')
    .select('locale, email_alerts')
    .eq('user_id', row.id)
    .maybeSingle();

  if (profile && profile.email_alerts === false) {
    skipped += 1;
    continue;
  }

  const dedupe = `testimonial_ask:${row.id}:${new Date().toISOString().slice(0, 10)}`;
  if (dryRun) {
    console.log('[dry-run]', row.email, row.last);
    sent += 1;
    continue;
  }

  const { error: logErr } = await admin.from('scanplay_email_log').insert({
    user_id: row.id,
    kind: 'testimonial_ask',
    dedupe_key: dedupe,
  });
  if (logErr?.code === '23505') {
    skipped += 1;
    continue;
  }

  try {
    await sendResend(row.email, mail(profile?.locale));
    sent += 1;
    console.log('sent', row.email);
  } catch (err) {
    failed += 1;
    console.warn('fail', row.email, err instanceof Error ? err.message : err);
    await admin.from('scanplay_email_log').delete().eq('dedupe_key', dedupe);
  }

  await new Promise((r) => setTimeout(r, 350));
}

console.log(JSON.stringify({ days: DAYS, candidates: active.length, sent, skipped, failed, dryRun }));
