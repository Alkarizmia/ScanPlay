import { describe, expect, it } from 'vitest';

import { collectDroppedImageFiles, isLikelyImageFile } from './droppedFiles';

function file(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

describe('isLikelyImageFile', () => {
  it('accepts image MIME types', () => {
    expect(isLikelyImageFile(file('notes.bin', 'image/png'))).toBe(true);
  });

  it('accepts common extensions when MIME is empty (Windows drop)', () => {
    expect(isLikelyImageFile(file('vocab.jpg'))).toBe(true);
    expect(isLikelyImageFile(file('vocab.JPEG'))).toBe(true);
    expect(isLikelyImageFile(file('shot.PNG'))).toBe(true);
    expect(isLikelyImageFile(file('scan.webp'))).toBe(true);
  });

  it('rejects non-images', () => {
    expect(isLikelyImageFile(file('notes.pdf', 'application/pdf'))).toBe(false);
    expect(isLikelyImageFile(file('image'))).toBe(false);
  });
});

describe('collectDroppedImageFiles', () => {
  it('filters DataTransfer.files when there are no filesystem entries', async () => {
    const dt = {
      items: [],
      files: [file('a.jpg'), file('b.txt'), file('c.png', 'image/png')],
    } as unknown as DataTransfer;

    const images = await collectDroppedImageFiles(dt);
    expect(images.map((f) => f.name)).toEqual(['a.jpg', 'c.png']);
  });
});
