/**
 * Send testimonial ask to an explicit email list (Resend).
 * Usage: node scripts/send-testimonial-manual.mjs
 */
import { readFileSync } from 'node:fs';

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

const resendKey = process.env.RESEND_API_KEY;
const APP = 'https://scanplay.org';
const CTA = `${APP}/avis`;
const EMAILS = ['aminefehli44@gmail.com', 'elboukilianouar01@gmail.com', 'yassin.llmss@gmail.com'];

if (!resendKey) {
  console.error('Missing RESEND_API_KEY');
  process.exit(1);
}

const subject = '30 secondes : ton avis ScanPlay ⭐';
const title = 'Ton avis compte vraiment';
const body =
  'Tu as utilisé ScanPlay. Pour montrer aux écoles (et aux autres élèves) que ça marche, laisse une note et 2–3 phrases — ça prend 30 secondes.';
const cta = 'Donner mon avis';
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
  </div>
</body></html>`;

let sent = 0;
let failed = 0;
for (const to of EMAILS) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ScanPlay <support@scanplay.org>',
      to: [to],
      subject,
      text: `${body}\n\n${CTA}`,
      html,
    }),
  });
  if (!res.ok) {
    failed += 1;
    console.warn('fail', to, await res.text().catch(() => ''));
  } else {
    sent += 1;
    console.log('sent', to);
  }
  await new Promise((r) => setTimeout(r, 350));
}
console.log(JSON.stringify({ sent, failed, cta: CTA }));
