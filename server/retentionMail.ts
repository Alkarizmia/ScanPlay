import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppUrl } from './stripe.js';
import { parisYmd } from './emailQuota.js';

export const FROM_EMAIL = 'ScanPlay <support@scanplay.org>';

export type RetentionMailKind =
  | 'streak'
  | 'purge_warn_j95'
  | 'reactivate_j1'
  | 'reactivate_j3'
  | 'streak_lost'
  | 'winback_j7'
  | 'winback_j14'
  | 'friend_request'
  | 'friend_accepted'
  | 'install';

export const PRIORITY: Record<string, number> = {
  streak: 0,
  purge_warn_j95: 1,
  reactivate_j1: 2,
  reactivate_j3: 3,
  streak_lost: 3,
  winback_j7: 3,
  winback_j14: 3,
};

function isFrench(locale?: string | null): boolean {
  const tag = (locale ?? 'fr').toLowerCase();
  return tag === 'fr' || tag.startsWith('fr-');
}

function wrapHtml(title: string, body: string, cta: string, ctaUrl?: string): string {
  const url = (getAppUrl() || 'https://scanplay.org').replace(/\/$/, '');
  const href = (ctaUrl || url).replace(/\/$/, '');
  const logo = `${url}/logo.png`;
  return `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:24px auto;padding:28px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
      <tr>
        <td style="vertical-align:middle;padding:0 10px 0 0;">
          <img src="${logo}" alt="ScanPlay" width="40" height="40" style="display:block;border:0;border-radius:10px;" />
        </td>
        <td style="vertical-align:middle;font-weight:800;color:#16a34a;font-size:18px;">ScanPlay</td>
      </tr>
    </table>
    <h1 style="margin:0 0 12px;font-size:1.35rem;">${title}</h1>
    <p style="margin:0 0 20px;line-height:1.55;color:#334155;">${body}</p>
    <p><a href="${href}" style="display:inline-block;padding:12px 18px;background:#58cc02;color:#14350c;font-weight:800;text-decoration:none;border-radius:12px;">${cta}</a></p>
  </div>
</body></html>`;
}

