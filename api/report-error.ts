import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './lib/auth.js';

const SUPPORT_EMAIL = 'support@scanplay.org';
const FROM_EMAIL = 'ScanPlay <support@scanplay.org>';

const REASON_LABELS: Record<string, string> = {
  answer_should_accept: 'Ma réponse devrait être acceptée',
  input_problem: "Problème avec l'enregistrement de ma réponse",
  sheet_error: 'Erreur dans la fiche / la question',
  other: 'Autre problème',
};

function formatReportText(body: {
  reasons: string[];
  comment?: string;
  context: Record<string, unknown>;
}): string {
  const ctx = body.context;
  const reasonLines = body.reasons.map((r) => `- ${REASON_LABELS[r] ?? r}`).join('\n');
  return [
    'Signalement utilisateur ScanPlay',
    '================================',
    '',
    `Jeu: ${ctx.game ?? '—'}`,
    `Thème / type fiche: ${ctx.sheetType ?? '—'}`,
    `Locale: ${ctx.locale ?? '—'}`,
    `URL: ${ctx.url ?? '—'}`,
    '',
    `Question / énoncé: ${ctx.prompt ?? '—'}`,
    `Réponse attendue (app): ${ctx.expected ?? '—'}`,
    `Réponse utilisateur: ${ctx.userAnswer ?? '—'}`,
    `Verdict app: ${ctx.grade ?? '—'}`,
    '',
    `Deck ID: ${ctx.deckId ?? '—'}`,
    `Étape parcours: ${ctx.stepIndex ?? '—'}`,
    `Question: ${ctx.questionIndex != null ? Number(ctx.questionIndex) + 1 : '—'}/${ctx.questionTotal ?? '—'}`,
    '',
    `Utilisateur: ${ctx.userEmail ?? '—'} (${ctx.userId ?? 'anonyme'})`,
    '',
    'Motifs cochés:',
    reasonLines || '—',
    '',
    body.comment ? `Commentaire:\n${body.comment}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function sendViaResend(to: string, subject: string, text: string, replyTo?: string | null) {
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
      to: [to],
      reply_to: replyTo || undefined,
      subject,
      text,
    }),
  });

  return res.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const body = req.body as {
      reasons?: string[];
      comment?: string;
      context?: Record<string, unknown>;
    };

    if (!body?.reasons?.length || !body.context?.game) {
      return res.status(400).json({ error: 'invalid_report' });
    }

    const user = await getUserFromRequest(req);
    if (user) {
      body.context.userEmail = body.context.userEmail ?? user.email;
      body.context.userId = body.context.userId ?? user.id;
    }

    const text = formatReportText({
      reasons: body.reasons,
      comment: body.comment,
      context: body.context,
    });

    const subject = `[ScanPlay] Signalement — ${body.context.game}`;
    const sent = await sendViaResend(SUPPORT_EMAIL, subject, text, user?.email ?? null);

    if (!sent) {
      return res.status(503).json({ error: 'email_not_configured' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('report-error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
