/**
 * Append (or update) Universe English vocab, then rebuild the curriculum.
 *
 * Usage:
 *   node scripts/add-english-vocab.mjs "en|fr|nl|es|ar|sentenceEn|sentenceFr|sentenceNl|sentenceEs|sentenceAr|cefr|theme"
 *
 * Prefer the 12-column form so translate rounds never invent a wrong native sentence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(__dirname, 'english-vocab-raw.txt');
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const line = process.argv.slice(2).join(' ').trim();
if (!line) {
  console.error('Missing vocab line.');
  process.exit(1);
}

const parts = line.split('|').map((p) => p.trim());
if (parts.length !== 8 && parts.length !== 12) {
  console.error('Need 8 or 12 pipe-separated fields.');
  process.exit(1);
}

const en = parts[0];
const cefr = parts.length === 12 ? parts[10] : parts[6];
const theme = parts.length === 12 ? parts[11] : parts[7];
if (!en || !CEFR.has(cefr) || !theme) {
  console.error('Invalid en / cefr / theme.');
  process.exit(1);
}
if (parts.length === 8) {
  console.warn(
    'Warning: no native example sentences — translate will use matching templates, not the EN example.',
  );
}

const raw = fs.readFileSync(rawPath, 'utf8');
const lines = raw.split(/\r?\n/);
const key = en.toLowerCase();
let replaced = false;
const next = lines.map((row) => {
  const trimmed = row.trim();
  if (!trimmed || trimmed.startsWith('#')) return row;
  const cols = trimmed.split('|').map((p) => p.trim());
  if ((cols[0] || '').toLowerCase() === key) {
    replaced = true;
    return line;
  }
  return row;
});
if (!replaced) next.push(line);

fs.writeFileSync(rawPath, `${next.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
console.log(replaced ? `Updated: ${en}` : `Appended: ${en}`);

const build = spawnSync(process.execPath, [path.join(__dirname, 'build-english-curriculum.mjs')], {
  stdio: 'inherit',
});
process.exit(build.status ?? 1);
