import fs from 'node:fs';

const ar = JSON.parse(fs.readFileSync(new URL('./_ar-locale.json', import.meta.url), 'utf8'));
const fr = JSON.parse(fs.readFileSync(new URL('./_fr-locale.json', import.meta.url), 'utf8'));
const frKeys = Object.keys(fr);
const missing = frKeys.filter((k) => !(k in ar));
const extra = Object.keys(ar).filter((k) => !(k in fr));
if (missing.length || extra.length) {
  console.error('key mismatch', { missing: missing.length, extra: extra.length, missingSample: missing.slice(0, 10) });
  process.exit(1);
}

function escapeTs(value) {
  return JSON.stringify(value);
}

const body = frKeys.map((k) => `    ${k}: ${escapeTs(ar[k])},`).join('\n');
const block = `  ar: {\n${body}\n  },\n`;

const i18nPath = new URL('../src/lib/i18n.ts', import.meta.url);
let src = fs.readFileSync(i18nPath, 'utf8');
if (/\n\s{2}ar:\s*\{/.test(src)) {
  src = src.replace(/\n\s{2}ar:\s*\{[\s\S]*?\n\s{2}\},\n/, '\n');
}
// Insert ar block before closing `} as const;` of strings
const marker = '\n} as const;';
const idx = src.lastIndexOf(marker);
if (idx < 0) {
  console.error('Could not find } as const;');
  process.exit(1);
}
// Find the es block end: last `  },` before `} as const`
const before = src.slice(0, idx);
if (!before.trimEnd().endsWith('},')) {
  console.error('Unexpected strings closing shape');
  process.exit(1);
}
src = before + '\n' + block + marker + src.slice(idx + marker.length);
fs.writeFileSync(i18nPath, src);
console.log('injected ar locale with', frKeys.length, 'keys');
