import type { GameMode } from '../types';
import { isLoggedIn } from './auth';

const KEY = 'scanplay-exam-history';

export interface ExamStepGrade {
  stepIndex: number;
  mode: GameMode;
  pct: number;
  passed: boolean;
}

export interface ExamHistoryEntry {
  id: string;
  deckId: string;
  deckTitle: string;
  thumbnail?: string;
  finalGrade: number;
  passed: boolean;
  stepGrades: ExamStepGrade[];
  pathStepCount?: number;
  totalTimeSeconds: number;
  createdAt: string;
}

export function saveExamHistoryRaw(entries: ExamHistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function loadExamHistoryRaw(): ExamHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(entries: ExamHistoryEntry[]): void {
  if (!isLoggedIn()) return;
  localStorage.setItem(KEY, JSON.stringify(entries));
  void import('./sync').then((m) => m.scheduleSync());
}

export function getExamHistory(): ExamHistoryEntry[] {
  return loadExamHistoryRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function addExamHistoryEntry(entry: Omit<ExamHistoryEntry, 'id' | 'createdAt'>): ExamHistoryEntry {
  const full: ExamHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const entries = loadExamHistoryRaw();
  entries.unshift(full);
  save(entries.slice(0, 50));
  return full;
}

export function deleteExamHistoryEntry(id: string): void {
  save(loadExamHistoryRaw().filter((e) => e.id !== id));
  void import('./sync').then((m) => m.syncDeleteExam(id));
}
