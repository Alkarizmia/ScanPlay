/**
 * Assembles scripts/english-sentence-i18n.json from tuple modules + remainder jsonl.
 * node scripts/assemble-english-sentence-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import T1 from './sentence-i18n-tuples.mjs';
import R1 from './i18n-remainder-1.mjs';
import still from './still-translations.mjs';
import restMap from './_still-map-rest.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(__dirname, 'english-vocab-raw.txt');
const outPath = path.join(__dirname, 'english-sentence-i18n.json');

/** @type {Record<string, { fr: string, nl: string, es: string, ar: string }>} */
const out = {};

for (const chunk of [T1, R1]) {
  for (const [en, fr, nl, es, ar] of chunk) {
    out[en] = { fr, nl, es, ar };
  }
}
Object.assign(out, still, restMap);

const expected = new Set();
for (const line of fs.readFileSync(rawPath, 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const cols = line.split('|');
  if (cols.length < 7) continue;
  expected.add(cols[5].trim());
}

const missing = [...expected].filter((s) => !out[s]);
if (missing.length) {
  console.error('Missing translations:', missing.length);
  console.error(missing.slice(0, 20).join('\n'));
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Keys written:', Object.keys(out).length);
console.log('Has bread:', 'I bought fresh bread.' in out);
