import type { HistorySubject } from '../types';

const cache = new Map<string, string>();
const THUMB_CACHE_VERSION = 4;

type ArtPattern = 'rings' | 'dots' | 'diagonal' | 'waves' | 'grid';

interface SubjectVariant {
  colors: [string, string, string];
  accent: string;
  pattern: ArtPattern;
}

const VARIANTS: Record<HistorySubject, SubjectVariant[]> = {
  law: [
    { colors: ['#78350F', '#92400E', '#451A03'], accent: '#FDE68A', pattern: 'diagonal' },
    { colors: ['#1E3A8A', '#1E40AF', '#172554'], accent: '#BFDBFE', pattern: 'waves' },
    { colors: ['#374151', '#111827', '#030712'], accent: '#E5E7EB', pattern: 'rings' },
  ],
  economics: [
    { colors: ['#065F46', '#047857', '#064E3B'], accent: '#A7F3D0', pattern: 'diagonal' },
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], accent: '#DBEAFE', pattern: 'waves' },
    { colors: ['#B45309', '#D97706', '#92400E'], accent: '#FEF3C7', pattern: 'rings' },
  ],
  math: [
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], accent: '#FBBF24', pattern: 'grid' },
    { colors: ['#4338CA', '#4F46E5', '#312E81'], accent: '#C7D2FE', pattern: 'dots' },
    { colors: ['#0369A1', '#0284C7', '#0C4A6E'], accent: '#BAE6FD', pattern: 'diagonal' },
  ],
  history: [
    { colors: ['#C2410C', '#EA580C', '#9A3412'], accent: '#FDE68A', pattern: 'diagonal' },
    { colors: ['#B45309', '#D97706', '#78350F'], accent: '#FEF3C7', pattern: 'waves' },
    { colors: ['#7F1D1D', '#991B1B', '#450A0A'], accent: '#FECACA', pattern: 'rings' },
  ],
  science: [
    { colors: ['#15803D', '#16A34A', '#14532D'], accent: '#BBF7D0', pattern: 'dots' },
    { colors: ['#0F766E', '#14B8A6', '#134E4A'], accent: '#99F6E4', pattern: 'waves' },
    { colors: ['#047857', '#059669', '#064E3B'], accent: '#A7F3D0', pattern: 'diagonal' },
  ],
  physics: [
    { colors: ['#5B21B6', '#7C3AED', '#4C1D95'], accent: '#DDD6FE', pattern: 'rings' },
    { colors: ['#312E81', '#4338CA', '#1E1B4B'], accent: '#C7D2FE', pattern: 'diagonal' },
    { colors: ['#0E7490', '#0891B2', '#164E63'], accent: '#A5F3FC', pattern: 'waves' },
  ],
  geography: [
    { colors: ['#0E7490', '#0891B2', '#155E75'], accent: '#A5F3FC', pattern: 'waves' },
    { colors: ['#047857', '#059669', '#064E3B'], accent: '#A7F3D0', pattern: 'diagonal' },
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], accent: '#BFDBFE', pattern: 'rings' },
  ],
  literature: [
    { colors: ['#BE185D', '#DB2777', '#9D174D'], accent: '#FBCFE8', pattern: 'diagonal' },
    { colors: ['#7E22CE', '#9333EA', '#581C87'], accent: '#E9D5FF', pattern: 'dots' },
    { colors: ['#B91C1C', '#DC2626', '#7F1D1D'], accent: '#FECACA', pattern: 'waves' },
  ],
  languages: [
    { colors: ['#047857', '#059669', '#064E3B'], accent: '#A7F3D0', pattern: 'waves' },
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], accent: '#BFDBFE', pattern: 'dots' },
    { colors: ['#7C3AED', '#6D28D9', '#4C1D95'], accent: '#DDD6FE', pattern: 'diagonal' },
  ],
  general: [
    { colors: ['#15803D', '#22C55E', '#14532D'], accent: '#D9F99D', pattern: 'dots' },
    { colors: ['#0369A1', '#0284C7', '#0C4A6E'], accent: '#BAE6FD', pattern: 'rings' },
    { colors: ['#4B5563', '#374151', '#111827'], accent: '#F3F4F6', pattern: 'diagonal' },
  ],
};

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickVariant(subject: HistorySubject, seed: string): SubjectVariant {
  const list = VARIANTS[subject];
  return list[hashSeed(seed) % list.length]!;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  roundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: ArtPattern, w: number, h: number, accent: string) {
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;

  if (pattern === 'rings') {
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.22, 40 + i * 28, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (pattern === 'dots') {
    for (let x = 0; x < w; x += 36) {
      for (let y = 0; y < h; y += 36) {
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'diagonal') {
    ctx.lineWidth = 5;
    for (let i = -h; i < w + h; i += 36) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
  } else if (pattern === 'waves') {
    ctx.lineWidth = 5;
    for (let yOff = 0; yOff < h; yOff += 48) {
      ctx.beginPath();
      ctx.moveTo(0, h - yOff);
      for (let x = 0; x <= w; x += 28) {
        ctx.lineTo(x, h - yOff + Math.sin(x / 48) * 12);
      }
      ctx.stroke();
    }
  } else if (pattern === 'grid') {
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawPlayChip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  fillRound(ctx, x + 4, y + 10, 92, 92, 26, '#3d8c02');
  fillRound(ctx, x, y, 92, 92, 26, '#58cc02');
  ctx.fillStyle = '#14350c';
  ctx.beginPath();
  ctx.moveTo(x + 34, y + 24);
  ctx.lineTo(x + 72, y + 46);
  ctx.lineTo(x + 34, y + 68);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGameCard(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  fillRound(ctx, -52, -70, 104, 140, 16, 'rgba(0,0,0,0.18)');
  fillRound(ctx, -56, -76, 104, 140, 16, fill);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  fillRound(ctx, -40, -60, 72, 18, 8, 'rgba(255,255,255,0.35)');
  ctx.restore();
}

function drawMath(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.72);
  ctx.lineTo(w * 0.42, h * 0.28);
  ctx.lineTo(w * 0.66, h * 0.72);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.38, 78, 0, Math.PI * 2);
  ctx.stroke();

  fillRound(ctx, w * 0.12, h * 0.16, 88, 88, 22, accent);
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('∑', w * 0.12 + 44, h * 0.16 + 48);

  drawGameCard(ctx, w * 0.82, h * 0.7, 0.18, '#fbbf24');
}

function drawGeography(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath();
  ctx.ellipse(w * 0.48, h * 0.78, w * 0.42, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.ellipse(w * 0.42, h * 0.58, 210, 130, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.62, 140, 90, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.58);
  ctx.lineTo(w * 0.34, h * 0.28);
  ctx.lineTo(w * 0.46, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.58);
  ctx.lineTo(w * 0.48, h * 0.22);
  ctx.lineTo(w * 0.62, h * 0.58);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.28, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.82, h * 0.28 - 40);
  ctx.lineTo(w * 0.82, h * 0.28 + 40);
  ctx.moveTo(w * 0.82 - 40, h * 0.28);
  ctx.lineTo(w * 0.82 + 40, h * 0.28);
  ctx.stroke();
}

function drawScience(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  fillRound(ctx, w * 0.42, h * 0.14, 70, 90, 18, 'rgba(255,255,255,0.22)');
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.32);
  ctx.lineTo(w * 0.28, h * 0.78);
  ctx.quadraticCurveTo(w * 0.5, h * 0.92, w * 0.72, h * 0.78);
  ctx.lineTo(w * 0.68, h * 0.32);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(w * 0.28, h * 0.22, 22, 0, Math.PI * 2);
  ctx.arc(w * 0.74, h * 0.26, 32, 0, Math.PI * 2);
  ctx.arc(w * 0.8, h * 0.48, 16, 0, Math.PI * 2);
  ctx.fill();
}

function drawPhysics(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const cx = w * 0.48;
  const cy = h * 0.48;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 8;
  for (const rot of [-0.5, 0.4, 1.2]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 210, 78, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.18);
  ctx.lineTo(w * 0.68, h * 0.38);
  ctx.lineTo(w * 0.76, h * 0.38);
  ctx.lineTo(w * 0.66, h * 0.62);
  ctx.lineTo(w * 0.82, h * 0.34);
  ctx.lineTo(w * 0.74, h * 0.34);
  ctx.closePath();
  ctx.fill();
}

function drawHistoryScene(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const base = h * 0.78;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  fillRound(ctx, w * 0.16, base, w * 0.68, 28, 8, 'rgba(0,0,0,0.25)');
  const cols = [0.26, 0.5, 0.74];
  for (const x of cols) {
    fillRound(ctx, w * x - 28, h * 0.32, 56, base - h * 0.32, 10, accent);
    fillRound(ctx, w * x - 42, h * 0.26, 84, 28, 12, '#fde68a');
  }
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.18, 36, Math.PI, 0);
  ctx.fill();
}

function drawLiterature(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.28);
  ctx.quadraticCurveTo(w * 0.18, h * 0.22, w * 0.16, h * 0.72);
  ctx.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.5, h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.28);
  ctx.quadraticCurveTo(w * 0.82, h * 0.22, w * 0.84, h * 0.72);
  ctx.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.5, h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.3);
  ctx.lineTo(w * 0.5, h * 0.7);
  ctx.stroke();
}

