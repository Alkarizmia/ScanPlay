/**
 * One-off builder: node scripts/write-english-sentence-i18n.mjs
 * Writes scripts/english-sentence-i18n.json from embedded tuples.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {[string, string, string, string, string][]} */
const T = [];

const out = {};
for (const [en, fr, nl, es, ar] of T) {
  out[en] = { fr, nl, es, ar };
}

const outPath = path.join(__dirname, 'english-sentence-i18n.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Keys written:', Object.keys(out).length);
console.log('Has bread:', 'I bought fresh bread.' in out);
