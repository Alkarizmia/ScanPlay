import fs from 'node:fs';

const p = 'scripts/build-belgian-signs-catalog.mjs';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('function preferScore(title)');
const end = s.indexOf('\nasync function listCategory', start);
if (start < 0 || end < 0) throw new Error('markers not found');

const replacement = `function preferScore(title) {
  const t = title.replace(/^File:/, '');
  if (/^[A-F][0-9]+[a-zA-Z]?\\s*-\\s*Belgium\\.svg$/i.test(t)) return 3;
  if (/^Belgian road sign [A-F][0-9]+[a-zA-Z]?\\.svg$/i.test(t)) return 2;
  if (/Belgian traffic sign [A-F][0-9]+[a-zA-Z]?/i.test(t) && /KB-AR/i.test(t)) return 1;
  return 0;
}
`;

s = s.slice(0, start) + replacement + s.slice(end + 1);
fs.writeFileSync(p, s);
console.log('preferScore fixed');
