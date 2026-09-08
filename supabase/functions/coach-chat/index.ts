import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchUserPlan } from '../_shared/planQuotas.ts';
import { resolveCoachModel } from '../_shared/openaiModels.ts';
import {
  asksLockedHistory,
  COACH_LIMITS,
    looksLikeOtherUserPii,
    looksLikeSupportIssue,
    refuseHistory,
    refusePii,
    refuseSupport,
    refuseTooLong,
    localCoachReply,
    type CoachPlan,
} from '../_shared/coachPolicy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es Pix, le mini-coach de ScanPlay. Tu parles comme un pote un peu coach, pas comme un robot.

Tu réponds à LA question, selon LA situation. Tu n'inventes pas de fiche.

Situations :
- Compte neuf (pseudo du type ID-1234, 0 fiche, peu de succès, XP bas, ou il dit qu'il est nouveau) : accueille-le, explique en 3 phrases : photo d'un cours, ScanPlay en fait un jeu, tu l'aides ensuite. Pousse-le vers le bouton Accueil pour scanner. Ne fais pas un quiz.
- 0 fiche, mais il n'est pas forcément nouveau : dis clairement qu'il n'a encore rien scanné, et que le plus utile c'est de prendre une photo de sa fiche. Tu peux quand même l'encourager ou expliquer l'app.
- Il a des fiches autorisées : tu peux quiz / réviser / encourager à partir de CES fiches seulement.
- Vrai problème technique, paiement, compte bloqué, bug : donne support@scanplay.org. Tu ne fais pas le SAV toi-même.
- INTERDIT : email, téléphone, adresse ou données perso d'un AUTRE élève.
- INTERDIT : une fiche hors liste autorisée (plan gratuit = 2 plus récentes seulement).

Style : langue de locale, phrases courtes, pas de tiret cadratin, pas de markdown lourd.`;

interface CoachBody {
  message?: string;
  locale?: string;
  context?: {
    streak?: number;
    level?: number;
    xp?: number;
    sheetCount?: number;
    achievementCount?: number;
    isNewAccount?: boolean;
    defaultName?: boolean;
    displayName?: string;
    achievements?: string[];
    allowedSheets?: { title: string; pairs: { term: string; definition: string }[] }[];
    lockedTitles?: string[];
    yesterdaySheets?: { title: string; pairs: { term: string; definition: string }[] }[];
  };
}

function trimText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json(503, { error: 'OPENAI_API_KEY not configured' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return json(401, { error: 'Unauthorized' });

    const body = (await req.json()) as CoachBody;
    const locale = trimText(body.locale, 8) || 'fr';
    const plan = (await fetchUserPlan(supabase, user.id)) as CoachPlan;
    const caps = COACH_LIMITS[plan] ?? COACH_LIMITS.free;
    const rawMessage = typeof body.message === 'string' ? body.message.replace(/\s+/g, ' ').trim() : '';

    if (rawMessage.length < 2) return json(400, { error: 'empty_message' });
    if (rawMessage.length > caps.maxChars) {
      return json(200, { reply: refuseTooLong(locale, caps.maxChars), blocked: 'too_long', quota: null });
    }

    if (looksLikeOtherUserPii(rawMessage)) {
      return json(200, { reply: refusePii(locale), blocked: 'privacy', quota: null });
    }

    if (looksLikeSupportIssue(rawMessage)) {
      return json(200, { reply: refuseSupport(locale), blocked: 'support', quota: null });
    }

    const incomingSheets = Array.isArray(body.context?.allowedSheets)
      ? body.context.allowedSheets
      : Array.isArray(body.context?.yesterdaySheets)
        ? body.context.yesterdaySheets
        : [];
    const sheets = incomingSheets.slice(0, caps.historyWindow).map((sheet) => ({
      title: trimText(sheet.title, 80),
      pairs: Array.isArray(sheet.pairs)
        ? sheet.pairs.slice(0, 12).map((p) => ({
            term: trimText(p.term, 60),
            definition: trimText(p.definition, 80),
          }))
        : [],
    }));
    const lockedTitles = (Array.isArray(body.context?.lockedTitles) ? body.context.lockedTitles : [])
      .map((title) => trimText(title, 80))
      .filter(Boolean)
      .slice(0, 20);

    const sheetCount = Math.max(0, Number(body.context?.sheetCount ?? sheets.length));
    if (asksLockedHistory(rawMessage, caps.historyWindow, lockedTitles, sheetCount)) {
      return json(200, {
        reply: refuseHistory(locale, caps.historyWindow),
        blocked: 'history',
        quota: null,
      });
    }

    const defaultName = Boolean(body.context?.defaultName);
    const achievementCountEarly = Math.max(0, Number(body.context?.achievementCount ?? 0));
    const xpEarly = Math.max(0, Number(body.context?.xp ?? 0));
    const isNewAccountEarly = Boolean(
      body.context?.isNewAccount || (sheetCount === 0 && (defaultName || achievementCountEarly <= 1 || xpEarly < 50)),
    );
    const canned = localCoachReply(rawMessage, locale, {
      sheetCount,
      isNewAccount: isNewAccountEarly,
    });
    if (canned) {
      const { data: q } = await supabase.rpc('get_coach_chat_quota');
      return json(200, { reply: canned, blocked: 'local', quota: q ?? null });
    }

    const { data: quota, error: quotaError } = await supabase.rpc('consume_coach_chat_credit');
    if (quotaError) return json(400, { error: 'quota_rpc_failed', detail: quotaError.message });

    const quotaRow = (quota ?? {}) as {
      ok?: boolean;
      used?: number;
      limit?: number;
      remaining?: number;
      plan?: string;
      maxChars?: number;
      historyWindow?: number;
    };
    if (!quotaRow.ok) return json(429, { error: 'quota_exceeded', quota: quotaRow });

    const streak = Math.max(0, Number(body.context?.streak ?? 0));
    const level = Math.max(1, Number(body.context?.level ?? 1));
    const xp = xpEarly;
    const achievementCount = achievementCountEarly;
    const isNewAccount = isNewAccountEarly;
    const displayName = trimText(body.context?.displayName ?? '', 24);
    const achievements = Array.isArray(body.context?.achievements)
      ? body.context.achievements.map((a) => trimText(a, 40)).filter(Boolean).slice(0, 6)
      : [];

    const { data: historyRows } = await supabase
      .from('scanplay_coach_chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    const prior = (historyRows ?? [])
      .reverse()
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: trimText(row.content, 800),
      }));

    const contextBlock = [
      `Locale: ${locale}`,
      `Plan: ${plan}`,
      `Compte neuf: ${isNewAccount ? 'oui' : 'non'}`,
      `Pseudo auto ID-xxxx: ${defaultName ? 'oui' : 'non'}`,
      displayName ? `Pseudo (le sien seulement): ${displayName}` : '',
      `Nombre de fiches: ${sheetCount}`,
      `XP: ${xp}`,
      `Succès débloqués: ${achievementCount}`,
      `Fiches autorisées (les ${caps.historyWindow} plus récentes seulement):`,
      sheets.length
        ? sheets
            .map(
              (s) =>
                `- ${s.title}: ${s.pairs.map((p) => `${p.term} = ${p.definition}`).join(' ; ') || '(vide)'}`,
            )
            .join('\n')
        : '(aucune fiche — parle quand même, oriente vers un scan depuis Accueil, pas de quiz)',
      lockedTitles.length ? `Fiches hors quota, INTERDIT d'en parler: ${lockedTitles.join(', ')}` : '',
      `Série (flamme): ${streak} jour(s)`,
      `Niveau: ${level}`,
      `Succès récents: ${achievements.join(', ') || 'aucun'}`,
    ]
      .filter(Boolean)
      .join('\n');

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolveCoachModel(plan),
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: contextBlock },
          ...prior,
          { role: 'user', content: rawMessage },
        ],
      }),
    });

    if (!openaiRes.ok) {
      await supabase.rpc('refund_coach_chat_credit');
      const errText = await openaiRes.text();
      return json(502, { error: 'OpenAI request failed', detail: errText });
    }

    const openaiJson = await openaiRes.json();
    const reply = trimText(openaiJson?.choices?.[0]?.message?.content, 1800);
    if (!reply) {
      await supabase.rpc('refund_coach_chat_credit');
      return json(502, { error: 'Empty OpenAI response' });
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;
    if (admin) {
      await admin.from('scanplay_coach_chat_messages').insert([
        { user_id: user.id, role: 'user', content: rawMessage },
        { user_id: user.id, role: 'assistant', content: reply },
      ]);
    }

    return json(200, {
      reply,
      quota: {
        used: Number(quotaRow.used) || 0,
        limit: Number(quotaRow.limit) || caps.chatPerDay,
        remaining: Math.max(Number(quotaRow.remaining ?? (Number(quotaRow.limit) || caps.chatPerDay) - (Number(quotaRow.used) || 0)), 0),
        plan: quotaRow.plan,
        maxChars: quotaRow.maxChars ?? caps.maxChars,
        historyWindow: quotaRow.historyWindow ?? caps.historyWindow,
      },
    });
  } catch (error) {
    return json(500, { error: String(error) });
  }
});
