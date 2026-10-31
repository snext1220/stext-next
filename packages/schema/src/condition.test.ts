import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCondition, parseCondition, parseConditionOrThrow, type ConditionNode } from './condition.js';

const p = (s: string, opts = {}) => parseConditionOrThrow(s, opts);

describe('parseCondition', () => {
  it('reads single ids by prefix', () => {
    expect(p('f01')).toEqual({ flag: 'f01' });
    expect(p('i01')).toEqual({ item: 'i01' });
    expect(p('q99')).toEqual({ has: 'q99' });
  });

  it('prefers the declared ids over prefixes', () => {
    expect(p('x01', { items: ['x01'] })).toEqual({ item: 'x01' });
    expect(p('f01', { flags: [], items: ['f01'] })).toEqual({ item: 'f01' });
  });

  it('reads a comma list as "all", and a leading - as negating the whole list', () => {
    expect(p('f01,i02')).toEqual({ all: [{ flag: 'f01' }, { item: 'i02' }] });
    expect(p('-f01,f02')).toEqual({ not: { all: [{ flag: 'f01' }, { flag: 'f02' }] } });
    expect(p('-f01')).toEqual({ not: { flag: 'f01' } });
  });

  it('reads & | ! ( ) with precedence ! > & > |', () => {
    expect(p('f01|f02&!f03')).toEqual({
      any: [{ flag: 'f01' }, { all: [{ flag: 'f02' }, { not: { flag: 'f03' } }] }],
    });
    expect(p('(f01|f02)&f03')).toEqual({
      all: [{ any: [{ flag: 'f01' }, { flag: 'f02' }] }, { flag: 'f03' }],
    });
    expect(p('f01&&f02||f03')).toEqual({ any: [{ all: [{ flag: 'f01' }, { flag: 'f02' }] }, { flag: 'f03' }] });
    expect(p('f01&-f02')).toEqual({ all: [{ flag: 'f01' }, { not: { flag: 'f02' } }] });
  });

  it('accepts the escaped aliases used inside XML', () => {
    expect(p('#NOT#f01#AND##L#f02#OR#f03#R#')).toEqual(p('!f01&(f02|f03)'));
  });

  it('reads every kind of atom', () => {
    const cases: [string, ConditionNode][] = [
      ['mHEAL', { magic: 'HEAL' }],
      ['oSTR6', { stat: 'str', gte: 6 }],
      ['oDEX6+', { stat: 'dex', gt: 6 }],
      ['oHP10-', { stat: 'hp', lt: 10 }],
      ['oFREEII3', { stat: 'free2', gte: 3 }],
      ['p01:@3', { param: 'p01', eq: 3 }],
      ['p01:10', { param: 'p01', gte: 10 }],
      ['p02:Rio', { param: 'p02', eq: 'Rio' }],
      ['e30', { elapsed: { gte: 30 } }],
      ['xPOISON', { chara: 'POISON' }],
      ['s1:0:0:1:0:0:0', { stars: [1, 0, 0, 1, 0, 0, 0] }],
      ['s10', { stars: 10 }],
      ['r01:scepter', { result: 'r01', scenario: 'scepter' }],
      ['fn:rand(50)', { fn: 'rand', args: [50] }],
      ['fn:include(2,f01,f02)', { fn: 'include', args: [2, 'f01', 'f02'] }],
    ];
    for (const [s, node] of cases) expect(p(s), s).toEqual(node);
  });

  it('keeps a function call as one operand in & | expressions', () => {
    expect(p('fn:range(str,5,10)&f01')).toEqual({
      all: [{ fn: 'range', args: ['str', 5, 10] }, { flag: 'f01' }],
    });
  });

  it('reports what the old engine could not evaluate', () => {
    for (const bad of ['', 'f01,', 'r01', 'mFOO', 'oSTRONG', 'fn:fly(1)', '(f01', 'f01)', 'f01&']) {
      expect(parseCondition(bad).ok, bad).toBe(false);
    }
  });
});

describe('formatCondition', () => {
  it('writes the & | ! syntax with the needed parentheses', () => {
    expect(formatCondition(p('(f01|f02)&!(f03&f04)'))).toBe('(f01|f02)&!(f03&f04)');
    expect(formatCondition(p('-f01,f02'))).toBe('!(f01&f02)');
    expect(formatCondition({ stat: 'krm', lte: 4 })).toBe('oKRM5-');
    expect(formatCondition({ any: [{ stat: 'int', eq: 3 }, { flag: 'f01' }] })).toBe(
      '(oINT3&oINT4-)|f01',
    );
  });
});

describe('legacy scenarios', () => {
  // snext1220/stext の43シナリオに現れる条件（選択肢と ${if}）
  const corpus = readFileSync(new URL('../test/legacy-conditions.txt', import.meta.url), 'utf8')
    .split('\n')
    .filter((s) => s !== '');

  it('parses almost every condition', () => {
    const failures = corpus.filter((s) => !parseCondition(s).ok);
    expect(corpus.length).toBeGreaterThan(1500);
    expect(failures.length / corpus.length).toBeLessThan(0.01);
  });

  it('round-trips parse → format → parse', () => {
    for (const s of corpus) {
      const r = parseCondition(s);
      if (!r.ok) continue;
      expect(p(formatCondition(r.node)), s).toEqual(r.node);
    }
  });
});
