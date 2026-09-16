import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  clipTtsInput,
  MAX_TTS_CHARS,
  OPENAI_TTS_MODEL,
  ttsInstructions,
  ttsVoiceForLang,
} from '../_shared/openaiTts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json(503, { error: 'tts_unavailable' });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return json(401, { error: 'Unauthorized' });

    const body = (await req.json()) as { text?: string; lang?: string; slow?: boolean };
    const text = clipTtsInput(typeof body.text === 'string' ? body.text : '');
    if (!text || text.length < 1) return json(400, { error: 'empty_text' });
    if (text.length > MAX_TTS_CHARS) return json(400, { error: 'text_too_long' });

    const lang = body.lang;
    const slow = Boolean(body.slow);
    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        input: text,
        voice: ttsVoiceForLang(lang),
        instructions: ttsInstructions(lang, slow),
        response_format: 'mp3',
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('tts upstream failed', openaiRes.status, errText.slice(0, 200));
      return json(502, { error: 'tts_failed' });
    }

    const bytes = new Uint8Array(await openaiRes.arrayBuffer());
    if (bytes.length < 100) return json(502, { error: 'tts_empty' });

    return json(200, { audio: bytesToBase64(bytes), mime: 'audio/mpeg' });
  } catch (err) {
    console.error('tts exception', err);
    return json(500, { error: 'tts_error' });
  }
});
