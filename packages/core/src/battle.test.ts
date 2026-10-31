import type { Enemy } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import {
  applyDrop,
  attackEnemy,
  computeDamage,
  diceAt,
  dropFor,
  judgeEscape,
  receiveAttack,
  rollDice,
  selectFunc,
} from './battle.js';
import type { EffectContext } from './effects.js';
import { newGameState, emptyGlobalState } from './state.js';

const fixed = (r: number) => () => r;

function ctx(): EffectContext {
  const state = newGameState(fixed(0));
  state.chara = { ...state.chara, hp: 80, mp: 50, str: 5, int: 3, dex: 6, krm: 4, free1: 10 };
  return {
    state,
    global: emptyGlobalState(),
    scenarioId: 'demo',
    random: fixed(0),
    events: [],
    hiddenFlags: new Set(),
    params: new Map([['p01', { initial: 30, min: undefined, max: undefined }]]),
  };
}

describe('dice', () => {
  it('rolls the dice named in the scene', () => {
    expect(rollDice(fixed(0.99))).toEqual({ type: 6, values: [6, 6] });
    expect(rollDice(fixed(0), '8:5').values).toEqual([1, 1, 1, 1, 1]);
    expect(rollDice(fixed(0), 'high:3').values).toEqual([4, 4, 4]);
  });

  it('reads positions by the number of dice', () => {
    expect(diceAt([1, 2], 'R')).toBe(2);
    expect(diceAt([1, 2, 3], 'M')).toBe(2);
    expect(diceAt([1, 2, 3, 4, 5], 'RM')).toBe(4);
    expect(diceAt([1, 2], 'M')).toBe(0);
  });
});

describe('computeDamage', () => {
  const c = ctx().state.chara;
  it('evaluates damage formulas like the legacy engine', () => {
    expect(computeDamage('L+R-STR', [3, 6], c)).toBe(4);
    expect(computeDamage('2L+R-STR', [3, 6], c)).toBe(7);
    expect(computeDamage('L+R+FREE1', [1, 1], c)).toBe(12);
    expect(computeDamage('7L+7R+STR+INT+DEX+KRM-100', [6, 6], c)).toBe(2);
    expect(computeDamage('L+R-STR', [3, 6], c, 0.5)).toBe(2);
  });

  it('applies the state penalties', () => {
    expect(computeDamage('STR', [], { ...c, state: 'frozen' })).toBe(3);
    expect(computeDamage('STR+INT', [], { ...c, state: 'forget' })).toBe(3);
  });

  it('judges escapes', () => {
    expect(judgeEscape('DEX>2L', [2, 1], c)).toBe(true);
    expect(judgeEscape('DEX>2L', [4, 1], c)).toBe(false);
  });

  it('selects one of several formulas', () => {
    expect(selectFunc(fixed(0.9), 'L,R')).toEqual({ func: 'R', displayOnly: false });
    expect(selectFunc(fixed(0), '*逃げられない')).toEqual({
      func: '逃げられない',
      displayOnly: true,
    });
  });
});

describe('receiveAttack', () => {
  it('takes physical, magical and status damage', () => {
    const x = ctx();
    expect(receiveAttack(x, 'physics', 'L+R-STR', [3, 6])).toEqual({
      kind: 'damage',
      target: 'hp',
      hp: 4,
      mp: 0,
      damage: 4,
    });
    expect(x.state.chara.hp).toBe(76);
    receiveAttack(x, 'both', 'L', [2, 1]);
    expect(x.state.chara).toMatchObject({ hp: 74, mp: 48 });
    expect(receiveAttack(x, 'str2', 'DEX>2L', [6, 1])).toEqual({
      kind: 'stat',
      stat: 'str',
      amount: 2,
    });
    expect(x.state.chara.str).toBe(3);
    expect(receiveAttack(x, 'poison', 'DEX>2L', [1, 1])).toEqual({ kind: 'evaded' });
    expect(receiveAttack(x, 'poison', 'DEX>2L', [6, 1])).toEqual({
      kind: 'state',
      state: 'poison',
      applied: true,
    });
  });

  it('reduces damage with the mirror shield bonus', () => {
    const x = ctx();
    x.state.bonus = 'gi14';
    expect(receiveAttack(x, 'physics', 'L', [3, 1])).toMatchObject({ hp: 2 });
  });
});

describe('enemies', () => {
  const enemy: Enemy = { id: 'm01', name: '岩', element: 'earth', funcOpp: 'L+R+STR', hp: 'p01' };

  it('updates an enemy whose HP is a parameter', () => {
    const x = ctx();
    expect(attackEnemy(x, enemy, 30, [6, 6])).toEqual({ hp: 13, damage: 17 });
    expect(x.state.params['p01']).toBe(13);
  });

  it('drops stars by element, or the listed drop', () => {
    expect(dropFor(fixed(0), enemy)).toEqual({ drop: 'thu/1', name: '木星' });
    expect(dropFor(fixed(0.9), enemy)).toBeUndefined();
    expect(dropFor(fixed(0), { ...enemy, drop: 'sun/5' })).toEqual({
      drop: 'sun/5',
      name: '太陽×5',
    });
    expect(dropFor(fixed(0), { ...enemy, drop: 'free1/50/50Gold' })).toEqual({
      drop: 'free1/50/50Gold',
      name: '50Gold',
    });
  });

  it('applies drops', () => {
    const x = ctx();
    applyDrop(x, 'sun/5');
    applyDrop(x, 'item/i01/こいし');
    applyDrop(x, 'flag/f01/勝った');
    applyDrop(x, 'param/p01:5/経験');
    applyDrop(x, 'free1/50/50Gold');
    expect(x.state.stars[6]).toBe(5);
    expect(x.state).toMatchObject({ items: ['i01'], flags: ['f01'], params: { p01: 35 } });
    expect(x.state.chara.free1).toBe(60);
  });
});
