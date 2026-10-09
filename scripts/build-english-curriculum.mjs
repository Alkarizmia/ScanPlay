/**
 * Builds src/lib/englishCurriculum.ts from english-vocab-raw.txt
 * Chapters (~25–35 lessons) themed by goal; lessons recycle words + add new ones.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(__dirname, 'english-vocab-raw.txt');
const outPath = path.join(__dirname, '..', 'src', 'lib', 'englishCurriculum.ts');

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_RANK = Object.fromEntries(CEFR.map((l, i) => [l, i]));

/** @typedef {{ en: string, fr: string, nl: string, es: string, ar: string, sentence: string, cefr: string, theme: string }} Vocab */

function parseRaw(text) {
  /** @type {Vocab[]} */
  const items = [];
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('|');
    if (parts.length < 8) {
      console.warn('skip bad line:', trimmed.slice(0, 80));
      continue;
    }
    const [en, fr, nl, es, ar, sentence, cefr, theme] = parts.map((p) => p.trim());
    if (!en || !fr || !sentence || !CEFR.includes(cefr)) {
      console.warn('skip invalid:', en);
      continue;
    }
    const key = en.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ en, fr, nl, es, ar, sentence, cefr, theme });
  }
  return items;
}

const CHAPTER_PLANS = {
  travel: [
    { id: 'greet', themes: ['greetings', 'people', 'core'], title: { fr: 'Se présenter', en: 'Introductions', nl: 'Voorstellen', es: 'Presentarse', ar: 'تقديم النفس' } },
    { id: 'airport', themes: ['airport', 'travel', 'basics', 'time'], title: { fr: 'Aéroport & voyage', en: 'Airport & travel', nl: 'Luchthaven & reizen', es: 'Aeropuerto y viaje', ar: 'المطار والسفر' } },
    { id: 'hotel', themes: ['hotel', 'travel', 'daily'], title: { fr: 'Hôtel & séjour', en: 'Hotel stay', nl: 'Hotelverblijf', es: 'Hotel y estancia', ar: 'الفندق والإقامة' } },
    { id: 'city', themes: ['directions', 'travel', 'help'], title: { fr: 'Se déplacer', en: 'Getting around', nl: 'Je verplaatsen', es: 'Moverse por la ciudad', ar: 'التنقل في المدينة' } },
    { id: 'food', themes: ['food', 'daily', 'shopping'], title: { fr: 'Restaurant & courses', en: 'Food & shopping', nl: 'Eten & winkelen', es: 'Comida y compras', ar: 'الطعام والتسوق' } },
    { id: 'help', themes: ['help', 'travel', 'opinions'], title: { fr: 'Aide & situations', en: 'Help & situations', nl: 'Hulp & situaties', es: 'Ayuda y situaciones', ar: 'المساعدة والمواقف' } },
  ],
  work: [
    { id: 'greet', themes: ['greetings', 'people', 'core'], title: { fr: 'Se présenter au travail', en: 'Workplace intros', nl: 'Voorstellen op werk', es: 'Presentarse en el trabajo', ar: 'تقديم النفس في العمل' } },
    { id: 'office', themes: ['work', 'daily', 'core'], title: { fr: 'Bureau au quotidien', en: 'Office daily', nl: 'Kantoor dagelijks', es: 'Oficina diaria', ar: 'المكتب يوميا' } },
    { id: 'meet', themes: ['work', 'opinions'], title: { fr: 'Réunions & feedback', en: 'Meetings & feedback', nl: 'Vergaderingen & feedback', es: 'Reuniones y feedback', ar: 'الاجتماعات والملاحظات' } },
    { id: 'email', themes: ['work', 'core'], title: { fr: 'Emails & organisation', en: 'Email & organisation', nl: 'E-mail & organisatie', es: 'Correo y organización', ar: 'البريد والتنظيم' } },
    { id: 'career', themes: ['work', 'advanced', 'opinions'], title: { fr: 'Carrière & projets', en: 'Career & projects', nl: 'Carrière & projecten', es: 'Carrera y proyectos', ar: 'المهنة والمشاريع' } },
    { id: 'travelwork', themes: ['travel', 'airport', 'hotel', 'food'], title: { fr: 'Déplacements pro', en: 'Business travel', nl: 'Zakenreizen', es: 'Viajes de trabajo', ar: 'سفر العمل' } },
  ],
  school: [
    { id: 'greet', themes: ['greetings', 'people', 'core'], title: { fr: 'Se présenter à l’école', en: 'School intros', nl: 'Voorstellen op school', es: 'Presentarse en clase', ar: 'تقديم النفس في المدرسة' } },
    { id: 'class', themes: ['school', 'basics', 'daily'], title: { fr: 'En classe', en: 'In class', nl: 'In de klas', es: 'En clase', ar: 'في الصف' } },
    { id: 'study', themes: ['school', 'core', 'opinions'], title: { fr: 'Étudier efficacement', en: 'Study skills', nl: 'Studievaardigheden', es: 'Estudiar mejor', ar: 'مهارات الدراسة' } },
    { id: 'exam', themes: ['exam', 'school'], title: { fr: 'Examens & devoirs', en: 'Exams & assignments', nl: 'Examens & opdrachten', es: 'Exámenes y tareas', ar: 'الامتحانات والواجبات' } },
    { id: 'academic', themes: ['exam', 'advanced', 'opinions'], title: { fr: 'Écrit académique', en: 'Academic writing', nl: 'Academisch schrijven', es: 'Escritura académica', ar: 'الكتابة الأكاديمية' } },
    { id: 'life', themes: ['fun', 'food', 'directions', 'help'], title: { fr: 'Vie étudiante', en: 'Student life', nl: 'Studentenleven', es: 'Vida estudiantil', ar: 'حياة الطالب' } },
  ],
  exam: [
    { id: 'core', themes: ['core', 'greetings', 'basics'], title: { fr: 'Bases solides', en: 'Solid basics', nl: 'Stevige basis', es: 'Bases sólidas', ar: 'أساسيات متينة' } },
    { id: 'instructions', themes: ['exam', 'school'], title: { fr: 'Consignes d’examen', en: 'Exam instructions', nl: 'Exameninstructies', es: 'Instrucciones de examen', ar: 'تعليمات الامتحان' } },
    { id: 'reading', themes: ['opinions', 'exam', 'advanced'], title: { fr: 'Compréhension & liens', en: 'Reading & links', nl: 'Begrip & verbanden', es: 'Comprensión y enlaces', ar: 'الفهم والروابط' } },
    { id: 'writing', themes: ['exam', 'opinions', 'advanced'], title: { fr: 'Rédaction utile', en: 'Useful writing', nl: 'Nuttig schrijven', es: 'Escritura útil', ar: 'كتابة مفيدة' } },
    { id: 'oral', themes: ['opinions', 'core', 'people'], title: { fr: 'Oral & opinions', en: 'Speaking & opinions', nl: 'Spreken & meningen', es: 'Oral y opiniones', ar: 'الشفوي والآراء' } },
    { id: 'precision', themes: ['advanced', 'exam', 'work'], title: { fr: 'Précision avancée', en: 'Advanced precision', nl: 'Gevorderde precisie', es: 'Precisión avanzada', ar: 'دقة متقدمة' } },
  ],
  fun: [
    { id: 'greet', themes: ['greetings', 'people', 'core'], title: { fr: 'Se présenter', en: 'Introductions', nl: 'Voorstellen', es: 'Presentarse', ar: 'تقديم النفس' } },
    { id: 'daily', themes: ['daily', 'time', 'basics'], title: { fr: 'Quotidien', en: 'Daily life', nl: 'Dagelijks leven', es: 'Vida diaria', ar: 'الحياة اليومية' } },
    { id: 'hobbies', themes: ['fun', 'core'], title: { fr: 'Loisirs', en: 'Hobbies', nl: 'Hobby’s', es: 'Aficiones', ar: 'الهوايات' } },
    { id: 'social', themes: ['fun', 'food', 'opinions'], title: { fr: 'Sorties & avis', en: 'Going out & opinions', nl: 'Uitgaan & meningen', es: 'Salidas y opiniones', ar: 'الخروج والآراء' } },
    { id: 'city', themes: ['directions', 'shopping', 'travel'], title: { fr: 'En ville', en: 'Around town', nl: 'In de stad', es: 'Por la ciudad', ar: 'في المدينة' } },
    { id: 'stories', themes: ['opinions', 'advanced', 'fun'], title: { fr: 'Histoires & nuances', en: 'Stories & nuance', nl: 'Verhalen & nuances', es: 'Historias y matices', ar: 'القصص والفروق' } },
  ],
  other: [
    { id: 'greet', themes: ['greetings', 'people', 'core'], title: { fr: 'Se présenter', en: 'Introductions', nl: 'Voorstellen', es: 'Presentarse', ar: 'تقديم النفس' } },
    { id: 'basics', themes: ['basics', 'daily', 'time'], title: { fr: 'Bases utiles', en: 'Useful basics', nl: 'Nuttige basis', es: 'Básicos útiles', ar: 'أساسيات مفيدة' } },
    { id: 'city', themes: ['directions', 'food', 'shopping'], title: { fr: 'Vie en ville', en: 'City life', nl: 'Stadsleven', es: 'Vida en la ciudad', ar: 'الحياة في المدينة' } },
    { id: 'travel', themes: ['airport', 'hotel', 'travel', 'help'], title: { fr: 'Voyage pratique', en: 'Practical travel', nl: 'Praktisch reizen', es: 'Viaje práctico', ar: 'سفر عملي' } },
    { id: 'worklite', themes: ['work', 'core', 'opinions'], title: { fr: 'Travail & échanges', en: 'Work & exchange', nl: 'Werk & uitwisseling', es: 'Trabajo e intercambio', ar: 'العمل والتبادل' } },
    { id: 'grow', themes: ['school', 'exam', 'advanced', 'opinions'], title: { fr: 'Progresser', en: 'Keep growing', nl: 'Blijven groeien', es: 'Seguir creciendo', ar: 'الاستمرار في التقدم' } },
  ],
};

