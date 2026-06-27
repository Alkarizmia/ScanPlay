import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  assertCanScan,
  fetchUserPlan,
  fetchUserStatsData,
  incrementScanCount,
} from '../_shared/planQuotas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCANPLAY_AI_SYSTEM_PROMPT = `Tu es le moteur d'extraction ScanPlay. Tu analyses une photo de fiche scolaire (souvent floue, inclinée, mal éclairée, manuscrite ou imprimée) et tu en extrais des paires jouables pour des mini-jeux (flashcards, quiz, match).

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans texte avant ou après.
- Ne invente jamais de contenu absent de l'image. Si tu devines, marque confidence "low".
- Même si la qualité est mauvaise : fais de ton mieux pour lire mot par mot, colonne par colonne, ligne par ligne.
- Ignore : titres de page, numéros seuls, consignes ("Let op", "Attention", "Exercice", "Page 12"), logos, tampons, marges vides.
- Chaque paire doit avoir un "term" et une "definition" distincts (pas identiques).
- Longueur : term ≤ 55 caractères, definition ≤ 120 caractères. Coupe proprement si trop long.
- Minimum visé : 4 paires propres pour vocab/définitions ; pour notes, au moins 3 paires si le contenu le permet.
- Langues fréquentes : nl, fr, en, es. Détecte-les ; ne traduis pas sauf si la fiche le fait déjà.

TYPES DE FICHE (sheetType) :
- "vocab" : 2 colonnes (ex. NL à gauche, FR à droite). Associe ligne par ligne. Si colonnes décalées, aligne par proximité verticale.
- "definitions" : format question/réponse ou mot — définition sur une ou deux lignes.
- "notes" : transforme en paires mémorables : extrait clé (terme, date, concept, mot-clé) → idée courte à retenir (phrase résumée, max 120 car.).

QUALITÉ IMAGE FAIBLE :
- Utilise le contexte (titres, numérotation, séparateurs - : |).
- Corrige les erreurs OCR évidentes (ex. "pa" → "pas", accents manquants) seulement si le sens est clair.
- Si une ligne est illisible, skip-la ; ne remplis pas avec du vide.
- Si moins de 4 paires fiables : renvoie quand même ce que tu as + readable: false.

Priorité : extraire un maximum de paires plausibles plutôt que abandonner.
En cas de doute entre deux lectures, choisis la plus cohérente avec le reste de la fiche (même langue, même thème).
Ne renvoie readable: false que si tu as moins de 2 paires avec un minimum de certitude.

FORMAT DE SORTIE (strict) :
{
  "readable": boolean,
  "sheetType": "vocab" | "notes" | "definitions",
  "detectedLangs": ["nl","fr"],
  "pairs": [
    {
      "term": "string",
      "definition": "string",
      "termLang": "nl|fr|en|es|unknown",
      "defLang": "nl|fr|en|es|unknown",
      "confidence": "high|medium|low"
    }
  ],
  "warnings": ["string"]
}

readable = true seulement si au moins 4 paires ont confidence "high" ou "medium" et sont clairement visibles sur la photo.`;

function buildUserPrompt(sheetType: string): string {
  return `Analyse cette photo de fiche scolaire pour l'application ScanPlay.

Type choisi par l'utilisateur : ${sheetType}

Objectif : produire des paires term/definition exploitables pour des jeux éducatifs.

Consignes supplémentaires :
- Photo possiblement floue, penchée ou sombre : lis quand même au maximum.
- Pour vocab : cherche deux colonnes (langue A | langue B).
- Pour definitions : une notion = une réponse courte.
- Pour notes : decoupe en petites unités mémorables (mot-clé → résumé).
- Exclus les lignes de consigne ou d'exemple générique sans contenu à apprendre.

Retourne le JSON au format imposé dans le system prompt.`;
}

interface AnalyzeBody {
  imageBase64?: string;
  mimeType?: string;
  sheetType?: string;
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

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    const plan = await fetchUserPlan(supabase, user.id);
    const statsData = supabaseAdmin
      ? await fetchUserStatsData(supabaseAdmin, user.id)
      : {};
    const scanQuotaError = assertCanScan(plan, statsData);
    if (scanQuotaError) {
      return new Response(JSON.stringify({ error: scanQuotaError }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as AnalyzeBody;
    const { imageBase64, mimeType = 'image/jpeg', sheetType = 'vocab' } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = buildUserPrompt(sheetType);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          { role: 'system', content: SCANPLAY_AI_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
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

    if (supabaseAdmin) {
      await incrementScanCount(supabaseAdmin, user.id);
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
