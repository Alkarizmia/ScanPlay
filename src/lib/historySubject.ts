import type { HistorySubject, Locale, SheetType, WordPair } from '../types';
import { getLocale } from './i18n';

interface KeywordRule {
  pattern: RegExp;
  weight: number;
}

const SUBJECT_KEYWORDS: Record<Exclude<HistorySubject, 'general'>, KeywordRule[]> = {
  law: [
    { pattern: /\bdroit\b/i, weight: 14 },
    { pattern: /\bloi\b/i, weight: 10 },
    { pattern: /juridique/i, weight: 12 },
    { pattern: /jurisprudence/i, weight: 12 },
    { pattern: /tribunal/i, weight: 10 },
    { pattern: /contrat/i, weight: 9 },
    { pattern: /code (?:civil|p[eé]nal|commercial)/i, weight: 14 },
    { pattern: /constitution/i, weight: 10 },
    { pattern: /\barticle\s+\d+/i, weight: 8 },
    { pattern: /avocat/i, weight: 9 },
    { pattern: /proc[eé]dure/i, weight: 8 },
    { pattern: /responsabilit[eé]/i, weight: 9 },
    { pattern: /obligation/i, weight: 7 },
    { pattern: /recettes?\s+totales/i, weight: 14 },
    { pattern: /fiscal/i, weight: 10 },
    { pattern: /imp[oô]t/i, weight: 9 },
    { pattern: /p[eé]nal/i, weight: 8 },
    { pattern: /civil\b/i, weight: 6 },
    { pattern: /justice/i, weight: 8 },
    { pattern: /l[eé]gislation/i, weight: 10 },
  ],
  economics: [
    { pattern: /[eé]conom/i, weight: 12 },
    { pattern: /comptabilit[eé]/i, weight: 11 },
    { pattern: /budget/i, weight: 9 },
    { pattern: /\bPIB\b/i, weight: 12 },
    { pattern: /inflation/i, weight: 10 },
    { pattern: /march[eé]/i, weight: 7 },
    { pattern: /offre et demande/i, weight: 12 },
    { pattern: /macro[eé]conom/i, weight: 12 },
    { pattern: /micro[eé]conom/i, weight: 12 },
    { pattern: /recette/i, weight: 6 },
    { pattern: /d[eé]pense/i, weight: 6 },
  ],
  math: [
    { pattern: /\bmath/i, weight: 12 },
    { pattern: /\bmaths\b/i, weight: 12 },
    { pattern: /alg[eè]bre/i, weight: 10 },
    { pattern: /g[eé]om[eé]trie/i, weight: 10 },
    { pattern: /[eé]quation/i, weight: 8 },
    { pattern: /formule/i, weight: 7 },
    { pattern: /calcul/i, weight: 6 },
    { pattern: /fraction/i, weight: 8 },
    { pattern: /th[eé]or[eè]me/i, weight: 9 },
    { pattern: /pythagore/i, weight: 12 },
    { pattern: /d[eé]riv[eé]e/i, weight: 10 },
    { pattern: /int[eé]grale/i, weight: 10 },
    { pattern: /\bx\s*[=+\-]/i, weight: 8 },
    { pattern: /\d+\s*[+\-×÷*/=]\s*\d+/i, weight: 6 },
  ],
  history: [
    { pattern: /\bhistoire\b/i, weight: 14 },
    { pattern: /histor/i, weight: 8 },
    { pattern: /si[eè]cle/i, weight: 7 },
    { pattern: /guerre/i, weight: 8 },
    { pattern: /empire/i, weight: 8 },
    { pattern: /r[eé]volution/i, weight: 9 },
    { pattern: /m[eé]di[eé]val/i, weight: 10 },
    { pattern: /antiquit[eé]/i, weight: 10 },
    { pattern: /romain/i, weight: 9 },
    { pattern: /\brome\b/i, weight: 9 },
    { pattern: /napol[eé]on/i, weight: 10 },
    { pattern: /colonie/i, weight: 7 },
    { pattern: /monarchie/i, weight: 8 },
  ],
  science: [
    { pattern: /\bscience/i, weight: 10 },
    { pattern: /biolog/i, weight: 12 },
    { pattern: /chimie/i, weight: 12 },
    { pattern: /cellule/i, weight: 10 },
    { pattern: /\badn\b/i, weight: 12 },
    { pattern: /mol[eé]cule/i, weight: 10 },
    { pattern: /organisme/i, weight: 9 },
    { pattern: /photosynth/i, weight: 12 },
    { pattern: /[eé]cosyst/i, weight: 10 },
    { pattern: /g[eé]n[eé]tique/i, weight: 11 },
  ],
  physics: [
    { pattern: /\bphysique\b/i, weight: 16 },
    { pattern: /\bnewton\b/i, weight: 14 },
    { pattern: /m[eé]canique/i, weight: 12 },
    { pattern: /optique/i, weight: 11 },
    { pattern: /thermodynam/i, weight: 12 },
    { pattern: /acc[eé]l[eé]ration/i, weight: 10 },
    { pattern: /grav[it[eé]]/i, weight: 10 },
    { pattern: /[eé]lectricit[eé]/i, weight: 10 },
    { pattern: /magn[eé]t/i, weight: 9 },
    { pattern: /\batome\b/i, weight: 9 },
    { pattern: /plan[eè]te/i, weight: 8 },
    { pattern: /solaire/i, weight: 8 },
    { pattern: /\bunivers\b/i, weight: 7 },
    { pattern: /\bforce\b(?!\s+(de la|du|juridique|l[eé]gale|obligatoire))/i, weight: 5 },
    { pattern: /\b[vV]itesse\b/i, weight: 7 },
    { pattern: /\b[jJ]oule\b/i, weight: 10 },
    { pattern: /\bwatt\b/i, weight: 10 },
  ],
  geography: [
    { pattern: /g[eé]ograph/i, weight: 14 },
    { pattern: /capitale/i, weight: 9 },
    { pattern: /continent/i, weight: 10 },
    { pattern: /climat/i, weight: 8 },
    { pattern: /population/i, weight: 6 },
    { pattern: /relief/i, weight: 8 },
    { pattern: /fleuve/i, weight: 9 },
    { pattern: /montagne/i, weight: 8 },
  ],
  literature: [
    { pattern: /litt[eé]rature/i, weight: 14 },
    { pattern: /po[eè]me/i, weight: 10 },
    { pattern: /roman\b/i, weight: 9 },
    { pattern: /auteur/i, weight: 8 },
    { pattern: /[eé]crivain/i, weight: 9 },
    { pattern: /th[eé][aâ]tre/i, weight: 10 },
    { pattern: /m[eé]taphore/i, weight: 10 },
  ],
  languages: [
    { pattern: /\bvocab/i, weight: 8 },
    { pattern: /traduction/i, weight: 9 },
    { pattern: /verbe\b/i, weight: 8 },
    { pattern: /conjugaison/i, weight: 10 },
    { pattern: /grammaire/i, weight: 10 },
    { pattern: /\bn[eé]erlandais\b/i, weight: 10 },
    { pattern: /\banglais\b/i, weight: 10 },
    { pattern: /\bespagnol\b/i, weight: 10 },
    { pattern: /\ballemand\b/i, weight: 10 },
    { pattern: /\bfran[cç]ais\b/i, weight: 8 },
  ],
};

