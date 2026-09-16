import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from '../server/auth.js';
import {
  clipTtsInput,
  MAX_TTS_CHARS,
  OPENAI_TTS_MODEL,
  ttsInstructions,
  ttsVoiceForLang,
} from '../src/lib/openaiTts.js';

function asLang(value: unknown): 'fr' | 'nl' | 'en' | 'es' | undefined {
  if (value === 'fr' || value === 'nl' || value === 'en' || value === 'es') return value;
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(process.env.OPENAI_API_KEY?.trim()) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'not_configured' });
  }

  const body = req.body as { text?: string; lang?: string; slow?: boolean };
  const text = clipTtsInput(typeof body?.text === 'string' ? body.text : '');
  if (!text) {
    return res.status(400).json({ error: 'empty_text' });
  }
  if (text.length > MAX_TTS_CHARS) {
    return res.status(400).json({ error: 'text_too_long' });
  }

  const lang = asLang(body?.lang);
  const slow = Boolean(body?.slow);

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        input: text,
        voice: ttsVoiceForLang(lang),
        instructions: ttsInstructions(lang, slow ? 0.65 : undefined),
        response_format: 'mp3',
      }),
    });

    if (!openaiRes.ok) {
      return res.status(502).json({ error: 'tts_failed' });
    }

    const buf = Buffer.from(await openaiRes.arrayBuffer());
    if (buf.length < 100) {
      return res.status(502).json({ error: 'tts_empty' });
    }

    return res.status(200).json({ audio: buf.toString('base64'), mime: 'audio/mpeg' });
  } catch {
    return res.status(502).json({ error: 'tts_error' });
  }
}
