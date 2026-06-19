import { getUser, getUserId } from './auth';
import { getSupabase } from './supabase';
import type { AnswerGrade } from './vocabulary';
import type { GameMode, Locale, SheetType } from '../types';

export type ReportReasonId =
  | 'answer_should_accept'
  | 'input_problem'
  | 'sheet_error'
  | 'other';

export interface GameErrorReportContext {
  game: GameMode;
  sheetType?: SheetType;
  locale: Locale;
  prompt: string;
  expected: string;
  userAnswer: string;
  grade: AnswerGrade;
  deckId?: string | null;
  stepIndex?: number | null;
  questionIndex?: number;
  questionTotal?: number;
}

export interface SubmitGameErrorReportInput {
  reasons: ReportReasonId[];
  comment?: string;
  context: GameErrorReportContext;
}

const SUPPORT_EMAIL = 'support@scanplay.org';

function buildReportPayload(input: SubmitGameErrorReportInput) {
  const user = getUser();
  const userId = getUserId();
  return {
    reasons: input.reasons,
    comment: input.comment?.trim() || undefined,
    context: {
      ...input.context,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userEmail: user.email,
      userId,
    },
  };
}

function buildMailtoBody(input: SubmitGameErrorReportInput, reasonLabels: string[]): string {
  const { context } = input;
  const lines = [
    'Signalement ScanPlay',
    '',
    `Jeu: ${context.game}`,
    `Thème / fiche: ${context.sheetType ?? '—'}`,
    `Question: ${context.prompt}`,
    `Réponse attendue (app): ${context.expected}`,
    `Réponse utilisateur: ${context.userAnswer}`,
    `Verdict app: ${context.grade}`,
    `Étape parcours: ${context.stepIndex ?? '—'}`,
    `Deck: ${context.deckId ?? '—'}`,
    `Question ${context.questionIndex != null ? `${context.questionIndex + 1}/${context.questionTotal}` : '—'}`,
    '',
    'Motifs:',
    ...reasonLabels.map((l) => `- ${l}`),
  ];
  if (input.comment?.trim()) {
    lines.push('', 'Commentaire:', input.comment.trim());
  }
  return lines.join('\n');
}

export async function submitGameErrorReport(
  input: SubmitGameErrorReportInput,
  reasonLabels: string[],
): Promise<'sent' | 'mailto'> {
  const payload = buildReportPayload(input);

  try {
    const supabase = getSupabase();
    const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;

    const res = await fetch('/api/report-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return 'sent';
  } catch {
    /* fallback mailto */
  }

  const subject = encodeURIComponent(`[ScanPlay] Signalement — ${input.context.game}`);
  const body = encodeURIComponent(buildMailtoBody(input, reasonLabels));
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  return 'mailto';
}