export function buildRetentionMail(
  kind: RetentionMailKind,
  locale: string | null | undefined,
  extra: { streak?: number; fromName?: string; purgeDay?: number } = {},
): { subject: string; text: string; html: string } {
  const fr = isFrench(locale);
  const url = getAppUrl() || 'https://scanplay.org';
  const days = extra.streak ?? 1;
  const name = extra.fromName?.trim() || (fr ? 'Un joueur' : 'A player');

  if (kind === 'purge_warn_j95') {
    const subject = fr
      ? 'Ton compte ScanPlay sera supprimé dans 5 jours'
      : 'Your ScanPlay account will be deleted in 5 days';
    const title = fr ? 'Compte inactif' : 'Inactive account';
    const body = fr
      ? 'Tu ne t’es pas connecté depuis longtemps. Sans reconnexion d’ici 5 jours, ton compte gratuit et tes données ScanPlay (fiches, progression) seront définitivement supprimés. Connecte-toi pour le conserver.'
      : 'You haven’t signed in for a long time. Without signing in within 5 days, your free account and ScanPlay data (sheets, progress) will be permanently deleted. Sign in to keep them.';
    const cta = fr ? 'Me reconnecter' : 'Sign in';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  if (kind === 'reactivate_j1') {
    const subject = fr ? 'Ta fiche t’attend sur ScanPlay' : 'Your sheet is waiting on ScanPlay';
    const title = fr ? 'Reviens juste 2 minutes' : 'Come back for 2 minutes';
    const body = fr
      ? 'Tu as déjà scanné une fiche. Une petite partie aujourd’hui suffit pour ancrer ce que tu as appris.'
      : 'You’ve already scanned a sheet. A short session today is enough to lock in what you learned.';
    const cta = fr ? 'Ouvrir ScanPlay' : 'Open ScanPlay';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  if (kind === 'reactivate_j3') {
    const subject = fr ? '3 jours sans ScanPlay' : '3 days without ScanPlay';
    const title = fr ? 'Une mission t’attend' : 'A mission is waiting';
    const body = fr
      ? 'Tes missions du jour et ton parcours sont prêts. Reviens pour une seule étape, Pix est là.'
      : 'Your daily missions and path are ready. Come back for one step. Pix is waiting.';
    const cta = fr ? 'Jouer' : 'Play';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  if (kind === 'streak_lost') {
    const subject = fr
      ? `Ta série de ${days} jour${days > 1 ? 's' : ''} est tombée`
      : `Your ${days}-day streak dropped`;
    const title = fr ? 'Série cassée' : 'Streak broken';
    const body = fr
      ? `Ta série de ${days} jour${days > 1 ? 's' : ''} est tombée. Tu peux la rattraper dans la boutique, ou en reconstruire une nouvelle dès aujourd’hui.`
      : `Your ${days}-day streak dropped. You can restore it in the shop, or start a new one today.`;
    const cta = fr ? 'Rouvrir ScanPlay' : 'Open ScanPlay';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  if (kind === 'winback_j7' || kind === 'winback_j14') {
    const n = kind === 'winback_j7' ? 7 : 14;
    const subject = fr ? `${n} jours sans réviser` : `${n} days without reviewing`;
    const title = fr ? 'On a gardé tes fiches' : 'We kept your sheets';
    const body = fr
      ? `Ça fait ${n} jours. Tes decks sont toujours là. Une seule partie peut relancer ta série.`
      : `It’s been ${n} days. Your decks are still here. One short game can restart your streak.`;
    const cta = fr ? 'Reprendre' : 'Come back';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  if (kind === 'streak') {
    const subject = fr
      ? `Ta série de ${days} jour${days > 1 ? 's' : ''} va tomber`
      : `Your ${days}-day streak is about to drop`;
    const title = fr ? 'Ta série est en danger' : 'Your streak is at risk';
    const body = fr
      ? `Tu n’as pas encore joué aujourd’hui. Une partie avant minuit garde ta série de ${days} jour${days > 1 ? 's' : ''}.`
      : `You haven’t played yet today. One game before midnight keeps your ${days}-day streak.`;
    const cta = fr ? 'Jouer maintenant' : 'Play now';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  // Fallback unused here for friend/install (kept in lifecycle-emails)
  return {
    subject: 'ScanPlay',
    text: url,
    html: wrapHtml('ScanPlay', '', fr ? 'Ouvrir' : 'Open'),
  };
}

export async function sendResendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });
  if (!res.ok) {
    console.warn('resend failed', res.status, await res.text().catch(() => ''));
  }
  return res.ok;
}

export async function logEmailEvent(
  admin: SupabaseClient,
  params: {
    userId: string;
    kind: string;
    dedupeKey: string;
    status: 'sent' | 'skipped_quota' | 'dry_run';
  },
): Promise<'ok' | 'duplicate' | 'error'> {
  const { error } = await admin.from('scanplay_email_log').insert({
    user_id: params.userId,
    kind: params.kind,
    dedupe_key: params.dedupeKey,
    status: params.status,
    sent_at: new Date().toISOString(),
  });
  if (!error) return 'ok';
  if (error.code === '23505') return 'duplicate';
  // Fallback if status column missing
  if (params.status === 'sent') {
    const retry = await admin.from('scanplay_email_log').insert({
      user_id: params.userId,
      kind: params.kind,
      dedupe_key: params.dedupeKey,
    });
    if (!retry.error) return 'ok';
    if (retry.error.code === '23505') return 'duplicate';
    console.warn('email log', retry.error.message);
    return 'error';
  }
  console.warn('email log', error.message);
  return 'error';
}

export function inactivityAnchor(user: {
  last_sign_in_at?: string | null;
  created_at?: string | null;
}): Date | null {
  const raw = user.last_sign_in_at || user.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysSince(isoOrDate: string | Date, now = new Date()): number {
  const t = typeof isoOrDate === 'string' ? new Date(isoOrDate).getTime() : isoOrDate.getTime();
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

export function todayParis(): string {
  return parisYmd();
}
