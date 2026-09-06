import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchUserPlan } from '../_shared/planQuotas.ts';
import { isReasoningVisionModel, resolveExerciseModel } from '../_shared/openaiModels.ts';
import { TRANSLATE_EXERCISE_SYSTEM_PROMPT } from '../_shared/translateExercisePrompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  pairs?: { term?: string; definition?: string; termLang?: string; defLang?: string }[];
  count?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plan = await fetchUserPlan(supabase, user.id);
    const model = resolveExerciseModel(plan);
    const reasoning = isReasoningVisionModel(model);

    const body = (await req.json()) as Body;
    const pairs = Array.isArray(body.pairs) ? body.pairs.slice(0, 8) : [];
    const count = Math.min(6, Math.max(1, Number(body.count) || 2));
    if (pairs.length === 0) {
      return new Response(JSON.stringify({ rounds: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const list = pairs
      .map((p) => `- term="${p.term ?? ''}" (${p.termLang ?? '?'}) → definition="${p.definition ?? ''}" (${p.defLang ?? '?'})`)
      .join('\n');

    const payload: Record<string, unknown> = {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TRANSLATE_EXERCISE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Crée ${count} round(s) maximum, un par paire, dans l'ordre.
Phrases naturelles dans CHAQUE langue (fr / nl / en / es) — pas de calque "I see / Je vois / Ik zie".
Articles corrects (een beetje, un peu, de/het, un/una). Jamais "Dit is de beetje".
Adjectif → phrase d'état ; nom → article ; quantité → il y a / er is / there is / hay ; verbe → infinitif.

Paires :
${list}`,
        },
      ],
    };
    if (reasoning) {
      payload.max_completion_tokens = 1200;
      payload.reasoning_effort = 'low';
    } else {
      payload.temperature = 0.4;
      payload.max_tokens = 900;
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: 'openai_failed', detail: errText.slice(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const completion = await openaiRes.json();
    const text = completion?.choices?.[0]?.message?.content ?? '{}';
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { rounds: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
