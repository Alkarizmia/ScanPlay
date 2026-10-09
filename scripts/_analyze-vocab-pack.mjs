import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normKey(en) {
  let s = en.trim().toLowerCase().replace(/[’']/g, "'");
  s = s.replace(/^(to|a|an|the)\s+/i, '');
  s = s.replace(/[-–—_/]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/[?.!,;:]+$/g, '').trim();
  return s;
}

function parseRaw(filePath, hasExtra) {
  const items = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const p = t.split('|').map((x) => x.trim());
    if (p.length < 8) continue;
    const [en, fr, nl, es, ar, sentence, cefr, theme] = p;
    items.push({
      en,
      fr,
      nl,
      es,
      ar,
      sentence,
      cefr,
      theme,
      type: hasExtra ? p[8] || '' : '',
      goals: hasExtra ? p[9] || '' : '',
      key: normKey(en),
    });
  }
  return items;
}

const existing = parseRaw(path.join(__dirname, 'english-vocab-raw.txt'), false);
const incoming = parseRaw(path.join('C:/Users/elfah/Downloads/english-vocab-new.txt'), true);

const byKey = new Map();
for (const e of existing) {
  if (!byKey.has(e.key)) byKey.set(e.key, e);
}

const dups = [];
const novel = [];
const conflict = [];

for (const n of incoming) {
  const old = byKey.get(n.key);
  if (old) {
    dups.push({
      newEn: n.en,
      oldEn: old.en,
      newCefr: n.cefr,
      oldCefr: old.cefr,
      newTheme: n.theme,
      oldTheme: old.theme,
      newSent: n.sentence,
      oldSent: old.sentence,
    });
    if (n.cefr !== old.cefr) {
      conflict.push({
        kind: 'cefr',
        key: n.key,
        newEn: n.en,
        oldEn: old.en,
        newCefr: n.cefr,
        oldCefr: old.cefr,
        newTheme: n.theme,
        oldTheme: old.theme,
        newSent: n.sentence,
        oldSent: old.sentence,
      });
    }
  } else {
    novel.push(n);
  }
}

const byTheme = {};
const byCefr = {};
const themeCefr = {};
for (const n of novel) {
  byTheme[n.theme] = (byTheme[n.theme] || 0) + 1;
  byCefr[n.cefr] = (byCefr[n.cefr] || 0) + 1;
  themeCefr[n.theme] = themeCefr[n.theme] || {};
  themeCefr[n.theme][n.cefr] = (themeCefr[n.theme][n.cefr] || 0) + 1;
}

const moneyAll = incoming.filter((i) => i.theme === 'money');
const moneyDups = moneyAll.filter((i) => byKey.has(i.key));
const moneyNew = moneyAll.filter((i) => !byKey.has(i.key));

const out = {
  existingCount: existing.length,
  incomingCount: incoming.length,
  dupCount: dups.length,
  novelCount: novel.length,
  conflictCefrCount: conflict.length,
  byTheme,
  byCefr,
  themeCefr,
  dups,
  conflict,
  money: {
    total: moneyAll.length,
    dups: moneyDups.map((d) => ({ newEn: d.en, oldEn: byKey.get(d.key).en, cefr: d.cefr })),
    novel: moneyNew,
  },
};

fs.writeFileSync(path.join(__dirname, '_pack-analysis.json'), JSON.stringify(out, null, 2));
console.log('EXISTING', existing.length, 'INCOMING', incoming.length);
console.log('DUPS', dups.length, 'NOVEL', novel.length, 'CEFR_CONFLICT', conflict.length);
console.log('NOVEL_BY_THEME', JSON.stringify(byTheme));
console.log('NOVEL_BY_CEFR', JSON.stringify(byCefr));
console.log('MONEY', moneyAll.length, 'dups', moneyDups.length, 'new', moneyNew.length);
console.log(
  'MONEY_DUPS',
  moneyDups.map((d) => `${d.en}~${byKey.get(d.key).en}`).join(' | '),
);
console.log(
  'MONEY_NEW',
  moneyNew.map((d) => `${d.en}(${d.cefr})`).join(', '),
);
