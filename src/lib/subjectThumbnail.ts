import type { HistorySubject } from '../types';

const cache = new Map<string, string>();
const THUMB_CACHE_VERSION = 3;

type ArtPattern = 'rings' | 'dots' | 'diagonal' | 'waves' | 'grid';

interface SubjectVariant {
  colors: [string, string, string];
  emoji: string;
  emojiSecondary?: string;
  accent: string;
  pattern: ArtPattern;
}

const VARIANTS: Record<HistorySubject, SubjectVariant[]> = {
  law: [
    { colors: ['#78350F', '#92400E', '#451A03'], emoji: '⚖️', accent: '#FDE68A', pattern: 'diagonal' },
    { colors: ['#1E3A8A', '#1E40AF', '#172554'], emoji: '📜', emojiSecondary: '⚖️', accent: '#BFDBFE', pattern: 'waves' },
    { colors: ['#374151', '#111827', '#030712'], emoji: '🏛️', accent: '#E5E7EB', pattern: 'rings' },
    { colors: ['#7C2D12', '#9A3412', '#431407'], emoji: '⚖️', emojiSecondary: '📜', accent: '#FED7AA', pattern: 'dots' },
  ],
  economics: [
    { colors: ['#065F46', '#047857', '#064E3B'], emoji: '📈', accent: '#A7F3D0', pattern: 'diagonal' },
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], emoji: '💶', emojiSecondary: '📊', accent: '#DBEAFE', pattern: 'waves' },
    { colors: ['#B45309', '#D97706', '#92400E'], emoji: '📊', accent: '#FEF3C7', pattern: 'rings' },
  ],
  math: [
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], emoji: '📐', accent: '#FBBF24', pattern: 'grid' },
    { colors: ['#4338CA', '#4F46E5', '#312E81'], emoji: '🔢', emojiSecondary: '➕', accent: '#C7D2FE', pattern: 'dots' },
    { colors: ['#0369A1', '#0284C7', '#0C4A6E'], emoji: '📊', accent: '#BAE6FD', pattern: 'diagonal' },
    { colors: ['#7C3AED', '#6D28D9', '#4C1D95'], emoji: '∑', emojiSecondary: '📐', accent: '#DDD6FE', pattern: 'rings' },
  ],
  history: [
    { colors: ['#C2410C', '#EA580C', '#9A3412'], emoji: '🏛️', accent: '#FDE68A', pattern: 'diagonal' },
    { colors: ['#B45309', '#D97706', '#78350F'], emoji: '⚔️', emojiSecondary: '🏺', accent: '#FEF3C7', pattern: 'waves' },
    { colors: ['#7F1D1D', '#991B1B', '#450A0A'], emoji: '👑', accent: '#FECACA', pattern: 'rings' },
    { colors: ['#A16207', '#CA8A04', '#713F12'], emoji: '🗺️', emojiSecondary: '🏛️', accent: '#FEF9C3', pattern: 'dots' },
  ],
  science: [
    { colors: ['#15803D', '#16A34A', '#14532D'], emoji: '🧪', accent: '#BBF7D0', pattern: 'dots' },
    { colors: ['#0F766E', '#14B8A6', '#134E4A'], emoji: '🧬', emojiSecondary: '🔬', accent: '#99F6E4', pattern: 'waves' },
    { colors: ['#047857', '#059669', '#064E3B'], emoji: '🌿', accent: '#A7F3D0', pattern: 'diagonal' },
    { colors: ['#4D7C0F', '#65A30D', '#365314'], emoji: '🔬', accent: '#D9F99D', pattern: 'rings' },
  ],
  physics: [
    { colors: ['#5B21B6', '#7C3AED', '#4C1D95'], emoji: '🪐', accent: '#DDD6FE', pattern: 'rings' },
    { colors: ['#312E81', '#4338CA', '#1E1B4B'], emoji: '⚡', emojiSecondary: '🔭', accent: '#C7D2FE', pattern: 'diagonal' },
    { colors: ['#0E7490', '#0891B2', '#164E63'], emoji: '🌌', accent: '#A5F3FC', pattern: 'waves' },
    { colors: ['#6D28D9', '#7C3AED', '#3B0764'], emoji: '⚛️', accent: '#E9D5FF', pattern: 'dots' },
  ],
  geography: [
    { colors: ['#0E7490', '#0891B2', '#155E75'], emoji: '🌍', accent: '#A5F3FC', pattern: 'waves' },
    { colors: ['#047857', '#059669', '#064E3B'], emoji: '🗺️', emojiSecondary: '🏔️', accent: '#A7F3D0', pattern: 'diagonal' },
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], emoji: '🌋', accent: '#BFDBFE', pattern: 'rings' },
  ],
  literature: [
    { colors: ['#BE185D', '#DB2777', '#9D174D'], emoji: '📖', accent: '#FBCFE8', pattern: 'diagonal' },
    { colors: ['#7E22CE', '#9333EA', '#581C87'], emoji: '✒️', emojiSecondary: '📚', accent: '#E9D5FF', pattern: 'dots' },
    { colors: ['#B91C1C', '#DC2626', '#7F1D1D'], emoji: '🎭', accent: '#FECACA', pattern: 'waves' },
  ],
  languages: [
    { colors: ['#047857', '#059669', '#064E3B'], emoji: '🗣️', accent: '#A7F3D0', pattern: 'waves' },
    { colors: ['#1D4ED8', '#2563EB', '#1E3A8A'], emoji: '🌐', emojiSecondary: '💬', accent: '#BFDBFE', pattern: 'dots' },
    { colors: ['#7C3AED', '#6D28D9', '#4C1D95'], emoji: '🔤', accent: '#DDD6FE', pattern: 'diagonal' },
    { colors: ['#0D9488', '#14B8A6', '#115E59'], emoji: '📝', emojiSecondary: '🗣️', accent: '#99F6E4', pattern: 'rings' },
  ],
  general: [
    { colors: ['#475569', '#334155', '#1E293B'], emoji: '📚', accent: '#E2E8F0', pattern: 'diagonal' },
    { colors: ['#4B5563', '#374151', '#111827'], emoji: '📋', emojiSecondary: '✨', accent: '#F3F4F6', pattern: 'dots' },
    { colors: ['#0369A1', '#0284C7', '#0C4A6E'], emoji: '🎓', accent: '#BAE6FD', pattern: 'rings' },
    { colors: ['#059669', '#10B981', '#047857'], emoji: '📖', accent: '#D1FAE5', pattern: 'waves' },
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

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.22,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: ArtPattern, w: number, h: number, accent: string) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;

  if (pattern === 'rings') {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.28, 30 + i * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (pattern === 'dots') {
    for (let x = 0; x < w; x += 28) {
      for (let y = 0; y < h; y += 28) {
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'diagonal') {
    ctx.lineWidth = 2;
    for (let i = -h; i < w + h; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
  } else if (pattern === 'waves') {
    ctx.lineWidth = 3;
    for (let yOff = 0; yOff < h; yOff += 36) {
      ctx.beginPath();
      ctx.moveTo(0, h - yOff);
      for (let x = 0; x <= w; x += 24) {
        ctx.lineTo(x, h - yOff + Math.sin(x / 40) * 8);
      }
      ctx.stroke();
    }
  } else if (pattern === 'grid') {
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSubjectArt(
  ctx: CanvasRenderingContext2D,
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

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.1, w * 0.5, h * 0.45, h * 0.85);
  vignette.addColorStop(0, 'rgba(255,255,255,0.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  drawBubble(ctx, w * 0.84, h * 0.18, 56, '#FFFFFF', 0.18);
  drawBubble(ctx, w * 0.14, h * 0.82, 38, variant.accent, 0.28);
  drawBubble(ctx, w * 0.72, h * 0.74, 22, '#FFFFFF', 0.12);

  ctx.save();
  ctx.font = 'bold 96px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 18;
  ctx.fillText(variant.emoji, w * 0.5, h * 0.46);
  if (variant.emojiSecondary) {
    ctx.font = 'bold 52px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText(variant.emojiSecondary, w * 0.72, h * 0.28);
  }
  ctx.restore();
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

  drawSubjectArt(ctx, variant, w, h);
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