const SUBJECT_LABELS: Record<Locale, Record<HistorySubject, string>> = {
  fr: {
    math: 'Mathématiques',
    history: 'Histoire',
    science: 'Sciences',
    physics: 'Physique',
    geography: 'Géographie',
    literature: 'Littérature',
    languages: 'Langues',
    law: 'Droit',
    economics: 'Économie',
    general: 'Révision',
  },
  en: {
    math: 'Mathematics',
    history: 'History',
    science: 'Science',
    physics: 'Physics',
    geography: 'Geography',
    literature: 'Literature',
    languages: 'Languages',
    law: 'Law',
    economics: 'Economics',
    general: 'Review',
  },
  nl: {
    math: 'Wiskunde',
    history: 'Geschiedenis',
    science: 'Wetenschappen',
    physics: 'Natuurkunde',
    geography: 'Aardrijkskunde',
    literature: 'Literatuur',
    languages: 'Talen',
    law: 'Recht',
    economics: 'Economie',
    general: 'Herhaling',
  },
  es: {
    math: 'Matemáticas',
    history: 'Historia',
    science: 'Ciencias',
    physics: 'Física',
    geography: 'Geografía',
    literature: 'Literatura',
    languages: 'Idiomas',
    law: 'Derecho',
    economics: 'Economía',
    general: 'Repaso',
  },
};

