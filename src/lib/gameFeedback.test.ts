import { beforeEach, describe, expect, it } from 'vitest';
import {
  comboXpMultiplier,
  getGameHudSnapshot,
  registerAnswer,
  resetGameHud,
  setGameHudPracticeMode,
  xpGainForAnswer,
  xpPenaltyForWrong,
} from './gameFeedback';

describe('combo XP', () => {
  it('scales with streak length', () => {
    expect(comboXpMultiplier(1)).toBe(1);
    expect(comboXpMultiplier(2)).toBe(1.5);
    expect(comboXpMultiplier(3)).toBe(2);
    expect(comboXpMultiplier(6)).toBe(3);
    expect(xpGainForAnswer('correct', 1)).toBe(10);
    expect(xpGainForAnswer('correct', 2)).toBe(15);
    expect(xpGainForAnswer('correct', 3)).toBe(20);
    expect(xpGainForAnswer('correct', 6)).toBe(30);
  });

  it('pays less when a hint was used', () => {
    expect(xpGainForAnswer('correct', 1, true)).toBe(5);
    expect(xpGainForAnswer('correct', 3, true)).toBe(10);
    expect(xpGainForAnswer('correct', 3, true)).toBeLessThan(xpGainForAnswer('correct', 3, false));
  });
});

describe('wrong XP penalty', () => {
  it('is harsher at higher levels', () => {
    expect(xpPenaltyForWrong(1)).toBe(4);
    expect(xpPenaltyForWrong(50)).toBeGreaterThan(xpPenaltyForWrong(1));
    expect(xpPenaltyForWrong(100)).toBe(24);
    expect(xpPenaltyForWrong(100)).toBeGreaterThan(xpPenaltyForWrong(50));
  });
});

describe('registerAnswer HUD', () => {
  beforeEach(() => {
    resetGameHud();
  });

  it('builds combo XP live and resets combo on miss', () => {
    expect(registerAnswer('correct', { silent: true })).toBe(10);
    expect(registerAnswer('correct', { silent: true })).toBe(15);
    expect(getGameHudSnapshot()).toMatchObject({ xp: 25, combo: 2, bestCombo: 2 });

    const loss = registerAnswer('wrong', { silent: true });
    expect(loss).toBeLessThan(0);
    const hud = getGameHudSnapshot();
    expect(hud.combo).toBe(0);
    expect(hud.bestCombo).toBe(2);
    expect(hud.xp).toBe(25 + loss);
  });

  it('freezes XP in practice mode', () => {
    registerAnswer('correct', { silent: true });
    setGameHudPracticeMode(true);
    expect(registerAnswer('correct', { silent: true })).toBe(0);
    expect(registerAnswer('wrong', { silent: true })).toBe(0);
    expect(getGameHudSnapshot()).toMatchObject({ xp: 10, combo: 1, bestCombo: 1 });
  });
});
