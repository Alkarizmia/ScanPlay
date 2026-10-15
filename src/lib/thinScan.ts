/** Seuil notions après extraction : en dessous → alerte (Réessayer / Continuer). */
export const THIN_SCAN_NOTION_THRESHOLD = 5;

export function isThinScanNotionCount(count: number): boolean {
  return count > 0 && count < THIN_SCAN_NOTION_THRESHOLD;
}
