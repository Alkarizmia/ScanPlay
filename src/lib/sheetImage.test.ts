import { describe, expect, it } from 'vitest';
import { contentBoundingBox, scaleToMaxSide } from './sheetImage';

function fillRect(
  pixels: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
      pixels[i + 3] = 255;
    }
  }
}

describe('contentBoundingBox', () => {
  it('crops a bright printed sheet off a dark background', () => {
    const width = 160;
    const height = 160;
    const pixels = new Uint8ClampedArray(width * height * 4);
    fillRect(pixels, width, 0, 0, width, height, [40, 40, 40]);
    fillRect(pixels, width, 40, 30, 130, 140, [230, 230, 225]);
    for (let y = 40; y < 130; y += 8) {
      fillRect(pixels, width, 48, y, 120, y + 2, [20, 20, 20]);
    }

    const box = contentBoundingBox(pixels, width, height);
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThan(50);
    expect(box!.y).toBeLessThan(45);
    expect(box!.x + box!.w).toBeGreaterThan(120);
    expect(box!.y + box!.h).toBeGreaterThan(120);
    expect((box!.w * box!.h) / (width * height)).toBeLessThan(0.92);
  });

  it('returns null for a full-bleed screenshot (already the sheet)', () => {
    const width = 96;
    const height = 96;
    const pixels = new Uint8ClampedArray(width * height * 4);
    fillRect(pixels, width, 0, 0, width, height, [245, 245, 245]);
    for (let y = 8; y < 88; y += 6) {
      fillRect(pixels, width, 8, y, 88, y + 2, [10, 10, 10]);
    }
    expect(contentBoundingBox(pixels, width, height)).toBeNull();
  });
});

describe('scaleToMaxSide', () => {
  it('does not upscale small images', () => {
    expect(scaleToMaxSide(800, 600, 2000)).toEqual({ w: 800, h: 600 });
  });

  it('caps the long side', () => {
    expect(scaleToMaxSide(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 });
  });
});
