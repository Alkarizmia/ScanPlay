import { lookupVocabGloss } from './loanwordGlosses';
import type { WordPair } from '../types';

const TITLE_FRAGMENT = /^(vocabulaire|quelques mots|dans la (lan|langue)|liste de|un peu de)\b/i;

function detectLangSimple(text: string): 'nl' | 'fr' | 'en' | 'unknown' {
  const t = text.trim();
  let fr = 0;
  let en = 0;
  let nl = 0;
  if (/[àâäéèêëïîôùûüç]/i.test(t)) fr += 2;
  if (/\b\w+['’]\w+/u.test(t)) fr += 2; /* j'arrive, s'agit, n'aime */
  if (/\b(le|la|les|des|du|je|tu|nous|vous|qui|c'est|ça|pas|très|mal|tête|avance|retard)\b/i.test(t)) {
    fr += 2;
  }
  if (/\w+(lijk|heid|isch)\b/i.test(t)) nl += 2;
  if (/\b(de|het|een|van|niet)\b/i.test(t) && fr === 0) nl += 1;
  if (
    /\b(i|i'm|i am|it's|it is|my|who|what|leave|well|done|don't|doesn't|am|are|is|early|late|ready|funny|easy|difficult|care|hard|coming|leaving|aches|knows|patient|not at all)\b/i.test(
      t,
    )
  ) {
    en += 2;
  }
  if (/\b(the|and|with|every|someone|before|after|without)\b/i.test(t)) en += 2;
  const best = Math.max(fr, en, nl);
  if (best === 0) return 'unknown';
  if (fr === best && fr > en) return 'fr';
  if (en === best && en > fr) return 'en';
  if (nl === best && nl > fr && nl > en) return 'nl';
  return 'unknown';
}

/** Mid-phrase cut across columns: "De qui s'agit" → "il ?" or "La isse" → "le ici". */
export function looksLikeColumnSplitFragment(term: string, definition: string): boolean {
  const t = term.trim();
  const d = definition.trim();
  if (!t || !d) return true;
  const defWords = d.split(/\s+/).filter(Boolean);

  /* French phrase cut mid-way into a tiny right fragment */
  if (
    defWords.length <= 2 &&
    /^(il|elle|ici|là|ça|y|en)\b|[?!.]$/i.test(d) &&
    (/\b(de qui|s['’]agit|laisse|c['’]est|j['’]|n['’]aime|m['’]en)\b/i.test(t) ||
      (/\b(qui|je|tu)\b/i.test(t) && /['’]/.test(t)))
  ) {
    return true;
  }

  /* OCR broke one French word: "La isse" — not "a baby" / "de zoon" */
  if (
    /^[A-ZÀ-Ÿ][a-zà-ÿ]{0,3}\s+[a-zà-ÿ]{2,6}$/u.test(t) &&
    defWords.length <= 3 &&
    /^(le|la|les|un|une|de|du|ici)\b/i.test(d) &&
    !/\b(de|het|een|a|an|the|to)\s+\S/i.test(t)
  ) {
    return true;
  }

  return false;
}

export function isCrossLanguageVocabPair(pair: {
  term: string;
  definition: string;
  termLang?: string;
  defLang?: string;
}): boolean {
  const hintedT = pair.termLang && pair.termLang !== 'unknown' ? pair.termLang : null;
  const hintedD = pair.defLang && pair.defLang !== 'unknown' ? pair.defLang : null;
  const tl = hintedT ?? detectLangSimple(pair.term);
  const dl = hintedD ?? detectLangSimple(pair.definition);
  /* Keep short/ambiguous rows (EVERY→CHAQUE); only reject clear same-lang. */
  if (tl === 'unknown' || dl === 'unknown') return true;
  return tl !== dl;
}

/**
 * If the sheet already shows a clear bilingual majority (e.g. ≥3 EN→FR),
 * drop langue1→langue1 noise — even when bad FR→FR rows outnumber the good ones.
 */
export function dropSameLanguageOutliers<T extends {
  term: string;
  definition: string;
  termLang?: string;
  defLang?: string;
  faces?: string[];
}>(pairs: T[]): T[] {
  const withoutSplits = pairs.filter((p) => !looksLikeColumnSplitFragment(p.term, p.definition));
  if (withoutSplits.length === 0) return withoutSplits;

  const cross = withoutSplits.filter((p) => isCrossLanguageVocabPair(p));
  /* ≥2 clear bilingual cards = translation sheet → drop FR→FR / EN→EN junk */
  if (cross.length >= 2) {
    return withoutSplits.filter(
      (p) => isCrossLanguageVocabPair(p) || (p.faces?.length ?? 0) > 0,
    );
  }

  if (withoutSplits.length >= 4 && cross.length >= Math.ceil(withoutSplits.length * 0.5)) {
    return withoutSplits.filter(
      (p) => isCrossLanguageVocabPair(p) || (p.faces?.length ?? 0) > 0,
    );
  }

  return withoutSplits;
}

export function isSpellingHintDefinition(definition: string): boolean {
  const d = definition.trim();
  if (!d) return true;
  if (/^…/.test(d) || /^\.{2,}/.test(d)) return true;
  if (/^mot\s*[·•]\s*\d+\s*lettres?$/i.test(d)) return true;
  return d === 'Mot à retenir';
}

/** Truncated OCR token (e.g. "iologiste" from "audiologiste"). */
export function isHeadlessOcrFragment(text: string): boolean {
  const stripped = text
    .trim()
    .replace(/^(l['’]|le |la |les |un |une |des |du |de |het |een |the |a |an )/i, '');
  const token = (stripped.split(/[\s,;:/]+/)[0] ?? '').replace(/[.,!?]+$/g, '');
  if (token.length < 5 || token.length > 24) return false;
  if (/^(io|olo|olog)(giste|gue|gie|iste)?/i.test(token)) return true;
  if (/^(logiste|ologue|ologie|issement)$/i.test(token)) return true;
  if (/^[aeiouy]{1,2}(log|scop|graph|phon|metr)/i.test(token)) return true;
  return false;
}

/** Drop a truncated OCR token that is a piece of another word (iologiste ⊂ audiologiste), not related vocab. */
export function dropSiblingOcrFragments<T extends { term: string; definition: string }>(pairs: T[]): T[] {
  return pairs.filter((pair) => {
    if (isHeadlessOcrFragment(pair.term) || isHeadlessOcrFragment(pair.definition)) return false;
    const def = pair.definition
      .toLowerCase()
      .replace(/^(l['’]|le |la |les |un |une )/i, '')
      .trim();
    const token = (def.split(/[\s,;:/()]+/)[0] ?? '').replace(/[.,!?]+$/g, '');
    if (token.length < 6) return true;
    return !pairs.some((other) => {
      if (other === pair) return false;
      const words = `${other.term} ${other.definition}`.toLowerCase().split(/[\s,;:/()]+/);
      return words.some((w) => w !== token && w.includes(token) && w.length - token.length >= 2);
    });
  });
}

/** Chapter / section heading — not a vocabulary item. */
export function isSectionTitle(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 72) return false;
  if (/^(les|the)\s+(conjonctions|verbes|adjectifs|prépositions|prepositions|mots|coordination)\b/i.test(t)) {
    return true;
  }
  if (/^(le|la|les|het|de|l')\s+[A-ZÀ-Ÿ][\wàâäéèêëïîôùûüç'-]*(\s+[A-Za-zàâäéèêëïîôùûüç'-]+){1,4}$/.test(t)) {
    return true;
  }
  if (/^(le|la|les)\s+r[eè]gne\b/i.test(t)) return true;
  if (/^woordenschat\b/i.test(t)) return true;
  if (/^vocabulaire\b/i.test(t) && t.split(/\s+/).length <= 6) return true;
  /* "Maatschappij & conflict (société et conflit)" style bilingual section headers */
  if (/\([^)]{3,40}\)/.test(t) && /\b(et|and|en|&)\b/i.test(t) && t.split(/\s+/).length <= 10) {
    return true;
  }
  if (/^[A-ZÀ-Ÿ][\wàâäéèêëïîôùûüç'-]*\s*&\s*[a-zàâäéèêëïîôùûüç'-]+/i.test(t) && t.length <= 48) {
    return true;
  }
  return false;
}

export function isExampleSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (/[.?!?,;:]/.test(t) && words.length >= 3) return true;
  if (
    words.length >= 4 &&
    /\b(ik|je|jij|wij|zij|het|is|are|the|we|they|nous|vous|il|elle|tu|dan|als|maar|want|niet|heb|ben|eet|drink|wil|gaat|blijf|regent|kom|komt)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function isGarbageVocabTerm(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2) return true;
  if (TITLE_FRAGMENT.test(t)) return true;
  if (isSectionTitle(t)) return true;
  const low = t.toLowerCase();
  if (/^dans la (lan|langue)/.test(low)) return true;
  if (/^quelques mots/.test(low)) return true;
  if (/^(dans|les|des|une|the)\s+(la\s+)?(lan|langue)/.test(low)) return true;
  if (/^…/.test(t)) return true;
  if (isSpellingHintDefinition(t)) return true;
  if (isHeadlessOcrFragment(t)) return true;
  if (/^[a-zà-]{1,5}\)$/i.test(t)) return true;
  if (/\)\s*$/.test(t) && !/\(/.test(t)) return true;
  if (
    /^[a-z]{1,2}\s+[a-zà-]/i.test(t) &&
    t.length <= 14 &&
    !/^(de|het|een|le|la|les|un|une|du|des|au|en|te|om|op|il|je|tu|a|an|the|to|my|i|we|you|he|she|they|it|me|my|no)\s+/i.test(t)
  ) {
    return true;
  }
  if (/^[a-z]{1,3}\s+animal$/i.test(t)) return true;
  return false;
}

function hasDutchArticle(text: string): boolean {
  return /\b(de|het|een)\s+\S/i.test(text) || /\(\s*(de|het)\s*\)/i.test(text);
}

function hasFrenchArticle(text: string): boolean {
  return /\b(l['']|le|la|les|un|une|des|du|au|aux)\s+\S/i.test(text);
}

function normalizeGlossKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function glossMatches(term: string, definition: string): boolean {
  const gloss = lookupVocabGloss(term);
  if (!gloss) return false;
  const g = normalizeGlossKey(gloss);
  const d = normalizeGlossKey(definition);
  return g === d || g.includes(d) || d.includes(g);
}

function isLikelyTranslationPair(term: string, definition: string): boolean {
  if (glossMatches(term, definition) || glossMatches(definition, term)) return true;
  if (lookupVocabGloss(term) && lookupVocabGloss(definition)) return false;

  if (hasDutchArticle(term) && hasFrenchArticle(definition)) return true;
  if (hasFrenchArticle(term) && hasDutchArticle(definition)) return true;

  const termNl = /\w+(lijk|heid)\b|\(\s*(de|het)\s*\)/i.test(term);
  const termFr = /[àâäéèêëïîôùûüç]|(tion|ment)\b/i.test(term);
  const defNl = /\w+(lijk|heid)\b|\(\s*(de|het)\s*\)/i.test(definition);
  const defFr = /[àâäéèêëïîôùûüç]|(tion|ment)\b/i.test(definition);

  if (termNl && defFr) return true;
  if (termFr && defNl) return true;

  const tl = detectLangSimple(term);
  const dl = detectLangSimple(definition);
  if (tl !== 'unknown' && dl !== 'unknown' && tl !== dl) return true;

  if ((termFr || defFr) && !lookupVocabGloss(term)) return true;

  if (
    /^[a-zàâäéèêëïîôùûüç'()-]{3,14}$/i.test(term) &&
    /^[a-zàâäéèêëïîôùûüç'()-]{3,16}$/i.test(definition) &&
    term.toLowerCase() !== definition.toLowerCase() &&
    !lookupVocabGloss(term) &&
    !lookupVocabGloss(definition)
  ) {
    return true;
  }

  return false;
}

/** Definition usable in quiz, vrai/faux, match — not a suffix hint or second column word. */
export function isPlayableDefinition(definition: string, term: string): boolean {
  if (isSpellingHintDefinition(definition)) return false;
  if (isGarbageVocabTerm(definition)) return false;

  const def = definition.trim();
  const defWords = def.split(/\s+/).length;
  const termWords = term.trim().split(/\s+/).length;

  if (defWords >= 2 || def.length >= 14) return true;
  if (glossMatches(term, definition)) return true;
  if (lookupVocabGloss(term) && defWords >= 2) return true;

  if (
    looksLikeStandaloneVocabWord(term) &&
    looksLikeStandaloneVocabWord(def) &&
    termWords <= 2 &&
    defWords <= 2
  ) {
    return isLikelyTranslationPair(term, def);
  }

  return defWords >= 2;
}

export function isTrustedForQuiz(pair: WordPair): boolean {
  return pair.quality !== 'uncertain';
}

/** Vrai/Faux needs real cross-language translation pairs with distinct answers. */
export function isTrueFalseSuitable(pairs: WordPair[]): boolean {
  if (pairs.length < 3) return false;

  const candidates = pairs.filter(
    (p) =>
      isTrustedForQuiz(p) &&
      !isGarbageVocabTerm(p.term) &&
      !isGarbageVocabTerm(p.definition) &&
      !isSectionTitle(p.term) &&
      !isSectionTitle(p.definition) &&
      !isExampleSentence(p.term) &&
      !isExampleSentence(p.definition) &&
      isPlayableDefinition(p.definition, p.term) &&
      isLikelyTranslationPair(p.term, p.definition),
  );

  if (candidates.length < 3) return false;

  const uniqueDefs = new Set(candidates.map((p) => p.definition.toLowerCase().trim()));
  const uniqueTerms = new Set(candidates.map((p) => p.term.toLowerCase().trim()));
  return uniqueDefs.size >= 3 && uniqueTerms.size >= 3;
}

export function looksLikeStandaloneVocabWord(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 32 || isGarbageVocabTerm(t)) return false;
  if (isSpellingHintDefinition(t)) return false;
  return t.split(/\s+/).length <= 2;
}

export function enrichPairWithGloss(pair: WordPair): WordPair | null {
  if (isGarbageVocabTerm(pair.term)) return null;
  if (isSectionTitle(pair.term) || isSectionTitle(pair.definition)) return null;

  const termWords = pair.term.trim().split(/\s+/).filter(Boolean).length;
  const defWords = pair.definition.trim().split(/\s+/).filter(Boolean).length;
  const shortPhrase = termWords <= 8 && defWords <= 8;
  const tl = pair.termLang && pair.termLang !== 'unknown' ? pair.termLang : null;
  const dl = pair.defLang && pair.defLang !== 'unknown' ? pair.defLang : null;
  const clearCross =
    Boolean(tl && dl && tl !== dl) ||
    (isCrossLanguageVocabPair(pair) &&
      !isSpellingHintDefinition(pair.definition) &&
      detectLangSimple(pair.term) !== 'unknown' &&
      detectLangSimple(pair.definition) !== 'unknown' &&
      detectLangSimple(pair.term) !== detectLangSimple(pair.definition));
  const bilingualPhrase = shortPhrase && clearCross && !isSpellingHintDefinition(pair.definition);

  /* Translation-list phrases ("Who is it?" → "De qui s'agit-il ?") are not note sentences. */
  if (isExampleSentence(pair.term) && !bilingualPhrase) return null;
  if (isExampleSentence(pair.definition) && defWords >= 4 && !bilingualPhrase) return null;

  const gloss = lookupVocabGloss(pair.term);
  const wrongColumnPair =
    looksLikeStandaloneVocabWord(pair.term) &&
    looksLikeStandaloneVocabWord(pair.definition) &&
    !isLikelyTranslationPair(pair.term, pair.definition);

  if (wrongColumnPair && gloss) {
    return { ...pair, definition: gloss, defLang: 'fr' };
  }

  if (isPlayableDefinition(pair.definition, pair.term)) return pair;
  /* Short bilingual cards ("I am coming" → "J'arrive") are playable even if def is 1 token. */
  if (bilingualPhrase && pair.term.trim().length >= 2 && pair.definition.trim().length >= 2) {
    return pair;
  }
  if (!gloss) return null;

  return { ...pair, definition: gloss, defLang: 'fr' };
}

export function enrichTeachablePairs(pairs: WordPair[]): WordPair[] {
  const out: WordPair[] = [];
  const seen = new Set<string>();

  for (const pair of dropSiblingOcrFragments(pairs)) {
    const enriched = enrichPairWithGloss(pair);
    if (!enriched) continue;
    const key = enriched.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(enriched);
  }

  return out;
}
