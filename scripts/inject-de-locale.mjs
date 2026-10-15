import fs from 'node:fs';

const de = JSON.parse(fs.readFileSync(new URL('./_de-locale.json', import.meta.url), 'utf8'));
const fr = JSON.parse(fs.readFileSync(new URL('./_fr-locale.json', import.meta.url), 'utf8'));
const frKeys = Object.keys(fr);
const missing = frKeys.filter((k) => !(k in de));
const extra = Object.keys(de).filter((k) => !(k in fr) && k !== 'engNative_de');
if (missing.length) {
  console.error('key mismatch', {
    missing: missing.length,
    extra: extra.length,
    missingSample: missing.slice(0, 15),
  });
  process.exit(1);
}
if (!('engNative_de' in de)) de.engNative_de = 'Deutsch';
if (!('engNative_de' in fr)) {
  // engNative_de was added to fr in i18n.ts; ensure JSON extract is refreshed if needed
}

function escapeTs(value) {
  return JSON.stringify(value);
}

const keys = [...frKeys];
if (!keys.includes('engNative_de')) keys.splice(keys.indexOf('engNative_ar') + 1, 0, 'engNative_de');
const body = keys.map((k) => `    ${k}: ${escapeTs(de[k] ?? fr[k])},`).join('\n');
const block = `  de: {\n${body}\n  },\n`;

const i18nPath = new URL('../src/lib/i18n.ts', import.meta.url);
let src = fs.readFileSync(i18nPath, 'utf8');
if (/\n\s{2}de:\s*\{/.test(src)) {
  src = src.replace(/\n\s{2}de:\s*\{[\s\S]*?\n\s{2}\},\n/, '\n');
}
const marker = '\n} as const;';
const idx = src.lastIndexOf(marker);
if (idx < 0) {
  console.error('Could not find } as const;');
  process.exit(1);
}
const before = src.slice(0, idx);
if (!before.trimEnd().endsWith('},')) {
  console.error('Unexpected strings closing shape');
  process.exit(1);
}
src = before + '\n' + block + marker + src.slice(idx + marker.length);
fs.writeFileSync(i18nPath, src);
console.log('injected de locale with', keys.length, 'keys');
