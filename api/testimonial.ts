import type { VercelRequest, VercelResponse } from '@vercel/node';
import { tryGetSupabaseAdmin } from '../server/auth.js';

const FROM_EMAIL = 'ScanPlay <support@scanplay.org>';
const SUPPORT = 'support@scanplay.org';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-secret');
}

function trim(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function adminOk(req: VercelRequest): boolean {
  const secret = process.env.TESTIMONIAL_ADMIN_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = String(req.headers['x-admin-secret'] ?? '');
  const query = typeof req.query.secret === 'string' ? req.query.secret : '';
  return header === secret || query === secret;
}

async function notifySupport(row: {
  author_name: string;
  role: string;
  rating: number;
  quote: string;
  email: string;
  locale: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const stars = '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating);
  const text = [
    'Nouvel avis ScanPlay',
    `Nom: ${row.author_name}`,
    `Rôle: ${row.role}`,
    `Note: ${stars} (${row.rating}/5)`,
    `Locale: ${row.locale}`,
    `Email: ${row.email || '—'}`,
    '',
    row.quote,
    '',
    'Modère sur https://scanplay.org/avis-admin.html',
  ].join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [SUPPORT],
      subject: `Avis ${row.rating}/5 — ${row.author_name}`,
      text,
    }),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const admin = tryGetSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'not_configured' });

  if (req.method === 'GET') {
    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'approved';
    if (scope === 'all') {
      if (!adminOk(req)) return res.status(401).json({ error: 'unauthorized' });
      const { data, error } = await admin
        .from('scanplay_testimonials')
        .select('id, created_at, author_name, role, rating, quote, email, locale, approved')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ items: data ?? [] });
    }
    const { data, error } = await admin
      .from('scanplay_testimonials')
      .select('id, author_name, role, rating, quote')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(12);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data ?? [] });
  }

  if (req.method === 'PATCH') {
    if (!adminOk(req)) return res.status(401).json({ error: 'unauthorized' });
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as {
      id?: string;
      approved?: boolean;
    };
    const id = trim(body.id, 80);
    if (!id || typeof body.approved !== 'boolean') {
      return res.status(400).json({ error: 'id_and_approved_required' });
    }
    const { error } = await admin.from('scanplay_testimonials').update({ approved: body.approved }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as Record<
    string,
    unknown
  >;

  const author_name = trim(body.name ?? body.author_name, 40);
  const role = trim(body.role, 40) || 'élève';
  const quote = trim(body.quote ?? body.message, 500);
  const email = trim(body.email, 120);
  const locale = trim(body.locale, 8) || 'fr';
  const rating = Math.min(5, Math.max(1, Number(body.rating) || 0));

  if (author_name.length < 2) return res.status(400).json({ error: 'name_required' });
  if (quote.length < 12) return res.status(400).json({ error: 'quote_too_short' });
  if (!Number.isFinite(rating) || rating < 1) return res.status(400).json({ error: 'rating_required' });

  const { error } = await admin.from('scanplay_testimonials').insert({
    author_name,
    role,
    rating,
    quote,
    email: email || null,
    locale,
    approved: false,
    source: 'avis_form',
  });

  if (error) {
    console.error('testimonial insert', error.message);
    return res.status(500).json({ error: 'save_failed', detail: error.message });
  }

  await notifySupport({ author_name, role, rating, quote, email, locale });
  return res.status(200).json({ ok: true });
}
