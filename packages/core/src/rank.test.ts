import { describe, expect, it } from 'vitest';
import { playerRank } from './rank.js';
import { emptyGlobalState } from './state.js';

const scenarios = [
  { id: 'scepter', level: 3, results: 45, clears: ['r43', 'r44'] },
  { id: 'doll', level: 1, results: 10, clears: ['r09'] },
];

describe('playerRank', () => {
  it('starts as a novice', () => {
    const r = playerRank(emptyGlobalState(), scenarios);
    expect(r).toMatchObject({
      level: 0,
      jp: '駆け出し',
      exp: 0,
      next: 50,
      cleared: 0,
      scenarios: 2,
      bonus: 0,
      bonusAll: 28,
      resultsAll: 55,
    });
    expect(r.expAll).toBe(28 * 10 + 170 + 100);
  });

  it('adds bonus items, cleared scenarios and results like the legacy engine', () => {
    const global = {
      ...emptyGlobalState(),
      items: ['gi01', 'gi02'],
      results: { scepter: ['r01', 'r43'], doll: ['r01'] },
    };
    const r = playerRank(global, scenarios);
    // ボーナス 2×10 + scepter のクリア 170 + 実績 3×2
    expect(r.exp).toBe(20 + 170 + 6);
    expect(r).toMatchObject({ level: 2, jp: '大志を抱く者', next: 200, cleared: 1, results: 3 });
  });

  it('caps at the highest rank', () => {
    const global = {
      ...emptyGlobalState(),
      results: { scepter: Array.from({ length: 60000 }, (_, i) => `r${i}`) },
    };
    expect(playerRank(global, scenarios)).toMatchObject({
      jp: 'ドラゴンスレイヤー',
      next: undefined,
    });
  });
});