function drawLanguages(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  fillRound(ctx, w * 0.14, h * 0.22, 280, 170, 36, '#fff');
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.9);
  ctx.lineTo(w * 0.28, h * 0.58);
  ctx.lineTo(w * 0.4, h * 0.58);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();

  fillRound(ctx, w * 0.52, h * 0.4, 300, 180, 36, accent);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.92);
  ctx.lineTo(w * 0.72, h * 0.76);
  ctx.lineTo(w * 0.86, h * 0.76);
  ctx.closePath();
  ctx.fill();

  drawGameCard(ctx, w * 0.22, h * 0.72, -0.2, '#f8fafc');
}

function drawLaw(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.16);
  ctx.lineTo(w * 0.5, h * 0.78);
  ctx.moveTo(w * 0.22, h * 0.32);
  ctx.lineTo(w * 0.78, h * 0.32);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.32);
  ctx.lineTo(w * 0.08, h * 0.58);
  ctx.lineTo(w * 0.36, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.32);
  ctx.lineTo(w * 0.64, h * 0.58);
  ctx.lineTo(w * 0.92, h * 0.58);
  ctx.closePath();
  ctx.fill();
  fillRound(ctx, w * 0.38, h * 0.76, 230, 28, 10, '#fde68a');
}

function drawEconomics(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const bars = [0.32, 0.48, 0.64, 0.82];
  bars.forEach((bh, i) => {
    const x = w * 0.18 + i * 140;
    fillRound(ctx, x, h * (1 - bh) - 40, 88, h * bh, 16, i === bars.length - 1 ? accent : 'rgba(255,255,255,0.28)');
  });
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.22, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('€', w * 0.82, h * 0.22);
}

