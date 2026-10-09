import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = 'public/universe/signs/_raw';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
const stats = [];
for (const f of files) {
  const m = await sharp(path.join(dir, f)).metadata();
  stats.push({ f, w: m.width, h: m.height, size: fs.statSync(path.join(dir, f)).size });
}
stats.sort((a, b) => b.size - a.size);
console.log('count', stats.length);
console.log('largest:');
for (const s of stats.slice(0, 30)) console.log(s.f, s.w + 'x' + s.h, s.size);
console.log('--- p04 ---');
for (const s of stats.filter((x) => x.f.startsWith('p04_')).sort((a, b) => a.f.localeCompare(b.f))) {
  console.log(s.f, s.w + 'x' + s.h, s.size);
}
console.log('--- p05 ---');
for (const s of stats.filter((x) => x.f.startsWith('p05_')).sort((a, b) => a.f.localeCompare(b.f))) {
  console.log(s.f, s.w + 'x' + s.h, s.size);
}
