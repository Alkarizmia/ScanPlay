/**
 * Prepare vocabulary terms for oral games: one speakable word, no grammar notes in parentheses.
 */

/** Remove parenthetical grammar hints: (de), (het), (la), … */
export function stripGrammarParentheses(text: string): string {
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split "mens (de), mensen (de)" or "elk, elke" into separate spoken candidates. */
export function splitTermVariants(raw: string): string[] {
  const chunks = raw
    .split(/[,;]|(?:\s+-\s+)|(?:\s+–\s+)/)
    .map((part) => stripGrammarParentheses(part.trim()))
    .filter((part) => part.length >= 2);

  if (chunks.length > 0) return chunks;

  const single = stripGrammarParentheses(raw.trim());
  return single.length >= 2 ? [single] : [];
}

function scoreVariant(word: string): number {
  const clean = word.trim();
  if (!clean) return -1;
  let score = 0;
  if (/^[a-zA-ZàâäéèêëïîôùûüçñÀ-ÿ'-]+$/i.test(clean)) score += 4;
  if (clean.length >= 3 && clean.length <= 18) score += 3;
  if (!/\d/.test(clean)) score += 2;
  if (clean.split(/\s+/).length === 1) score += 2;
  return score;
}

/** Pick a single word/short phrase to pronounce (not two lemmas at once). */
export function pickSpeakTarget(rawTerm: string, seed = ''): string {
  const variants = splitTermVariants(rawTerm);
  if (variants.length === 0) return stripGrammarParentheses(rawTerm);

  if (variants.length === 1) return variants[0];

  const n = [...(seed || rawTerm)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const ranked = [...variants].sort((a, b) => scoreVariant(b) - scoreVariant(a));
  return ranked[n % ranked.length];
}

/** Optional note shown under meaning (e.g. other forms), not spoken. */
export function speakVariantNote(rawTerm: string, chosen: string): string | null {
  const variants = splitTermVariants(rawTerm).filter((v) => v.toLowerCase() !== chosen.toLowerCase());
  if (variants.length === 0) return null;
  return variants.slice(0, 2).join(' · ');
}