function drawGeneral(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  drawGameCard(ctx, w * 0.32, h * 0.5, -0.22, '#fff');
  drawGameCard(ctx, w * 0.5, h * 0.46, 0.04, accent);
  drawGameCard(ctx, w * 0.68, h * 0.52, 0.26, '#fde047');
}

function drawSubjectScene(
  ctx: CanvasRenderingContext2D,
  subject: HistorySubject,
  w: number,
  h: number,
  accent: string,
) {
  switch (subject) {
    case 'math':
      drawMath(ctx, w, h, accent);
      break;
    case 'geography':
      drawGeography(ctx, w, h, accent);
      break;
    case 'science':
      drawScience(ctx, w, h, accent);
      break;
    case 'physics':
      drawPhysics(ctx, w, h, accent);
      break;
    case 'history':
      drawHistoryScene(ctx, w, h, accent);
      break;
    case 'literature':
      drawLiterature(ctx, w, h, accent);
      break;
    case 'languages':
      drawLanguages(ctx, w, h, accent);
      break;
    case 'law':
      drawLaw(ctx, w, h, accent);
      break;
    case 'economics':
      drawEconomics(ctx, w, h, accent);
      break;
    default:
      drawGeneral(ctx, w, h, accent);
  }
}

function drawSubjectArt(
  ctx: CanvasRenderingContext2D,
  subject: HistorySubject,
  variant: SubjectVariant,
  w: number,
  h: number,
) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, variant.colors[0]);
  grad.addColorStop(0.55, variant.colors[1]);
  grad.addColorStop(1, variant.colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawPattern(ctx, variant.pattern, w, h, variant.accent);

  const vignette = ctx.createRadialGradient(w * 0.42, h * 0.4, h * 0.08, w * 0.5, h * 0.5, h * 0.9);
  vignette.addColorStop(0, 'rgba(255,255,255,0.1)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  drawSubjectScene(ctx, subject, w, h, variant.accent);
  drawPlayChip(ctx, w - 128, h - 128);
}

export function createSubjectThumbnailDataUrl(subject: HistorySubject, seed?: string): string {
  if (typeof document === 'undefined') return '';

  const pickSeed = seed ?? subject;
  const cacheKey = `${THUMB_CACHE_VERSION}:${subject}:${pickSeed}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const variant = pickVariant(subject, pickSeed);
  const w = 960;
  const h = 600;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  drawSubjectArt(ctx, subject, variant, w, h);
  const url = canvas.toDataURL('image/jpeg', 0.92);
  cache.set(cacheKey, url);
  return url;
}

export function getHistoryCardThumbnail(
  subject: HistorySubject,
  entryId: string,
  scanThumbnail?: string,
): string {
  const generated = createSubjectThumbnailDataUrl(subject, entryId);
  return generated || scanThumbnail || '';
}
