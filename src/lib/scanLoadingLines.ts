import { t } from './i18n';
import type { Locale } from '../types';

export type ScanTalkPhase = 'tips' | 'demo';

const OFFSET_KEY = 'scanplay-pix-talk-v1';

/**
 * Short rotating tips shown while a scan runs.
 * Keep 8–10 lines; prefer study advice and product anecdotes.
 * Avoid invented precise statistics (no "73% of students…").
 */
const TIPS: Record<Locale, readonly string[]> = {
  fr: [
    'Se tester vaut mieux que relire passivement.',
    'Espacer tes révisions aide à mieux retenir.',
    'Corriger une erreur tout de suite ancre mieux le souvenir.',
    'Pix a commencé comme un prototype pour scanner des fiches de vocabulaire.',
    'Les mini-jeux naissent du texte de ta fiche, pas d’une banque générique.',
    'Relire en boucle donne souvent une fausse impression de maîtrise.',
    'Des sessions courtes et régulières battent un long marathon.',
    'Dire le mot à voix haute active une autre mémoire que la lecture seule.',
    'Associer un mot à son sens renforce le lien en mémoire.',
    'Tu pourras corriger les cartes avant de lancer le parcours.',
  ],
  en: [
    'Testing yourself beats passive rereading.',
    'Spacing your reviews helps memories stick.',
    'Fixing a mistake right away locks it in better.',
    'Pix started as a prototype to scan vocabulary sheets.',
    'Mini-games come from your sheet text, not a generic bank.',
    'Rereading on loop often creates a false sense of mastery.',
    'Short, regular sessions beat one long marathon.',
    'Saying a word out loud engages another kind of memory.',
    'Linking a word to its meaning strengthens the memory bond.',
    'You can edit the cards before you start the path.',
  ],
  nl: [
    'Jezelf testen werkt beter dan passief herlezen.',
    'Gespreide herhaling helpt je beter onthouden.',
    'Een fout meteen verbeteren zet het beter vast.',
    'Pix begon als prototype om vocabulairebladen te scannen.',
    'Mini-games komen uit jouw tekst, niet uit een generieke bank.',
    'Steeds herlezen geeft vaak een vals gevoel van beheersing.',
    'Korte, regelmatige sessies winnen van één lange marathon.',
    'Hardop zeggen activeert een ander soort geheugen.',
    'Woord en betekenis koppelen versterkt de geheugenband.',
    'Je kunt de kaarten nog corrigeren vóór het pad.',
  ],
  es: [
    'Autoevaluarte vale más que releer sin más.',
    'Espaciar los repasos ayuda a retener mejor.',
    'Corregir un error al momento fija mejor el recuerdo.',
    'Pix empezó como prototipo para escanear fichas de vocabulario.',
    'Los minijuegos nacen del texto de tu ficha, no de un banco genérico.',
    'Releer en bucle suele dar una falsa sensación de dominio.',
    'Sesiones cortas y regulares ganan a un maratón largo.',
    'Decir la palabra en voz alta activa otra memoria.',
    'Asociar palabra y sentido refuerza el vínculo en la memoria.',
    'Podrás corregir las cartas antes de lanzar el recorrido.',
  ],
  ar: [
    'اختبار نفسك أفضل من إعادة القراءة السلبية.',
    'تباعد المراجعات يساعد على التثبيت في الذاكرة.',
    'تصحيح الخطأ فورًا يثبّت الذكرى بشكل أفضل.',
    'بدأ Pix كنموذج أولي لمسح بطاقات المفردات.',
    'الألعاب الصغيرة تُبنى من نص ورقتك، لا من بنك عام.',
    'إعادة القراءة مرارًا تعطي غالبًا إحساسًا زائفًا بالإتقان.',
    'جلسات قصيرة ومنتظمة أفضل من ماراثون طويل.',
    'نطق الكلمة بصوت عالٍ ينشّط ذاكرة أخرى غير القراءة.',
    'ربط الكلمة بمعناها يقوّي الصلة في الذاكرة.',
    'يمكنك تصحيح البطاقات قبل بدء المسار.',
  ],
  de: [
    'Dich selbst testen ist besser als passives Wiederlesen.',
    'Wiederholen mit Abstand hilft beim Merken.',
    'Einen Fehler sofort korrigieren prägt ihn besser ein.',
    'Pix begann als Prototyp zum Scannen von Vokabelzetteln.',
    'Die Minispiele kommen aus dem Text deines Blattes, nicht aus einer generischen Bank.',
    'Immer wieder lesen gibt oft ein falsches Gefühl von Sicherheit.',
    'Kurze, regelmäßige Sessions schlagen einen langen Marathon.',
    'Ein Wort laut sagen aktiviert ein anderes Gedächtnis als nur Lesen.',
    'Wort und Bedeutung verknüpfen stärkt die Erinnerung.',
    'Du kannst die Karten noch korrigieren, bevor du den Pfad startest.',
  ],
};

