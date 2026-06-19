import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { getSupabaseAnonKey, getSupabaseUrl } from './stripe.js';

export async function getUserFromRequest(req: VercelRequest): Promise<User | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) return null;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function getSupabaseAdmin() {
  const client = tryGetSupabaseAdmin();
  if (!client) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is not set');
  }
  return client;
}

export function tryGetSupabaseAdmin() {
  const url = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
