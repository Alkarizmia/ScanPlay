/**
 * Generates still-translations-b.mjs and still-translations-c.mjs from inline data.
 * Run: node scripts/gen-still-b-c.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stillMissing = fs
  .readFileSync(path.join(__dirname, '_still-missing.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);
const done = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, '_still-keys-a.json'), 'utf8')),
);
const rest = stillMissing.filter((s) => !done.has(s));
const half = Math.ceil(rest.length / 2);
const b = rest.slice(0, half);
const c = rest.slice(half);

/** @type {Record<string, { fr: string, nl: string, es: string, ar: string }>} */
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '_still-map-rest.json'), 'utf8'));

function emit(name, keys) {
  const lines = ['export default {'];
  for (const en of keys) {
    const row = MAP[en];
    if (!row) throw new Error('Missing map for: ' + en);
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    lines.push(
      `  '${esc(en)}': { fr: '${esc(row.fr)}', nl: '${esc(row.nl)}', es: '${esc(row.es)}', ar: '${esc(row.ar)}' },`,
    );
  }
  lines.push('};', '');
  fs.writeFileSync(path.join(__dirname, name), lines.join('\n'), 'utf8');
}

emit('still-translations-b.mjs', b);
emit('still-translations-c.mjs', c);
console.log('b', b.length, 'c', c.length);
