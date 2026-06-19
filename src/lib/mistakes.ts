import type { GameMode, WordPair } from '../types';



const KEY = 'scanplay-mistakes';



export interface MistakeEntry {

  id: string;

  term: string;

  definition: string;

  mode: GameMode;

  deckId?: string;

  stepIndex?: number;

  corrected: boolean;

  createdAt: string;

  correctedAt?: string;

}



export function loadMistakesRaw(): MistakeEntry[] {

  try {

    return JSON.parse(localStorage.getItem(KEY) ?? '[]');

  } catch {

    return [];

  }

}



export function saveMistakesRaw(entries: MistakeEntry[]): void {

  localStorage.setItem(KEY, JSON.stringify(entries));

}



function save(entries: MistakeEntry[]): void {

  saveMistakesRaw(entries);

  void import('./sync').then((m) => m.scheduleSync());

}



export function getMistakes(): MistakeEntry[] {

  return loadMistakesRaw().sort(

    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),

  );

}



export function recordMistake(

  pair: WordPair,

  mode: GameMode,

  deckId?: string,

  stepIndex?: number,

): void {

  const entries = loadMistakesRaw();

  const duplicate = entries.find(

    (e) =>

      !e.corrected &&

      e.term === pair.term &&

      e.definition === pair.definition &&

      e.mode === mode,

  );

  if (duplicate) return;



  entries.unshift({

    id: crypto.randomUUID(),

    term: pair.term,

    definition: pair.definition,

    mode,

    deckId,

    stepIndex,

    corrected: false,

    createdAt: new Date().toISOString(),

  });

  save(entries.slice(0, 200));

}



export function markCorrected(pair: WordPair): void {

  const entries = loadMistakesRaw();

  let changed = false;

  const now = new Date().toISOString();

  for (const entry of entries) {

    if (!entry.corrected && entry.term === pair.term) {

      entry.corrected = true;

      entry.correctedAt = now;

      changed = true;

    }

  }

  if (changed) save(entries);

}



export function getMistakeStats(): { total: number; corrected: number; pending: number } {

  const all = loadMistakesRaw();

  const corrected = all.filter((e) => e.corrected).length;

  return { total: all.length, corrected, pending: all.length - corrected };

}


