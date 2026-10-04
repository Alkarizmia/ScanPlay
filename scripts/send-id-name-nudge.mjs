/**
 * One-shot: email players still on ID-xxxx to pick a name (opens scanplay.org).
 * Usage: node scripts/send-id-name-nudge.mjs
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

if (!url || !service || !resendKey) {
  console.error('Missing SUPABASE or RESEND keys in .env');
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isIdName(name) {
  return /^ID-[0-9]{4}$/i.test(String(name ?? '').trim());
}

function isFrench(locale) {
  const tag = (locale ?? 'fr').toLowerCase();
  return tag === 'fr' || tag.startsWith('fr-');
}

function mail(locale) {
  const fr = isFrench(locale);
  const subject = fr
    ? 'Un petit nom, et tes amis te trouvent'
    : 'Pick a name so friends can find you';
  const title = fr ? 'Tu es encore en ID' : 'You’re still on an ID';
  const body = fr
    ? `Sur ScanPlay tu apparais encore avec un identifiant (ID-xxxx), pas un vrai pseudo. Choisis un nom dans Profil — tes amis te retrouveront, et tu pourras installer l’app depuis l’accueil (bouton Installer ScanPlay).`
    : `On ScanPlay you still show up as an ID (ID-xxxx), not a real name. Pick a username in Profile so friends can find you — and you can install the app from Home (Install ScanPlay).`;
  const cta = fr ? 'Ouvrir ScanPlay' : 'Open ScanPlay';
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
    <p><a href="${APP}" style="display:inline-block;padding:12px 18px;background:#58cc02;color:#14350c;font-weight:800;text-decoration:none;border-radius:12px;">${cta}</a></p>
  </div>
</body></html>`;
  return { subject, text: `${body}\n\n${APP}`, html };
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

const { data: rows, error } = await admin
  .from('scanplay_public_profiles')
  .select('user_id, display_name');

if (error) {
  console.error('profiles', error.message);
  process.exit(1);
}

const idRows = (rows ?? []).filter((r) => isIdName(r.display_name));
console.log(`Profils ID-xxxx: ${idRows.length}`);

let sent = 0;
let skipped = 0;
let failed = 0;

for (const row of idRows) {
  const userId = String(row.user_id);
  const [{ data: userData }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('scanplay_profiles').select('locale, email_alerts').eq('user_id', userId).maybeSingle(),
  ]);

  const email = userData.user?.email;
  if (!email) {
    skipped += 1;
    continue;
  }
  if (profile && profile.email_alerts === false) {
    skipped += 1;
    continue;
  }

  const { error: logErr } = await admin.from('scanplay_email_log').insert({
    user_id: userId,
    kind: 'name_nudge',
    dedupe_key: `name_nudge:${userId}`,
  });
  if (logErr?.code === '23505') {
    skipped += 1;
    continue;
  }

  try {
    await sendResend(email, mail(profile?.locale));
    sent += 1;
  } catch (err) {
    failed += 1;
    console.warn('send fail', err instanceof Error ? err.message : err);
    await admin.from('scanplay_email_log').delete().eq('dedupe_key', `name_nudge:${userId}`);
  }

  await new Promise((r) => setTimeout(r, 350));
}

console.log(JSON.stringify({ sent, skipped, failed }));
