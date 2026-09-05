import type { SupabaseClient } from '@supabase/supabase-js';

import { sendResendEmail } from './resendMail.js';
import { getAppUrl } from './stripe.js';

type MailKind = 'streak' | 'friend_request' | 'friend_accepted';

function appUrl(): string {
  return getAppUrl() || 'https://scanplay.org';
}

function isFrench(locale: string | null | undefined): boolean {
  const tag = (locale ?? 'fr').toLowerCase();
  return tag === 'fr' || tag.startsWith('fr-');
}

export function parisYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addCalendarDays(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function wrapHtml(title: string, body: string, cta: string): string {
  const url = appUrl();
  return `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:24px auto;padding:28px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 8px;font-weight:800;color:#16a34a;">ScanPlay</p>
    <h1 style="margin:0 0 12px;font-size:1.35rem;">${title}</h1>
    <p style="margin:0 0 20px;line-height:1.55;color:#334155;">${body}</p>
    <p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#58cc02;color:#14350c;font-weight:800;text-decoration:none;border-radius:12px;">${cta}</a></p>
  </div>
</body></html>`;
}

export function buildLifecycleMail(
  kind: MailKind,
  locale: string | null | undefined,
  extra: { streak?: number; fromName?: string },
): { subject: string; text: string; html: string } {
  const fr = isFrench(locale);
  const url = appUrl();
  const name = extra.fromName?.trim() || (fr ? 'Un joueur' : 'A player');
  const days = extra.streak ?? 1;

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

  if (kind === 'friend_request') {
    const subject = fr ? `${name} t’ajoute sur ScanPlay` : `${name} added you on ScanPlay`;
    const title = fr ? 'Nouvelle demande d’ami' : 'New friend request';
    const body = fr
      ? `${name} veut te rejoindre. Ouvre ScanPlay pour accepter et réviser ensemble.`
      : `${name} wants to connect. Open ScanPlay to accept and study together.`;
    const cta = fr ? 'Voir la demande' : 'See the request';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  const subject = fr ? `${name} a accepté ta demande` : `${name} accepted your request`;
  const title = fr ? 'Vous êtes amis' : 'You’re friends now';
  const body = fr
    ? `${name} a accepté. Retrouve son profil et sa série dans l’onglet Amis.`
    : `${name} accepted. Find their profile and streak in the Friends tab.`;
  const cta = fr ? 'Ouvrir ScanPlay' : 'Open ScanPlay';
  return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
}

export async function claimEmailSend(
  admin: SupabaseClient,
  userId: string,
  kind: MailKind,
  dedupeKey: string,
): Promise<boolean> {
  const { error } = await admin.from('scanplay_email_log').insert({
    user_id: userId,
    kind,
    dedupe_key: dedupeKey,
  });
  if (error) {
    if (error.code === '23505') return false;
    console.warn('email log insert', error.message);
    return false;
  }
  return true;
}

export async function sendClaimedMail(
  admin: SupabaseClient,
  toUserId: string,
  kind: MailKind,
  dedupeKey: string,
  extra: { streak?: number; fromName?: string },
): Promise<boolean> {
  const [{ data: userData }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(toUserId),
    admin.from('scanplay_profiles').select('locale, email_alerts').eq('user_id', toUserId).maybeSingle(),
  ]);

  const email = userData.user?.email;
  if (!email || !userData.user?.email_confirmed_at) return false;
  if (profile && profile.email_alerts === false) return false;

  const claimed = await claimEmailSend(admin, toUserId, kind, dedupeKey);
  if (!claimed) return false;

  const mail = buildLifecycleMail(kind, profile?.locale as string | undefined, extra);
  const sent = await sendResendEmail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  if (!sent) {
    await admin.from('scanplay_email_log').delete().eq('dedupe_key', dedupeKey);
  }
  return sent;
}
