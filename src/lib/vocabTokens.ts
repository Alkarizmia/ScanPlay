/** Split "défi, difficultés" into separate words when it is a list, not a sentence. */
export function splitVocabAlternatives(text: string): string[] {
  const cleaned = text.replace(/[–—]/g, '-').trim();
  if (!cleaned) return [];

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (/[.!?]/.test(cleaned) && words.length >= 5) return [cleaned];

  const parts = cleaned
    .split(/\s*[,/;|]\s*|\s+-\s+/)
    .map((part) => part.replace(/[.,!?]+$/g, '').trim())
    .filter(Boolean);

  if (parts.length < 2) return [cleaned];

  const listLike = parts.every((part) => {
    const tokens = part.split(/\s+/).filter(Boolean);
    return tokens.length >= 1 && tokens.length <= 3 && part.length <= 32;
  });
  return listLike ? parts : [cleaned];
}

export function pickVocabToken(text: string, seed = ''): string {
  const alts = splitVocabAlternatives(text);
  if (alts.length === 1 || !seed) return alts[0] ?? text.trim();

  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return alts[Math.abs(h) % alts.length]!;
}
