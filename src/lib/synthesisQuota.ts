import { getPlan, PLAN_LIMITS } from './planLimits';
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

export function getSynthesisLimit(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].synthesesPerMonth;
}

export function getSynthesisUsed(): number {
  return readUsage().used;
}

export function getSynthesisRemaining(plan?: Plan): number {
  const limit = getSynthesisLimit(plan);
  const used = getSynthesisUsed();
  const bonus = getSynthesisBonusCredits();
  return Math.max(0, limit - used + bonus);
}

export function canUseSynthesis(plan?: Plan): boolean {
  return getSynthesisRemaining(plan) > 0;
}

export function recordSynthesisUsage(): void {
  const usage = readUsage();
  const limit = getSynthesisLimit();
  if (usage.used < limit) {
    writeUsage({ month: usage.month, used: usage.used + 1 });
    return;
  }
  consumeSynthesisBonusCredit();
}

export function synthesisQuotaLabel(plan?: Plan): string {
  const remaining = getSynthesisRemaining(plan);
  const limit = getSynthesisLimit(plan);
  return `${remaining}/${limit}`;
}
