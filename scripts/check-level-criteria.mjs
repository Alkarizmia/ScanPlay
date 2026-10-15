/**
 * Local checker: mandatory structures per chapter (not wired into the generator).
 * Usage: node scripts/check-level-criteria.mjs [--fail]
 * Exit 1 if --fail and any required structure is missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const criteria = JSON.parse(fs.readFileSync(path.join(__dirname, 'level-criteria.json'), 'utf8'));
const curriculumPath = path.join(__dirname, '..', 'src', 'lib', 'englishCurriculum.ts');
const text = fs.readFileSync(curriculumPath, 'utf8');

/** Parse lessons from generated TS (read-only). */
function parseLessons(src) {
  const lessons = [];
  const blocks = src.split(/\n  \{\n    id: '/).slice(1);
  for (const block of blocks) {
    const id = block.match(/^([^']+)'/)?.[1];
    const level = block.match(/level: '([^']+)'/)?.[1];
    const chapterId = block.match(/chapterId: '([^']+)'/)?.[1];
    const goal = block.match(/goal: '([^']+)'/)?.[1];
    const titleFr = block.match(/chapterTitle: \{ fr: '([^']*(?:\\'[^']*)*)'/)?.[1]?.replace(/\\'/g, "'");
    const sentences = [...block.matchAll(/sentence: '((?:\\'|[^'])*)'/g)].map((m) =>
      m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'),
    );
    if (id && level && chapterId) {
      lessons.push({ id, level, chapterId, goal, titleFr, sentences });
    }
  }
  return lessons;
}

function countMatches(sentences, patterns) {
  let count = 0;
  const hits = [];
  for (const s of sentences) {
    for (const p of patterns) {
      // Patterns are written with intended capitals (I am, My name…). Use case-sensitive match.
      if (new RegExp(p).test(s)) {
        count += 1;
        hits.push(s);
        break;
      }
    }
  }
  return { count, hits };
}

function isGreetChapter(lesson) {
  return (
    lesson.chapterId.endsWith('-greet') ||
    /Se présenter|Bases solides/i.test(lesson.titleFr || '')
  );
}

const lessons = parseLessons(text);
/** Aggregate by chapterId + level */
const chapters = new Map();
for (const l of lessons) {
  const key = `${l.goal}|${l.chapterId}|${l.level}`;
  if (!chapters.has(key)) {
    chapters.set(key, {
      goal: l.goal,
      chapterId: l.chapterId,
      level: l.level,
      titleFr: l.titleFr,
      sentences: [],
      lessonIds: [],
    });
  }
  const ch = chapters.get(key);
  ch.sentences.push(...l.sentences);
  ch.lessonIds.push(l.id);
}

const results = [];
for (const ch of chapters.values()) {
  const checks = [];
  // greet-A1
  if (ch.level === 'A1' && isGreetChapter(ch)) {
    const spec = criteria.chapterTypes['greet-A1'];
    for (const req of spec.requiredStructures) {
      const { count, hits } = countMatches(ch.sentences, req.patterns);
      checks.push({
        type: 'greet-A1',
        id: req.id,
        label: req.label,
        min: spec.minOccurrences,
        count,
        ok: count >= spec.minOccurrences,
        sample: hits.slice(0, 2),
      });
    }
  } else if (ch.level === 'B1' && ch.chapterId.endsWith('-greet')) {
    const spec = criteria.chapterTypes['greet-B1'];
    for (const req of spec.requiredStructures) {
      const { count, hits } = countMatches(ch.sentences, req.patterns);
      checks.push({
        type: 'greet-B1',
        id: req.id,
        label: req.label,
        min: spec.minOccurrences,
        count,
        ok: count >= spec.minOccurrences,
        sample: hits.slice(0, 2),
      });
    }
  } else if (ch.level === 'A1') {
    const spec = criteria.chapterTypes['generic-A1'];
    for (const req of spec.requiredStructures) {
      const { count, hits } = countMatches(ch.sentences, req.patterns);
      checks.push({
        type: 'generic-A1',
        id: req.id,
        label: req.label,
        min: spec.minOccurrences,
        count,
        ok: count >= spec.minOccurrences,
        sample: hits.slice(0, 2),
      });
    }
  } else if (ch.level === 'A2') {
    const spec = criteria.chapterTypes['generic-A2'];
    for (const req of spec.requiredStructures) {
      const { count, hits } = countMatches(ch.sentences, req.patterns);
      checks.push({
        type: 'generic-A2',
        id: req.id,
        label: req.label,
        min: spec.minOccurrences,
        count,
        ok: count >= spec.minOccurrences,
        sample: hits.slice(0, 2),
      });
    }
  }
  const failed = checks.filter((c) => !c.ok);
  results.push({
    goal: ch.goal,
    chapterId: ch.chapterId,
    level: ch.level,
    titleFr: ch.titleFr,
    lessonCount: ch.lessonIds.length,
    sentenceCount: ch.sentences.length,
    checks,
    pass: checks.length === 0 ? null : failed.length === 0,
    missing: failed.map((f) => f.label),
  });
}

const a1a2 = results.filter((r) => r.level === 'A1' || r.level === 'A2');
const a1a2Checked = a1a2.filter((r) => r.pass !== null);
const a1a2Fail = a1a2Checked.filter((r) => r.pass === false);
const greetA1 = results.filter((r) => r.level === 'A1' && r.chapterId.endsWith('-greet'));

const report = {
  summary: {
    chaptersTotal: results.length,
    a1a2Checked: a1a2Checked.length,
    a1a2Fail: a1a2Fail.length,
    a1a2FailRate: a1a2Checked.length ? a1a2Fail.length / a1a2Checked.length : 0,
    stopThresholdHalf: a1a2Checked.length ? a1a2Fail.length / a1a2Checked.length > 0.5 : false,
  },
  greetA1,
  failingA1A2: a1a2Fail.map((r) => ({
    goal: r.goal,
    chapterId: r.chapterId,
    level: r.level,
    titleFr: r.titleFr,
    missing: r.missing,
  })),
  matrix: results.map((r) => ({
    goal: r.goal,
    chapterId: r.chapterId,
    level: r.level,
    pass: r.pass,
    missing: r.missing,
    checks: r.checks.map((c) => ({ id: c.id, count: c.count, min: c.min, ok: c.ok })),
  })),
};

const outPath = path.join(__dirname, 'level-criteria-audit.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report.summary, null, 2));
console.log('\n=== Se présenter A1 (greet) ===');
for (const g of greetA1) {
  console.log(`\n${g.goal} / ${g.chapterId}`);
  for (const c of g.checks) {
    console.log(`  ${c.ok ? 'OK' : 'MISS'} ${c.label}: ${c.count}/${c.min}`);
  }
}
console.log(`\nA1+A2 fail rate: ${(report.summary.a1a2FailRate * 100).toFixed(1)}% (${a1a2Fail.length}/${a1a2Checked.length})`);
console.log(report.summary.stopThresholdHalf ? 'STOP THRESHOLD: >50% A1/A2 chapters fail' : 'Under 50% fail — may continue');

if (process.argv.includes('--fail')) {
  const anyMissing = results.some((r) => r.pass === false);
  if (anyMissing) process.exit(1);
}