const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

/** Themed pool only — never pad with off-topic vocab when the theme is thin. */
function pickPool(all, themes, maxCefr) {
  const max = LEVEL_ORDER[maxCefr] ?? 5;
  return all.filter((v) => themes.includes(v.theme) && LEVEL_ORDER[v.cefr] <= max);
}

function buildLessonsForChapter(goal, chapter, chapterIndex, pool, startLevel) {
  const LESSONS = 28;
  const NEW_PER = 4;
  const SIZE = 7;
  const lessons = [];
  let cursor = 0;
  /** @type {Vocab[]} */
  const introduced = [];

  for (let i = 0; i < LESSONS; i += 1) {
    const fresh = [];
    while (fresh.length < NEW_PER && cursor < pool.length) {
      const next = pool[cursor++];
      if (!introduced.some((x) => x.en === next.en)) {
        fresh.push(next);
        introduced.push(next);
      }
    }
    // Stop when the themed pool has no new words left (shorter chapters OK).
    if (fresh.length === 0) break;

    // recycle earlier words (spaced)
    const review = [];
    if (introduced.length > fresh.length) {
      const older = introduced.slice(0, Math.max(0, introduced.length - fresh.length));
      for (let r = 0; r < SIZE - fresh.length; r += 1) {
        const idx = Math.max(0, older.length - 1 - ((i * 3 + r * 5) % Math.max(older.length, 1)));
        const item = older[idx];
        if (item && !fresh.some((f) => f.en === item.en) && !review.some((f) => f.en === item.en)) {
          review.push(item);
        }
      }
    }
    let items = [...fresh, ...review].slice(0, SIZE);
    // pad from remaining themed pool only
    while (items.length < Math.min(SIZE, pool.length) && cursor < pool.length) {
      const next = pool[cursor++];
      if (!items.some((x) => x.en === next.en)) {
        items.push(next);
        if (!introduced.some((x) => x.en === next.en)) introduced.push(next);
      } else break;
    }
    if (items.length < 4) break;

    const levelHint = items.reduce((acc, it) => (LEVEL_ORDER[it.cefr] > LEVEL_ORDER[acc] ? it.cefr : acc), 'A1');
    const level = CEFR[Math.min(LEVEL_ORDER[startLevel] + Math.floor(chapterIndex / 2), LEVEL_ORDER[levelHint], 5)];

    lessons.push({
      id: `${goal}-${chapter.id}-l${String(i + 1).padStart(2, '0')}`,
      level,
      unit: chapterIndex + 1,
      chapterId: `${goal}-${chapter.id}`,
      chapterTitle: chapter.title,
      goal,
      title: {
        fr: `${chapter.title.fr} · ${i + 1}`,
        en: `${chapter.title.en} · ${i + 1}`,
        nl: `${chapter.title.nl} · ${i + 1}`,
        es: `${chapter.title.es} · ${i + 1}`,
        ar: `${chapter.title.ar} · ${i + 1}`,
      },
      items: items.map((v) => ({
        en: v.en,
        fr: v.fr,
        nl: v.nl,
        es: v.es,
        ar: v.ar,
        sentence: v.sentence,
      })),
    });
  }
  return lessons;
}

