import { getSupabase, isSupabaseConfigured } from './supabase';
import type { Locale, SheetType, WordPair } from '../types';

export type SynthesisMode = 'study' | 'export';

export interface SynthesisTable {
  headers: string[];
  rows: string[][];
}

export interface SynthesisSection {
  heading: string;
  content: string;
  bullets?: string[];
  table?: SynthesisTable | null;
  highlight?: string;
}

export interface SynthesisDocument {
  title: string;
  subject?: string;
  introduction: string;
  sections: SynthesisSection[];
  keyPoints: string[];
  memoryTips: string[];
  relatedToScan: string;
}

export interface GenerateSynthesisInput {
  pairs: WordPair[];
  locale: Locale;
  mode: SynthesisMode;
  title?: string;
  sheetType?: SheetType;
  thumbnail?: string;
}

function parseThumbnail(thumbnail?: string): { base64: string; mimeType: string } | null {
  if (!thumbnail?.startsWith('data:')) return null;
  const match = thumbnail.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export function isSynthesisEnabled(): boolean {
  if (!isSupabaseConfigured) return false;
  const flag = import.meta.env.VITE_AI_SCAN;
  return flag !== '0' && flag !== 'false';
}

export function parseSynthesisResponse(raw: unknown): SynthesisDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.title !== 'string' || typeof data.introduction !== 'string') return null;
  if (!Array.isArray(data.sections) || !Array.isArray(data.keyPoints)) return null;

  const sections: SynthesisSection[] = data.sections
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      heading: String(s.heading ?? ''),
      content: String(s.content ?? ''),
      bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
      table: parseTable(s.table),
      highlight: typeof s.highlight === 'string' ? s.highlight : undefined,
    }))
    .filter((s) => s.heading || s.content);

  return {
    title: data.title.trim().slice(0, 120),
    subject: typeof data.subject === 'string' ? data.subject.trim().slice(0, 80) : undefined,
    introduction: data.introduction.trim(),
    sections,
    keyPoints: data.keyPoints.map(String).filter(Boolean).slice(0, 12),
    memoryTips: Array.isArray(data.memoryTips) ? data.memoryTips.map(String).filter(Boolean).slice(0, 8) : [],
    relatedToScan: typeof data.relatedToScan === 'string' ? data.relatedToScan : '',
  };
}

function parseTable(raw: unknown): SynthesisTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (!Array.isArray(t.headers) || !Array.isArray(t.rows)) return null;
  const headers = t.headers.map(String).filter(Boolean);
  const rows = t.rows
    .filter((r): r is unknown[] => Array.isArray(r))
    .map((r) => r.map(String))
    .filter((r) => r.some((c) => c.trim()));
  if (!headers.length && !rows.length) return null;
  return { headers, rows };
}

export async function generateSynthesis(input: GenerateSynthesisInput): Promise<SynthesisDocument | null> {
  if (!isSynthesisEnabled()) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const image = parseThumbnail(input.thumbnail);

  const { data, error } = await supabase.functions.invoke('generate-synthesis', {
    body: {
      pairs: input.pairs,
      locale: input.locale,
      mode: input.mode,
      title: input.title,
      sheetType: input.sheetType ?? 'vocab',
      imageBase64: image?.base64,
      mimeType: image?.mimeType ?? 'image/jpeg',
    },
  });

  if (error || !data) return null;
  return parseSynthesisResponse(data);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTableHtml(table: SynthesisTable): string {
  const head = table.headers.length
    ? `<thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
    : '';
  const body = table.rows.length
    ? `<tbody>${table.rows
        .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`
    : '';
  return `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0">${head}${body}</table>`;
}

export function synthesisToPrintableHtml(doc: SynthesisDocument, thumbnail?: string): string {
  const sections = doc.sections
    .map((s) => {
      const bullets = s.bullets?.length
        ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
        : '';
      const table = s.table ? renderTableHtml(s.table) : '';
      const highlight = s.highlight ? `<p><em>${escapeHtml(s.highlight)}</em></p>` : '';
      return `<section><h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml(s.content)}</p>${highlight}${bullets}${table}</section>`;
    })
    .join('');

  const keyPoints = doc.keyPoints.length
    ? `<h2>Points clés</h2><ul>${doc.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ul>`
    : '';
  const tips = doc.memoryTips.length
    ? `<h2>Astuces mémoire</h2><ul>${doc.memoryTips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';
  const img = thumbnail
    ? `<img src="${thumbnail}" alt="Fiche" style="max-width:280px;max-height:200px;border-radius:8px;margin:12px 0" />`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#1a1a1a;line-height:1.5}
h1{font-size:1.6rem;margin-bottom:4px}h2{font-size:1.15rem;margin-top:20px;color:#2d6a4f}
p{margin:8px 0}ul{padding-left:20px}table{font-size:0.92rem}th{background:#e8f5e9;text-align:left}
@media print{body{margin:0}}
</style></head><body>
<h1>${escapeHtml(doc.title)}</h1>
${doc.subject ? `<p><strong>${escapeHtml(doc.subject)}</strong></p>` : ''}
${img}
<p>${escapeHtml(doc.introduction)}</p>
${sections}
${keyPoints}
${tips}
<p style="margin-top:24px;font-size:0.85rem;color:#666">${escapeHtml(doc.relatedToScan)}</p>
<p style="font-size:0.8rem;color:#999">ScanPlay — scanplay.org</p>
</body></html>`;
}

export function downloadSynthesisWord(doc: SynthesisDocument, thumbnail?: string): void {
  const html = synthesisToPrintableHtml(doc, thumbnail);
  const blob = new Blob([`\ufeff${html}`], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'synthese'}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printSynthesisPdf(doc: SynthesisDocument, thumbnail?: string): void {
  const html = synthesisToPrintableHtml(doc, thumbnail);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    win.print();
  }, 400);
}
