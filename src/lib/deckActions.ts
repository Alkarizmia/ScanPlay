import { exportPairsAsJson, exportPairsAsText } from './spacedRepetition';
import type { WordPair } from '../types';

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDeckAsTxt(pairs: WordPair[]) {
  downloadFile(exportPairsAsText(pairs), 'scanplay-deck.txt', 'text/plain;charset=utf-8');
}

export function exportDeckAsJson(pairs: WordPair[]) {
  downloadFile(exportPairsAsJson(pairs), 'scanplay-deck.json', 'application/json');
}

export async function shareDeck(pairs: WordPair[]): Promise<'shared' | 'copied' | 'failed'> {
  const text = exportPairsAsText(pairs);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'ScanPlay', text });
      return 'shared';
    } catch {
      /* user cancelled or unsupported */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
