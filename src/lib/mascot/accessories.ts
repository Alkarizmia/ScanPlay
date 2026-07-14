import type { MascotAccessoryId } from './types';

export function getLevelAccessories(level: number): MascotAccessoryId[] {
  const items: MascotAccessoryId[] = [];
  if (level >= 25) {
    items.push('crown', 'cape');
  } else if (level >= 20) {
    items.push('mortarboard');
  } else if (level >= 15) {
    items.push('glasses');
  } else if (level >= 10) {
    items.push('cap');
  } else if (level >= 5) {
    items.push('sweatband');
  }
  return items;
}

/** Seasonal accessories — lightweight, non-blocking. */
export function getSeasonalAccessories(date = new Date()): MascotAccessoryId[] {
  const month = date.getMonth() + 1;
  const items: MascotAccessoryId[] = [];
  if (month === 10) items.push('pumpkin');
  if (month === 12) items.push('santa_hat');
  if (month >= 6 && month <= 8) items.push('sunglasses');
  if (month === 9) items.push('backpack');
  return items;
}

export function getMascotAccessories(level: number, date = new Date()): MascotAccessoryId[] {
  const levelItems = getLevelAccessories(level);
  const seasonal = getSeasonalAccessories(date).filter((s) => !levelItems.includes(s));
  return [...levelItems, ...seasonal.slice(0, 1)];
}
