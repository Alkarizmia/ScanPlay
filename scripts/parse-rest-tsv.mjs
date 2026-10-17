import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sep = '|||';
/** @type {Record<string, { fr: string, nl: string, es: string, ar: string }>} */
const map = {};
for (const file of ['rest-translations-1.tsv', 'rest-translations-2.tsv', 'rest-translations-3.tsv', 'rest-translations-4.tsv']) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [en, fr, nl, es, ar] = line.split(sep);
    if (!en) continue;
    map[en] = { fr, nl, es, ar };
  }
}
fs.writeFileSync(path.join(__dirname, '_still-map-rest.json'), JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log('map keys', Object.keys(map).length);
