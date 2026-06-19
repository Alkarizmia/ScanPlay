import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es le moteur de synthèse ScanPlay. Tu crées une fiche de révision structurée à partir d'une photo de cours (si fournie) et des paires extraites.

RÈGLES :
- Réponds UNIQUEMENT en JSON valide, sans markdown autour.
- Base-toi sur le contenu réel de la fiche et des paires. N'invente pas de chapitres absents.
- Langue de rédaction : celle indiquée par locale (fr, en, nl, es).
- Structure claire : titres, paragraphes courts, listes à puces, tableaux si pertinent (vocab, dates, comparaisons).
- Maximum 6 sections, 12 points clés, 6 astuces mémoire.

FORMAT JSON strict :
{
  "title": "string",
  "subject": "string (matière ou thème)",
  "introduction": "string (2-4 phrases de contexte)",
  "sections": [
    {
      "heading": "string",
      "content": "string",
      "bullets": ["string"] | null,
      "table": { "headers": ["col1","col2"], "rows": [["a","b"]] } | null,
      "highlight": "string (phrase à retenir)" | null
    }
  ],
  "keyPoints": ["string"],
  "memoryTips": ["string"],
  "relatedToScan": "string (lien explicite avec ce qui est visible sur la photo / le cours)"
}

Si mode "study" : sections plus pédagogiques, highlights mémorables, tableaux pour vocab.
Si mode "export" : ton sobre, prêt à imprimer, tableaux propres.`;

interface SynthesisBody {
  pairs?: { term: string; definition: string }[];
  locale?: string;
  mode?: string;
  title?: string;
  sheetType?: string;
  imageBase64?: string;
  mimeType?: string;
}

function buildUserPrompt(body: SynthesisBody): string {
  const pairs = Array.isArray(body.pairs) ? body.pairs.slice(0, 80) : [];
  const pairsText = pairs.map((p) => `- ${p.term} → ${p.definition}`).join('\n');
  const mode = body.mode === 'export' ? 'export' : 'study';
  const locale = body.locale ?? 'fr';

  return `Crée une synthèse de révision ScanPlay.

Locale (langue de rédaction) : ${locale}
Mode présentation : ${mode}
Type de fiche : ${body.sheetType ?? 'vocab'}
Titre suggéré : ${body.title ?? 'Synthèse du cours'}

Paires extraites du scan (${pairs.length}) :
${pairsText || '(aucune paire — utilise uniquement la photo si présente)'}

${mode === 'study' ? 'Rends la synthèse vivante et mémorable pour réviser dans l\'app.' : 'Rends la synthèse sobre et imprimable (PDF/Word).'}

Retourne le JSON au format imposé.`;
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

    const body = (await req.json()) as SynthesisBody;
    const userPrompt = buildUserPrompt(body);
    const hasImage = typeof body.imageBase64 === 'string' && body.imageBase64.length > 100;

    const userContent: unknown[] = [{ type: 'text', text: userPrompt }];
    if (hasImage) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${body.mimeType ?? 'image/jpeg'};base64,${body.imageBase64}`,
          detail: 'high',
        },
      });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.35,
        max_tokens: 3500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: 'OpenAI request failed', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Empty OpenAI response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON from OpenAI', raw: content }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