function buildAllLessons(all) {
  /** @type {any[]} */
  const lessons = [];
  for (const [goal, chapters] of Object.entries(CHAPTER_PLANS)) {
    chapters.forEach((ch, idx) => {
      const startLevel = idx < 2 ? 'A1' : idx < 4 ? 'A2' : 'B1';
      const pool = pickPool(all, ch.themes, idx >= 5 ? 'C2' : idx >= 4 ? 'C1' : idx >= 3 ? 'B2' : 'B1');
      // shuffle lightly but stable by theme order already
      const sorted = [...pool].sort((a, b) => LEVEL_ORDER[a.cefr] - LEVEL_ORDER[b.cefr] || a.en.localeCompare(b.en));
      lessons.push(...buildLessonsForChapter(goal, ch, idx, sorted, startLevel));
    });
  }
  return lessons;
}

function buildPlacement(all) {
  const byLevel = (lv) => all.filter((v) => v.cefr === lv);
  const pick = (arr, n) => arr.slice(0, n);
  const distractors = (correct, pool) => {
    const wrongs = pool.filter((x) => x.en !== correct.en).slice(0, 12);
    const choices = [correct, ...wrongs.slice(0, 3)];
    // shuffle deterministically
    for (let i = choices.length - 1; i > 0; i -= 1) {
      const j = (i * 7 + correct.en.length) % (i + 1);
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      en: correct.en,
      sentence: correct.sentence,
      choices: choices.map((c) => ({ fr: c.fr, nl: c.nl, es: c.es, ar: c.ar })),
      correct: choices.findIndex((c) => c.en === correct.en),
      levelHint: correct.cefr,
    };
  };

  const items = [];
  const plan = [
    ['A1', 3],
    ['A2', 4],
    ['B1', 5],
    ['B2', 5],
    ['C1', 4],
    ['C2', 3],
  ];
  for (const [lv, count] of plan) {
    const pool = byLevel(lv);
    const selected = pick(pool.sort((a, b) => b.en.length - a.en.length), count);
    const distractorPool = all.filter((v) => Math.abs(LEVEL_ORDER[v.cefr] - LEVEL_ORDER[lv]) <= 1);
    for (const s of selected) {
      items.push(distractors(s, distractorPool.length >= 8 ? distractorPool : all));
    }
  }
  return items;
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function emitVocabItem(v) {
  return `{ en: '${esc(v.en)}', fr: '${esc(v.fr)}', nl: '${esc(v.nl)}', es: '${esc(v.es)}', ar: '${esc(v.ar)}', sentence: '${esc(v.sentence)}' }`;
}

function emitLesson(l) {
  const title = `{ fr: '${esc(l.title.fr)}', en: '${esc(l.title.en)}', nl: '${esc(l.title.nl)}', es: '${esc(l.title.es)}', ar: '${esc(l.title.ar)}' }`;
  const ch = `{ fr: '${esc(l.chapterTitle.fr)}', en: '${esc(l.chapterTitle.en)}', nl: '${esc(l.chapterTitle.nl)}', es: '${esc(l.chapterTitle.es)}', ar: '${esc(l.chapterTitle.ar)}' }`;
  const items = l.items.map(emitVocabItem).join(',\n      ');
  return `  {
    id: '${l.id}',
    level: '${l.level}',
    unit: ${l.unit},
    chapterId: '${l.chapterId}',
    chapterTitle: ${ch},
    goal: '${l.goal}',
    title: ${title},
    items: [
      ${items},
    ],
  }`;
}

function emitPlacement(p) {
  const choices = p.choices
    .map((c) => `{ fr: '${esc(c.fr)}', nl: '${esc(c.nl)}', es: '${esc(c.es)}', ar: '${esc(c.ar)}' }`)
    .join(', ');
  return `  {
    en: '${esc(p.en)}',
    sentence: '${esc(p.sentence)}',
    choices: [${choices}],
    correct: ${p.correct},
    levelHint: '${p.levelHint}',
  }`;
}

const raw = fs.readFileSync(rawPath, 'utf8');
const vocab = parseRaw(raw);
console.log('Unique vocab entries:', vocab.length);
if (vocab.length < 500) {
  console.error('Need at least 500 unique entries, got', vocab.length);
  process.exit(1);
}

const lessons = buildAllLessons(vocab);
const placement = buildPlacement(vocab);
console.log('Lessons:', lessons.length);
console.log('Placement items:', placement.length);

const ts = `/** Pix Univers — Learn English curriculum (generated). Do not edit by hand; edit scripts/english-vocab-raw.txt then run scripts/build-english-curriculum.mjs */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type EnglishGoal = 'travel' | 'work' | 'school' | 'exam' | 'fun' | 'other';
export type EnglishNativeLang = 'fr' | 'nl' | 'es' | 'ar';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface EnglishVocabItem {
  en: string;
  fr: string;
  nl: string;
  es: string;
  ar: string;
  /** Natural English sentence using the word/phrase. */
  sentence: string;
}

export interface EnglishLessonDef {
  id: string;
  level: CefrLevel;
  unit: number;
  chapterId: string;
  chapterTitle: { fr: string; en: string; nl: string; es: string; ar: string };
  goal: EnglishGoal;
  title: { fr: string; en: string; nl: string; es: string; ar: string };
  items: EnglishVocabItem[];
}

export const ENGLISH_VOCAB_COUNT = ${vocab.length};

export const ENGLISH_LESSONS: EnglishLessonDef[] = [
${lessons.map(emitLesson).join(',\n')}
];

export interface PlacementItem {
  en: string;
  sentence: string;
  choices: { fr: string; nl: string; es: string; ar: string }[];
  correct: number;
  levelHint: CefrLevel;
}

export const PLACEMENT_ITEMS: PlacementItem[] = [
${placement.map(emitPlacement).join(',\n')}
];

export function listChaptersForGoal(goal: EnglishGoal): { id: string; title: EnglishLessonDef['chapterTitle']; lessonIds: string[] }[] {
  const map = new Map<string, { id: string; title: EnglishLessonDef['chapterTitle']; lessonIds: string[] }>();
  for (const lesson of ENGLISH_LESSONS) {
    if (lesson.goal !== goal) continue;
    const cur = map.get(lesson.chapterId);
    if (cur) cur.lessonIds.push(lesson.id);
    else map.set(lesson.chapterId, { id: lesson.chapterId, title: lesson.chapterTitle, lessonIds: [lesson.id] });
  }
  return [...map.values()];
}

export function lessonsForGoal(goal: EnglishGoal): EnglishLessonDef[] {
  return ENGLISH_LESSONS.filter((l) => l.goal === goal);
}
`;

fs.writeFileSync(outPath, ts, 'utf8');
console.log('Wrote', outPath);
