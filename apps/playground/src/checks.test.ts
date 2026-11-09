import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Scenario } from '@stext/schema';
import { findProblems } from './checks.js';

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    format: 'stext/2',
    meta: { title: '検査テスト' },
    items: [],
    flags: [],
    params: [],
    enemies: [],
    results: [],
    groups: [],
    licence: [],
    scenes: [{ id: '0', text: '', choices: [] }],
    ...overrides,
  };
}

describe('Playground scenario checks', () => {
  it('checks the tagged gods scenario without calculation errors', () => {
    const data = JSON.parse(
      readFileSync(new URL('../../../scenarios/gods/scenario.json', import.meta.url), 'utf8'),
    ) as Scenario;
    expect(findProblems(data).filter((problem) => problem.severity === 'error')).toEqual([]);
  });

  it('checks parameter initial values against both bounds', () => {
    const problems = findProblems(
      scenario({
        params: [{ id: 'p01', initial: 11, min: 0, max: 10 }],
      }),
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        path: 'params[0]',
        message: expect.stringContaining('最大値 10'),
      }),
    );
  });

  it('validates item effect syntax and reports clamped calculation results', () => {
    const problems = findProblems(
      scenario({
        params: [{ id: 'p01', initial: 5, min: 0, max: 10 }],
        items: [
          { id: 'i01', name: '薬', target: 'hp', effect: '1..0' },
          { id: 'i02', name: '鍵', target: 'param', effect: 'p01:20' },
          { id: 'i03', name: '強い薬', target: 'hp', effect: '400' },
          { id: 'i04', name: '毒薬', target: 'hp', effect: '-60' },
        ],
      }),
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        path: 'items[0].effect',
      }),
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        path: 'items[1].effect',
        message: expect.stringContaining('計算結果 25'),
      }),
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        path: 'items[2].effect',
        message: expect.stringContaining('最大値 100'),
      }),
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        path: 'items[3].effect',
        message: expect.stringContaining('0未満'),
      }),
    );
  });

  it('rejects malformed standard enemy formulas', () => {
    const problems = findProblems(
      scenario({
        enemies: [{ id: 'm01', name: '敵', attack: 'physics', func: '2Q+L' }],
      }),
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        path: 'enemies[0].func',
      }),
    );
  });

  it('reports one-hit risk and exact damage distribution for all dice outcomes', () => {
    const problems = findProblems(
      scenario({
        enemies: [{ id: 'm01', name: '巨人', attack: 'physics', func: '20L' }],
        scenes: [{ id: '0', text: '', choices: [], enemies: ['m01'], dice: '6:2' }],
      }),
    );
    const combatWarnings = problems.filter(
      (problem) => problem.severity === 'warning' && problem.path === 'scenes[0].enemies',
    );
    expect(combatWarnings).toHaveLength(2);
    expect(combatWarnings[0]?.message).toContain('特定の能力値・ダイス目で一撃死の可能性');
    expect(combatWarnings[0]?.message).toContain('出目[6,1]');
    expect(combatWarnings[1]?.message).toContain('最小20');
    expect(combatWarnings[1]?.message).toContain('平均70.0');
    expect(combatWarnings[1]?.message).toContain('最大120');
  });

  it('finds one-hit risk at the highest rolled ability value', () => {
    const problems = findProblems(
      scenario({
        meta: { title: '検査テスト', constraint: { race: ['FIGHTER'], sex: 'MALE' } },
        enemies: [{ id: 'm01', name: '剛腕', attack: 'physics', func: '10STR' }],
        scenes: [{ id: '0', text: '', choices: [], enemies: ['m01'] }],
      }),
    );
    const warning = problems.find(
      (problem) =>
        problem.severity === 'warning' &&
        problem.path === 'scenes[0].enemies' &&
        problem.message.includes('一撃死'),
    );
    expect(warning?.message).toContain('STR=9');
    expect(warning?.message).toContain('初期HP下限85に対し90ダメージ');
  });

  it('enumerates five-dice scenes and analyzes MP-only attacks without reporting death', () => {
    const problems = findProblems(
      scenario({
        enemies: [{ id: 'm01', name: '魔術師', attack: 'magic', func: '20L' }],
        scenes: [{ id: '0', text: '', choices: [], enemies: ['m01'], dice: '8:5' }],
      }),
    );
    const combatWarnings = problems.filter(
      (problem) => problem.severity === 'warning' && problem.path === 'scenes[0].enemies',
    );
    expect(combatWarnings).toHaveLength(1);
    expect(combatWarnings[0]?.message).toContain('最小20');
    expect(combatWarnings[0]?.message).toContain('平均90.0');
    expect(combatWarnings[0]?.message).toContain('最大160');
    expect(combatWarnings[0]?.message).not.toContain('一撃死');
  });

  it('skips numerical analysis for custom enemy attack types', () => {
    const problems = findProblems(
      scenario({
        enemies: [{ id: 'm01', name: '独自敵', attack: '独自攻撃', func: '独自の判定' }],
        scenes: [{ id: '0', text: '', choices: [], enemies: ['m01'] }],
      }),
    );
    expect(problems.filter((problem) => problem.path.startsWith('enemies['))).toEqual([]);
    expect(problems.filter((problem) => problem.path === 'scenes[0].enemies')).toEqual([]);
  });
});
