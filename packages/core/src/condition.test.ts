import { readFileSync } from 'node:fs';
import { parseCondition, walkCondition, MAGIC_NAMES, type ConditionNode } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { evaluateCondition, type ConditionContext } from './condition.js';
import { legacyJudge } from './legacy-condition.test-helper.js';
import { MAGIC } from './magic.js';

// snext1220/stext の43シナリオに現れる条件
const corpus = readFileSync(
  new URL('../../schema/test/legacy-conditions.txt', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((s) => s !== '');
const parsed = corpus.flatMap((s) => {
  const r = parseCondition(s);
  return r.ok ? [[s, r.node] as const] : [];
});

/** 条件に出てくる ID などを集め、ランダムな状態を作る材料にする */
const pool = {
  flags: new Set<string>(),
  items: new Set<string>(),
  params: new Set<string>(),
  results: new Map<string, Set<string>>(),
  chara: new Set<string>(),
};
for (const [, node] of parsed) {
  for (const n of walkCondition(node)) {
    if ('flag' in n) pool.flags.add(n.flag);
    if ('item' in n) pool.items.add(n.item);
    if ('has' in n) pool.flags.add(n.has);
    if ('param' in n) pool.params.add(n.param);
    if ('fn' in n && n.fn === 'include') n.args.slice(1).forEach((a) => pool.flags.add(String(a)));
    if ('result' in n) {
      if (!pool.results.has(n.scenario)) pool.results.set(n.scenario, new Set());
      pool.results.get(n.scenario)!.add(n.result);
    }
    if ('chara' in n) pool.chara.add(n.chara);
  }
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function randomContext(seed: number): ConditionContext {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const subset = (xs: Iterable<string>, p: number) => new Set([...xs].filter(() => r() < p));
  const stat = () => pick([0, 1, 3, 5, 6, 7, 8, 10, 20, 50, 100, 150, 300]);
  const fixedRoll = Math.floor(r() * 101);
  const p = r();
  return {
    flags: subset(pool.flags, p),
    items: subset(pool.items, p),
    chara: {
      hp: stat(),
      mp: stat(),
      str: stat(),
      int: stat(),
      dex: stat(),
      krm: stat(),
      free1: stat(),
      free2: stat(),
      free3: stat(),
      race: pick(['FIGHTER', 'WIZARD', 'DWARF', 'ELF']),
      sex: pick(['MALE', 'FEMALE']),
      age: pick(['YOUNG', 'ADULT', 'OLD']),
      state: pick(['', '', 'poison', 'frozen', 'stone', 'forget']),
      job: pick(['のうふ', ...pool.chara]),
    },
    stars: Array.from({ length: 7 }, () => pick([0, 0, 1, 2, 4, 8, 10])),
    params: Object.fromEntries(
      [...pool.params].map((id) => [id, pick([0, 1, 2, 3, 5, 10, 40, 60, 'Rio', 'Suzuki'])]),
    ),
    paramInitial: () => 0,
    elapsed: Math.floor(r() * 60),
    results: Object.fromEntries([...pool.results].map(([s, ids]) => [s, [...subset(ids, 0.5)]])),
    // 呼び出し順に依存しないよう、試行ごとに固定の目を返す
    randomInt: () => fixedRoll,
  };
}

describe('evaluateCondition', () => {
  it('matches the legacy engine on every corpus condition', () => {
    let compared = 0;
    let truthy = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ctx = randomContext(seed);
      for (const [source, node] of parsed) {
        let expected: boolean;
        try {
          expected = legacyJudge(source, ctx);
        } catch {
          continue; // 旧エンジンが例外で落ちる条件は比較しない
        }
        expect(evaluateCondition(node, ctx), `${source} (seed ${seed})`).toBe(expected);
        compared++;
        if (expected) truthy++;
      }
    }
    expect(compared).toBeGreaterThan(parsed.length * 50);
    // 真と偽の両方が十分に出ていること（どちらかに偏った比較になっていない）
    expect(truthy / compared).toBeGreaterThan(0.15);
    expect(truthy / compared).toBeLessThan(0.85);
  });

  it('lets UN-CURCE be cast while cursed (the legacy engine never allowed it in conditions)', () => {
    const ctx = randomContext(1);
    const cursed = {
      ...ctx,
      chara: { ...ctx.chara, state: 'curse' },
      stars: [7, 7, 7, 7, 7, 7, 7],
    };
    const node: ConditionNode = { magic: 'UN-CURCE' };
    expect(evaluateCondition(node, cursed)).toBe(true);
    expect(legacyJudge('mUN-CURCE', cursed)).toBe(false);
  });
});

describe('MAGIC', () => {
  it('covers exactly the magic names known to the schema', () => {
    expect(Object.keys(MAGIC).sort()).toEqual([...MAGIC_NAMES].sort());
  });
});
