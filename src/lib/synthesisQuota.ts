import { getPlan, PLAN_LIMITS } from './planLimits';
import { canSpendAiBudget, recordSynthesisTokenUse } from './planUsage';
import { consumeSynthesisBonusCredit, getSynthesisBonusCredits } from './wallet';
import type { Plan } from '../types';

const USAGE_KEY = 'scanplay-synthesis-month';

interface SynthesisUsage {
  month: string;
  used: number;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function readUsage(): SynthesisUsage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { month: currentMonthKey(), used: 0 };
    const data = JSON.parse(raw) as SynthesisUsage;
    if (data.month !== currentMonthKey()) {
      return { month: currentMonthKey(), used: 0 };
    }
    return { month: data.month, used: Math.max(0, data.used ?? 0) };
  } catch {
    return { month: currentMonthKey(), used: 0 };
  }
}

function writeUsage(usage: SynthesisUsage): void {
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  void import('./sync').then((m) => m.scheduleSync());
}

/** @deprecated Monthly synth caps removed — AI envelope is the ceiling. */
export function getSynthesisLimit(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].synthesesPerMonth;
}

export function getSynthesisUsed(): number {
  return readUsage().used;
}

export function getSynthesisRemaining(plan?: Plan): number {
  if (!canSpendAiBudget(plan)) return getSynthesisBonusCredits() > 0 ? getSynthesisBonusCredits() : 0;
  return Infinity;
}

export function canUseSynthesis(plan?: Plan): boolean {
  if (getSynthesisBonusCredits() > 0) return true;
  return canSpendAiBudget(plan);
}

export function recordSynthesisUsage(): void {
  if (canSpendAiBudget()) {
    const usage = readUsage();
    writeUsage({ month: usage.month, used: usage.used + 1 });
    recordSynthesisTokenUse();
    return;
  }
  consumeSynthesisBonusCredit();
}

export function synthesisQuotaLabel(plan?: Plan): string {
  if (!canSpendAiBudget(plan)) {
    const bonus = getSynthesisBonusCredits();
    return bonus > 0 ? `${bonus}` : '0';
  }
  return '∞';
}
