import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
const m = src.match(/^\s{2}fr:\s*\{([\s\S]*?)^\s{2}\},\s*$/m) || src.match(/fr:\s*\{([\s\S]*?)\n\s{2}\},\s*\n\s{2}en:/);
if (!m) {
  console.error('Could not find fr block');
  process.exit(1);
}
const body = m[1];
const out = {};
const keyRe = /^ {4}([A-Za-z0-9_]+):\s*/gm;
let match;
const indices = [];
while ((match = keyRe.exec(body))) {
  indices.push({ key: match[1], start: match.index + match[0].length });
}
for (let i = 0; i < indices.length; i += 1) {
  const { key, start } = indices[i];
  const end = i + 1 < indices.length ? indices[i + 1].start - indices[i + 1].key.length - 6 : body.length;
  let raw = body.slice(start, end).trim().replace(/,\s*$/, '');
  // Evaluate as JS string expression (single/double/backtick / concatenation)
  try {
    // eslint-disable-next-line no-new-func
    out[key] = Function(`"use strict"; return (${raw});`)();
  } catch {
    out[key] = raw;
  }
}
fs.writeFileSync(new URL('./_fr-locale.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('extracted', Object.keys(out).length, 'keys');
