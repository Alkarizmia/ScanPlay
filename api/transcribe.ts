import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './lib/auth.js';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'not_configured' });
  }

  const body = req.body as { audio?: string; mime?: string; lang?: string };
  if (!body?.audio || typeof body.audio !== 'string') {
    return res.status(400).json({ error: 'missing_audio' });
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.audio, 'base64');
  } catch {
    return res.status(400).json({ error: 'invalid_audio' });
  }

  if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
    return res.status(400).json({ error: 'audio_too_large' });
  }

  const mime = body.mime?.includes('mp4') ? 'audio/mp4' : 'audio/webm';
  const ext = mime.includes('mp4') ? 'm4a' : 'webm';
  const lang = body.lang?.trim() || 'fr';

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), `speech.${ext}`);
  form.append('model', 'whisper-large-v3');
  form.append('language', lang);
  form.append('response_format', 'json');

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text();
      return res.status(502).json({ error: 'transcribe_failed', detail: detail.slice(0, 200) });
    }

    const data = (await groqRes.json()) as { text?: string };
    return res.status(200).json({ text: data.text?.trim() ?? '' });
  } catch {
    return res.status(502).json({ error: 'transcribe_error' });
  }
}
