import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';

const pdfPath = 'C:/Users/elfah/Downloads/synthese le permis belge.pdf';
const outDir = path.join(process.cwd(), 'public', 'universe', 'signs', '_raw');
fs.mkdirSync(outDir, { recursive: true });

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const images = await parser.getImage?.() ?? await parser.getImages?.();
console.log('keys', images && Object.keys(images));
console.log('type', typeof images, Array.isArray(images));

// Dump structure lightly
const pages = images?.pages ?? images?.PageImages ?? images;
if (Array.isArray(pages)) {
  console.log('pages', pages.length);
  let n = 0;
  for (let pi = 0; pi < pages.length; pi += 1) {
    const page = pages[pi];
    const list = page?.images ?? page?.Images ?? (Array.isArray(page) ? page : []);
    for (let ii = 0; ii < list.length; ii += 1) {
      const img = list[ii];
      const data = img?.data ?? img?.buffer ?? img?.bytes;
      if (!data) continue;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const name = `p${String(pi + 1).padStart(2, '0')}_${String(ii + 1).padStart(2, '0')}.png`;
      try {
        await sharp(buf).png().toFile(path.join(outDir, name));
        n += 1;
      } catch {
        fs.writeFileSync(path.join(outDir, name.replace('.png', '.bin')), buf);
      }
    }
  }
  console.log('saved', n);
} else {
  console.log(JSON.stringify(images, (_, v) => (typeof v === 'object' && v && v.type === 'Buffer' ? `[buf ${v.data?.length}]` : v), 2).slice(0, 2000));
}

await parser.destroy?.();