function corpusFromPairs(pairs: WordPair[]): string {
  return pairs
    .slice(0, 32)
    .map((p) => `${p.term} ${p.definition}`)
    .join(' ')
    .slice(0, 5000);
}

function scoreSubject(text: string, subject: Exclude<HistorySubject, 'general'>): number {
  return SUBJECT_KEYWORDS[subject].reduce(
    (sum, rule) => sum + (rule.pattern.test(text) ? rule.weight : 0),
    0,
  );
}

function subjectFromSheetType(sheetType?: SheetType): HistorySubject | null {
  if (sheetType === 'math') return 'math';
  if (sheetType === 'vocab') return 'languages';
  return null;
}

function extractTopicHint(text: string, pairs: WordPair[]): string | null {
  const chapter = text.match(
    /(?:chapitre|chapter|unit[eé]|le[cç]on|lesson|module|partie)\s*[#:]?\s*(\d+|[IVXLC]+)/i,
  );
  if (chapter) {
    const label = chapter[0].replace(/\s+/g, ' ').trim();
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const theme = text.match(
    /(?:th[eè]me|theme|sujet|topic)\s*[:\-–]\s*([A-Za-zÀ-ÿ0-9\s'’-]{3,40})/i,
  );
  if (theme?.[1]) return theme[1].trim();

  const first = pairs.find((p) => p.term.trim().length >= 4 && p.term.trim().length <= 36);
  if (first) return first.term.trim();

  return null;
}

export function detectHistorySubject(pairs: WordPair[], sheetType?: SheetType): HistorySubject {
  const fromSheet = subjectFromSheetType(sheetType);
  if (fromSheet) return fromSheet;

  const text = corpusFromPairs(pairs);
  if (!text.trim()) return 'general';

  let best: HistorySubject = 'general';
  let bestScore = 0;

  for (const subject of Object.keys(SUBJECT_KEYWORDS) as Exclude<HistorySubject, 'general'>[]) {
    const score = scoreSubject(text, subject);
    if (score > bestScore) {
      bestScore = score;
      best = subject;
    }
  }

  if (bestScore === 0 && sheetType === 'notes') return 'general';
  if (bestScore === 0 && sheetType === 'definitions') return 'general';
  return bestScore > 0 ? best : sheetType === 'vocab' ? 'languages' : 'general';
}

export function getHistorySubjectLabel(subject: HistorySubject, locale: Locale = getLocale()): string {
  return SUBJECT_LABELS[locale]?.[subject] ?? SUBJECT_LABELS.fr[subject];
}

export function buildHistoryTitle(
  pairs: WordPair[],
  subject: HistorySubject,
  sheetType?: SheetType,
  locale: Locale = getLocale(),
): string {
  const label = getHistorySubjectLabel(subject, locale);
  const text = corpusFromPairs(pairs);
  const topic = extractTopicHint(text, pairs);

  if (topic && !topic.toLowerCase().includes(label.toLowerCase())) {
    return `${label} – ${topic}`;
  }

  if (sheetType === 'vocab' && subject === 'languages') {
    const count = pairs.length;
    const words =
      locale === 'en'
        ? 'words'
        : locale === 'nl'
          ? 'woorden'
          : locale === 'es'
            ? 'palabras'
            : 'mots';
    return `${label} (${count} ${words})`;
  }

  if (topic) return `${label} – ${topic}`;
  return label;
}

export function resolveHistoryEntryMeta(
  entry: { pairs: WordPair[]; sheetType?: SheetType; subject?: HistorySubject; title?: string },
  locale: Locale = getLocale(),
): { subject: HistorySubject; title: string } {
  const subject = detectHistorySubject(entry.pairs, entry.sheetType);
  const title = buildHistoryTitle(entry.pairs, subject, entry.sheetType, locale);
  return { subject, title };
}
