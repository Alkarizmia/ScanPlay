import type { SheetType } from '../types';

let currentSheetType: SheetType = 'vocab';

export function setPathSheetType(sheetType: SheetType): void {
  currentSheetType = sheetType;
}

export function getPathSheetType(): SheetType {
  return currentSheetType;
}

/** Oral / speak games only for vocab lists and course notes — not formulas or Q/A definitions. */
export function isOralAllowedForSheet(sheetType: SheetType = getPathSheetType()): boolean {
  return sheetType === 'vocab' || sheetType === 'notes';
}

/** Phrase translation with tiles — vocabulary lists only. */
export function isTranslateAllowedForSheet(sheetType: SheetType = getPathSheetType()): boolean {
  return sheetType === 'vocab';
}
