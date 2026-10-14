import type { WordPair } from '../types';
import { extractCoachActions } from './coachMessageFormat';
import { applyPairCertainty } from './pairCertainty';

export type RawPair = { term: string; definition: string };

const LABEL_RE =
  '(?:Traduction|Translation|Vertaling|Traducci[oó]n|D[eé]finition|Definition|Definizione|Bedeutung|Meaning|Sens|Formule|Formula|R[eé]sultat|Result|D[eé]riv[eé]e|Derivative|Corrig[eé]|Correction|Antwort|Antwoord|Respuesta)';

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s'/’-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSide(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop trailing coach chatter glued onto a definition. */
function cleanDefinition(raw: string): string {
  let s = cleanSide(raw);
  s = s.replace(
    /\s+(Si tu veux|Fais-moi|Tu es sur|Let me know|If you want|Als je|Si quieres|إذا|Wanna|Want to)\b.*$/i,
    '',
  );
  s = s.replace(/\s*[👇💪✨🎯🔥]+.*$/u, '');
  return s.trim();
}

/**
 * Parse free-form dumps like:
 * `je suis - I am, you are - tu es, but - pourquoi`
 */
export function extractDashPairs(text: string): RawPair[] {
  const raw = text.replace(/\r\n/g, '\n').trim();
  if (!raw) return [];

  const chunks = raw
    .split(/\n+|(?<=\S)\s*,\s*(?=\S)/)
    .map((c) => c.trim())
    .filter(Boolean);

  const out: RawPair[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(.+?)\s*(?:[-–—]|:|→|=>)\s*(.+)$/);
    if (!m) continue;
    const term = cleanSide(m[1]!);
    const definition = cleanDefinition(m[2]!);
    if (term.length < 1 || definition.length < 1) continue;
    if (term.length > 80 || definition.length > 120) continue;
    out.push({ term, definition });
  }
  return out;
}

/**
 * Parse numbered coach corrections (any UI language labels):
 * `1. **But** - Traduction : mais`
 * `2. **You are** : tu es / vous êtes`
 * `3. **f'(x)** - Formule : 2x`
 * Multiline: `1. **Term**\nTraduction : def`
 */
export function extractNumberedCoachPairs(text: string): RawPair[] {
  const cleaned = extractCoachActions(text).text;
  const out: RawPair[] = [];
  const sameLine = new RegExp(
    `(?:^|\\n)\\s*\\d+\\.\\s*\\*\\*([^*]+)\\*\\*\\s*(?:[-–—:]\\s*)?(?:(?:${LABEL_RE})\\s*:\\s*)?([^\\n]+)`,
    'gi',
  );
  let match: RegExpExecArray | null;
  while ((match = sameLine.exec(cleaned)) != null) {
    const term = cleanSide(match[1]!);
    let definition = cleanDefinition(match[2]!);
    /* Definition was only a label leftover or encouragement — try next line. */
    if (!definition || new RegExp(`^${LABEL_RE}$`, 'i').test(definition)) {
      const after = cleaned.slice(match.index + match[0].length);
      const next = after.match(
        new RegExp(`^\\s*(?:(?:${LABEL_RE})\\s*:\\s*)?([^\\n]+)`, 'i'),
      );
      if (next) definition = cleanDefinition(next[1]!);
    }
    if (term.length < 1 || definition.length < 1) continue;
    if (/^(revois|review|revise|corrige|check|fais-moi|let me|si tu)/i.test(definition)) continue;
    out.push({ term, definition });
  }

  /* Multiline fallback when bold term is alone on its numbered line. */
  const multi = new RegExp(
    `(?:^|\\n)\\s*\\d+\\.\\s*\\*\\*([^*]+)\\*\\*\\s*(?:\\n)+\\s*(?:(?:${LABEL_RE})\\s*:\\s*)?([^\\n]+)`,
    'gi',
  );
  while ((match = multi.exec(cleaned)) != null) {
    const term = cleanSide(match[1]!);
    const definition = cleanDefinition(match[2]!);
    if (term.length < 1 || definition.length < 1) continue;
    if (/^(revois|review|revise|corrige|check|fais-moi|let me|si tu)/i.test(definition)) continue;
    if (out.some((p) => norm(p.term) === norm(term))) continue;
    out.push({ term, definition });
  }
  return out;
}

function sidesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Allow "tu es" vs "tu es / vous êtes"
  if (na.includes(nb) || nb.includes(na)) return true;
  const partsA = na.split(/\s*\/\s*/);
  const partsB = nb.split(/\s*\/\s*/);
  return partsA.some((p) => partsB.includes(p));
}

function sameConcept(a: RawPair, b: RawPair): boolean {
  return (
    (sidesMatch(a.term, b.term) && sidesMatch(a.definition, b.definition)) ||
    (sidesMatch(a.term, b.definition) && sidesMatch(a.definition, b.term)) ||
    sidesMatch(a.term, b.term) ||
    sidesMatch(a.term, b.definition) ||
    sidesMatch(a.definition, b.term)
  );
}

function defsDiffer(user: RawPair, coach: RawPair): boolean {
  const userSides = [norm(user.term), norm(user.definition)];
  const coachDef = norm(coach.definition);
  const coachTerm = norm(coach.term);
  // User put a wrong gloss next to a term that matches the coach term (either orientation).
  if (sidesMatch(user.term, coach.term) && !sidesMatch(user.definition, coach.definition)) {
    return true;
  }
  if (sidesMatch(user.definition, coach.term) && !sidesMatch(user.term, coach.definition)) {
    return true;
  }
  if (sidesMatch(user.term, coach.definition) && !sidesMatch(user.definition, coach.term)) {
    // User had term=english def=french wrong? uncommon
    return !userSides.includes(coachTerm) || !userSides.includes(coachDef);
  }
  // Same concept key on one side, other side wrong
  if (
    (sidesMatch(user.term, coach.term) || sidesMatch(user.definition, coach.term)) &&
    !sidesMatch(user.term, coach.definition) &&
    !sidesMatch(user.definition, coach.definition)
  ) {
    return true;
  }
  return false;
}

function dedupeKey(pair: WordPair): string {
  return [norm(pair.term), norm(pair.definition)].sort().join('|');
}

/** Merge lists; keep uncertain if either side is uncertain. */
export function mergeWordPairs(...lists: WordPair[][]): WordPair[] {
  const map = new Map<string, WordPair>();
  for (const list of lists) {
    for (const pair of list) {
      const term = pair.term.trim();
      const definition = pair.definition.trim();
      if (!term || !definition) continue;
      const key = dedupeKey(pair);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          term,
          definition,
          faces: pair.faces,
          termLang: pair.termLang,
          defLang: pair.defLang,
          visual: pair.visual,
          quality: pair.quality ?? 'trusted',
        });
        continue;
      }
      map.set(key, {
        ...prev,
        quality:
          prev.quality === 'uncertain' || pair.quality === 'uncertain' ? 'uncertain' : 'trusted',
      });
    }
  }
  return [...map.values()];
}

/**
 * Build review cards from a coach turn: coach defs win; mismatches vs user → uncertain (red).
 */
export function buildCoachReviewPairs(userText: string, coachText: string): WordPair[] {
  const userPairs = extractDashPairs(userText);
  const coachPairs = extractNumberedCoachPairs(coachText);
  const out: WordPair[] = [];
  const usedUser = new Set<number>();

  for (const coach of coachPairs) {
    let uncertain = false;
    for (let i = 0; i < userPairs.length; i += 1) {
      if (usedUser.has(i)) continue;
      const user = userPairs[i]!;
      if (!sameConcept(user, coach)) continue;
      usedUser.add(i);
      if (defsDiffer(user, coach)) uncertain = true;
      break;
    }
    out.push({
      term: coach.term,
      definition: coach.definition,
      quality: uncertain ? 'uncertain' : 'trusted',
    });
  }

  for (let i = 0; i < userPairs.length; i += 1) {
    if (usedUser.has(i)) continue;
    const user = userPairs[i]!;
    out.push({
      term: user.term,
      definition: user.definition,
      quality: 'uncertain',
    });
  }

  return applyPairCertainty(
    mergeWordPairs(out).filter((p) => p.term.trim() && p.definition.trim()),
    'auto',
  );
}

/** True when this exchange can become a playable / reviewable deck. */
export function coachExchangeHasCards(userText: string, coachText: string): boolean {
  return buildCoachReviewPairs(userText, coachText).length >= 1;
}
