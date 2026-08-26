import { getSupabase, isSupabaseConfigured } from './supabase';
import type { WordPair } from '../types';
import { parseAiTranslateRounds, type TranslateRound } from './translateRounds';

export function isTranslateAiEnabled(): boolean {
  if (!isSupabaseConfigured) return false;
  const flag = import.meta.env.VITE_AI_SCAN;
  return flag !== '0' && flag !== 'false';
}

export async function fetchAiTranslateRounds(
  pairs: WordPair[],
  count: number,
): Promise<TranslateRound[] | null> {
  if (!isTranslateAiEnabled()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const slice = pairs.slice(0, Math.max(count, 3)).map((p) => ({
    term: p.term,
    definition: p.definition,
    termLang: p.termLang,
    defLang: p.defLang,
  }));

  const { data, error } = await supabase.functions.invoke('generate-translate-rounds', {
    body: { pairs: slice, count },
  });
  if (error || !data) return null;
  return parseAiTranslateRounds(data, pairs);
}

export async function fetchAiTranslateRoundsTimed(
  pairs: WordPair[],
  count: number,
  ms = 3200,
): Promise<TranslateRound[] | null> {
  try {
    return await Promise.race([
      fetchAiTranslateRounds(pairs, count),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  }
}
