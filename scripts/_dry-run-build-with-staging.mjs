/**
 * Dry-run: lesson counts from raw only vs raw + staging (money),
 * without writing englishCurriculum.ts.
 * Staging themes are wired only in this script (not in production builder).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

function parseVocab(text, { allowDraft = false } = {}) {
  const items = [];
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length < 8) continue;
    let [en, fr, nl, es, ar, sentence, cefr, theme] = parts;
    if (!en || !sentence || !CEFR.includes(cefr)) continue;
    if (!allowDraft && (!fr || fr.startsWith('†'))) continue;
    if (allowDraft) {
      fr = fr.replace(/^\†/, '') || en;
      nl = nl.replace(/^\†/, '') || en;
      es = es.replace(/^\†/, '') || en;
      ar = ar.replace(/^\†/, '') || en;
    }
    const key = en.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ en, fr, nl, es, ar, sentence, cefr, theme });
  }
  return items;
}

const CHAPTER_PLANS_BASE = {
  travel: [
    { id: 'greet', themes: ['greetings', 'people', 'core'] },
    { id: 'airport', themes: ['airport', 'travel', 'basics', 'time'] },
    { id: 'hotel', themes: ['hotel', 'travel', 'daily'] },
    { id: 'city', themes: ['directions', 'travel', 'help'] },
    { id: 'food', themes: ['food', 'daily', 'shopping'] },
    { id: 'help', themes: ['help', 'travel', 'opinions'] },
  ],
  work: [
    { id: 'greet', themes: ['greetings', 'people', 'core'] },
    { id: 'office', themes: ['work', 'daily', 'core'] },
    { id: 'meet', themes: ['work', 'opinions'] },
    { id: 'email', themes: ['work', 'core'] },
    { id: 'career', themes: ['work', 'advanced', 'opinions'] },
    { id: 'travelwork', themes: ['travel', 'airport', 'hotel', 'food'] },
  ],
  school: [
    { id: 'greet', themes: ['greetings', 'people', 'core'] },
    { id: 'class', themes: ['school', 'basics', 'daily'] },
    { id: 'study', themes: ['school', 'core', 'opinions'] },
    { id: 'exam', themes: ['exam', 'school'] },
    { id: 'academic', themes: ['exam', 'advanced', 'opinions'] },
    { id: 'life', themes: ['fun', 'food', 'directions', 'help'] },
  ],
  exam: [
    { id: 'core', themes: ['core', 'greetings', 'basics'] },
    { id: 'instructions', themes: ['exam', 'school'] },
    { id: 'reading', themes: ['opinions', 'exam', 'advanced'] },
    { id: 'writing', themes: ['exam', 'opinions', 'advanced'] },
    { id: 'oral', themes: ['opinions', 'core', 'people'] },
    { id: 'precision', themes: ['advanced', 'exam', 'work'] },
  ],
  fun: [
    { id: 'greet', themes: ['greetings', 'people', 'core'] },
    { id: 'daily', themes: ['daily', 'time', 'basics'] },
    { id: 'hobbies', themes: ['fun', 'core'] },
    { id: 'social', themes: ['fun', 'food', 'opinions'] },
    { id: 'city', themes: ['directions', 'shopping', 'travel'] },
    { id: 'stories', themes: ['opinions', 'advanced', 'fun'] },
  ],
  other: [
    { id: 'greet', themes: ['greetings', 'people', 'core'] },
    { id: 'basics', themes: ['basics', 'daily', 'time'] },
    { id: 'city', themes: ['directions', 'food', 'shopping'] },
    { id: 'travel', themes: ['airport', 'hotel', 'travel', 'help'] },
    { id: 'worklite', themes: ['work', 'core', 'opinions'] },
    { id: 'grow', themes: ['school', 'exam', 'advanced', 'opinions'] },
  ],
};

/** Staging-only wiring: money → travel food + other city (no off-topic fill). */
function plansWithMoney() {
  const plans = structuredClone(CHAPTER_PLANS_BASE);
  plans.travel.find((c) => c.id === 'food').themes = ['food', 'daily', 'shopping', 'money'];
  plans.other.find((c) => c.id === 'city').themes = ['directions', 'food', 'shopping', 'money'];
  return plans;
}

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
    if (fresh.length === 0) break;
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
    while (items.length < Math.min(SIZE, pool.length) && cursor < pool.length) {
      const next = pool[cursor++];
      if (!items.some((x) => x.en === next.en)) {
        items.push(next);
        if (!introduced.some((x) => x.en === next.en)) introduced.push(next);
      } else break;
    }
    if (items.length < 4) break;
    const levelHint = items.reduce(
      (acc, it) => (LEVEL_ORDER[it.cefr] > LEVEL_ORDER[acc] ? it.cefr : acc),
      'A1',
    );
    const level =
      CEFR[Math.min(LEVEL_ORDER[startLevel] + Math.floor(chapterIndex / 2), LEVEL_ORDER[levelHint], 5)];
    lessons.push({ level, chapterId: `${goal}-${chapter.id}` });
  }
  return lessons;
}

function countLessons(all, plans) {
  const out = {};
  for (const [goal, chapters] of Object.entries(plans)) {
    out[goal] = { total: 0, chapters: {} };
    chapters.forEach((ch, idx) => {
      const startLevel = idx < 2 ? 'A1' : idx < 4 ? 'A2' : 'B1';
      const maxCefr = idx >= 5 ? 'C2' : idx >= 4 ? 'C1' : idx >= 3 ? 'B2' : 'B1';
      const pool = pickPool(all, ch.themes, maxCefr);
      const sorted = [...pool].sort(
        (a, b) => LEVEL_ORDER[a.cefr] - LEVEL_ORDER[b.cefr] || a.en.localeCompare(b.en),
      );
      const lessons = buildLessonsForChapter(goal, ch, idx, sorted, startLevel);
      out[goal].chapters[ch.id] = lessons.length;
      out[goal].total += lessons.length;
    });
  }
  return out;
}

const raw = parseVocab(fs.readFileSync(path.join(__dirname, 'english-vocab-raw.txt'), 'utf8'));
const staging = parseVocab(fs.readFileSync(path.join(__dirname, 'english-vocab-staging.txt'), 'utf8'), {
  allowDraft: true,
});
const merged = [...raw];
const seen = new Set(raw.map((v) => v.en.toLowerCase()));
for (const s of staging) {
  if (seen.has(s.en.toLowerCase())) continue;
  seen.add(s.en.toLowerCase());
  merged.push(s);
}

const before = countLessons(raw, CHAPTER_PLANS_BASE);
const after = countLessons(merged, plansWithMoney());

function print(label, counts) {
  console.log(`\n=== ${label} ===`);
  let grand = 0;
  for (const [goal, data] of Object.entries(counts)) {
    grand += data.total;
    console.log(goal, 'total', data.total, JSON.stringify(data.chapters));
  }
  console.log('GRAND', grand);
}

print('BEFORE (raw only, production chapter themes)', before);
print('AFTER dry-run (raw + money staging, money wired into travel/food + other/city)', after);
console.log('\nStaging entries used:', staging.length);
console.log('Merged vocab size:', merged.length, '(raw', raw.length + ')');