const DEMO_LINES: Record<Locale, readonly string[]> = {
  fr: [
    'Pix prépare la démo…',
    'Un aperçu arrive…',
    'Pix installe le terrain de jeu…',
  ],
  en: [
    'Pix is setting up the demo…',
    'A preview is on the way…',
    'Pix is laying out the playground…',
  ],
  nl: [
    'Pix zet de demo klaar…',
    'Een voorproefje komt eraan…',
    'Pix bouwt het speelveld…',
  ],
  es: [
    'Pix prepara la demo…',
    'Llega un adelanto…',
    'Pix monta el terreno de juego…',
  ],
  ar: [
    'Pix يجهّز العرض…',
    'معاينة قادمة…',
    'Pix يجهّز ساحة اللعب…',
  ],
  de: [
    'Pix bereitet die Demo vor…',
    'Eine Vorschau kommt…',
    'Pix baut den Spielplatz auf…',
  ],
};

export function nextScanTalkOffset(): number {
  try {
    const n = Number(sessionStorage.getItem(OFFSET_KEY) || '0');
    const next = (Number.isFinite(n) ? n : 0) + 1 + Math.floor(Math.random() * 5);
    sessionStorage.setItem(OFFSET_KEY, String(next % 9973));
    return Number.isFinite(n) ? n : Math.floor(Math.random() * 50);
  } catch {
    return Math.floor(Math.random() * 50);
  }
}

export function scanTalkPhase(
  locale: Locale,
  pct: number,
  status: string,
): ScanTalkPhase | 'passthrough' {
  void pct;
  const demo = t('demoLoading', locale);
  const reading = t('reading', locale);
  const scanningAi = t('scanningAi', locale);
  const scanning = t('scanning', locale);
  const building = t('building', locale);

  if (status === demo) return 'demo';
  if (
    status === building ||
    status === reading ||
    status === scanningAi ||
    status === scanning
  ) {
    return 'tips';
  }
  return 'passthrough';
}

export function scanTalkLine(
  locale: Locale,
  phase: ScanTalkPhase,
  offset: number,
  tick: number,
): string {
  const pool = phase === 'demo' ? DEMO_LINES[locale] : TIPS[locale];
  const index = ((offset + tick) % pool.length + pool.length) % pool.length;
  return pool[index];
}

/** @deprecated Prefer editing TIPS / DEMO_LINES above. Kept for tests. */
export function scanTalkPools(): Record<Locale, Record<ScanTalkPhase, readonly string[]>> {
  const locales: Locale[] = ['fr', 'en', 'nl', 'es', 'ar', 'de'];
  const out = {} as Record<Locale, Record<ScanTalkPhase, readonly string[]>>;
  for (const loc of locales) {
    out[loc] = { tips: TIPS[loc], demo: DEMO_LINES[loc] };
  }
  return out;
}
