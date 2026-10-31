/**
 * 戦闘。旧エンジンの Battle Sheet（sgml.js の SideBar.createBattleSheet、Util.computeDamage など）と同じ計算をする。
 * ダイスを振る・ダメージを反映するといった操作は UI から一つずつ呼ぶ。
 */
import type { Enemy, Scene } from '@stext/schema';
import { STAR_NAMES, type StarId } from './data.js';
import {
  addStar,
  updateFlags,
  updateFrees,
  updateItems,
  updateParams,
  updateState,
  updateStats,
  type EffectContext,
} from './effects.js';
import { pick, randomInt, type RandomSource } from './random.js';
import type { Character } from './state.js';

/** ダイスの目。位置は L（左）、LM、M、RM、R（右） */
export interface DiceRoll {
  /** 面の数（数値）または特殊ダイスの名前（high / cheat_l / cheat_h） */
  type: number | string;
  values: number[];
}

const CUSTOM_DICE: Record<string, number[]> = {
  high: [4, 5, 6],
  cheat_l: [1, 1, 1, 2, 3, 4, 5, 6],
  cheat_h: [1, 2, 3, 4, 5, 6, 6, 6],
};

/** シーンの dice 属性（"8:5" = 8面を5個）に従ってダイスを振る。既定は6面2個 */
export function rollDice(random: RandomSource, spec?: Scene['dice']): DiceRoll {
  const [t, n] = (spec ?? '').split(':');
  const type = t ? (Number.isNaN(Number(t)) ? t : Number(t)) : 6;
  const num = n ? Number(n) : 2;
  const values = Array.from({ length: num }, () =>
    typeof type === 'number'
      ? randomInt(random, 1, type)
      : (pick(random, CUSTOM_DICE[type] ?? [1]) ?? 1),
  );
  return { type, values };
}

/** 位置記号（L / R / M / LM / RM）の目。ダイスの個数によって位置の意味が変わる */
export function diceAt(dice: readonly number[], key: string): number {
  const layouts: Record<number, string[]> = {
    2: ['L', 'R'],
    3: ['L', 'M', 'R'],
    4: ['L', 'LM', 'RM', 'R'],
    5: ['L', 'LM', 'M', 'RM', 'R'],
  };
  const i = layouts[dice.length]?.indexOf(key.toUpperCase()) ?? -1;
  return i >= 0 ? (dice[i] ?? 0) : 0;
}

/** 状態異常で補正した能力値（凍結は −2、石化は −1、忘却は STR か INT の高い方が 0） */
export function effectiveStats(c: Character) {
  const s = { str: Number(c.str), int: Number(c.int), dex: Number(c.dex), krm: Number(c.krm) };
  if (c.state === 'frozen') for (const k of ['str', 'int', 'dex', 'krm'] as const) s[k] -= 2;
  else if (c.state === 'stone') for (const k of ['str', 'int', 'dex', 'krm'] as const) s[k] -= 1;
  else if (c.state === 'forget') {
    if (s.str < s.int) s.int = 0;
    else s.str = 0;
  }
  return s;
}

/**
 * ダメージ式（例: "2L+R-STR"）を計算する。
 * multiplier は Battle Sheet の倍率（x2 / x1 / x1/2 / x1/4）。結果は切り捨て。
 */
export function computeDamage(
  func: string,
  dice: readonly number[],
  chara: Character,
  multiplier = 1,
): number {
  const re = /([+-]?)(\d*)(RM|LM|R|L|M|STR|INT|DEX|KRM|FREE1|FREE2|FREE3)?]?/gi;
  const stats = effectiveStats(chara);
  let damage = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(func)) !== null) {
    if (m[0] === '') break;
    const sign = m[1] === '-' ? -1 : 1;
    const num = m[2] ? Number(m[2]) : 1;
    const key = m[3]?.toUpperCase();
    let param = 1;
    if (key === 'L' || key === 'R' || key === 'M' || key === 'LM' || key === 'RM')
      param = diceAt(dice, key);
    else if (key === 'STR' || key === 'INT' || key === 'DEX' || key === 'KRM') {
      param = stats[key.toLowerCase() as 'str'];
    } else if (key === 'FREE1' || key === 'FREE2' || key === 'FREE3') {
      param = Number(chara[key.toLowerCase() as 'free1']);
    }
    damage += sign * num * param;
  }
  return Math.floor(damage * multiplier);
}

/** 回避の判定式（例: "DEX>2L"）。成り立てば回避成功 */
export function judgeEscape(
  func: string,
  dice: readonly number[],
  chara: Character,
  multiplier = 1,
): boolean {
  const [left = '', op, right = ''] = func.split(/([<>])/);
  const l = computeDamage(left, dice, chara, multiplier);
  const r = computeDamage(right, dice, chara, multiplier);
  return op === '<' ? l < r : l > r;
}

/** 敵のダメージ式を一つ選ぶ（カンマ区切りならランダム）。先頭の * は説明だけを表示する式 */
export function selectFunc(
  random: RandomSource,
  func: string,
): { func: string; displayOnly: boolean } {
  const displayOnly = func.startsWith('*');
  return {
    func: (pick(random, (displayOnly ? func.slice(1) : func).split(',')) ?? '').trim(),
    displayOnly,
  };
}

export interface Drop {
  /** 反映するときの値（"tue/2"、"item/i01/武器"、"free1/50/50Gold" など） */
  drop: string;
  /** 表示名 */
  name: string;
}

const ELEMENT_DROPS: Record<string, (StarId | '')[]> = {
  earth: ['thu', 'tue', 'sat', '', ''],
  fire: ['tue', 'sun', 'tue', '', ''],
  water: ['wed', 'mon', 'fri', '', ''],
  wind: ['fri', 'wed', 'mon', '', ''],
  spirit: ['sat', 'sun', 'mon', '', ''],
};

/** ドロップを決める。drop がなければ属性に応じた星（はずれもある） */
export function dropFor(random: RandomSource, enemy: Enemy): Drop | undefined {
  if (enemy.drop) {
    const drop = (pick(random, enemy.drop.split(',')) ?? '').trim();
    const parts = drop.split('/');
    const star = STAR_NAMES[parts[0] as StarId];
    if (star) return { drop, name: star + (parts[1] === '1' ? '' : `×${parts[1]}`) };
    return parts[2] ? { drop, name: parts[2] } : undefined;
  }
  if (!enemy.element) return undefined;
  const star = pick(random, ELEMENT_DROPS[enemy.element] ?? []);
  return star ? { drop: `${star}/1`, name: STAR_NAMES[star] } : undefined;
}

/** ドロップを状態に反映する（Battle Sheet の戦利品ボタン） */
export function applyDrop(ctx: EffectContext, drop: string) {
  const parts = drop.split('/');
  if (parts.length === 2) {
    addStar(ctx.state, parts[0] as StarId, Number(parts[1]));
  } else if (parts[0] === 'item') {
    updateItems(ctx, [(parts[1] ?? '').trim()]);
  } else if (parts[0] === 'flag') {
    updateFlags(ctx, [(parts[1] ?? '').trim()]);
  } else if (parts[0] === 'param') {
    updateParams(ctx, [(parts[1] ?? '').trim()]);
  } else if (parts[0] === 'free1' || parts[0] === 'free2' || parts[0] === 'free3') {
    updateFrees(ctx, { [parts[0]]: parts[1] });
  }
}

export type AttackResult =
  | {
      kind: 'damage';
      target: 'hp' | 'mp' | 'both' | 'free1' | 'free2' | 'free3';
      hp: number;
      mp: number;
      damage: number;
    }
  | { kind: 'evaded' }
  | { kind: 'stat'; stat: 'str' | 'int' | 'dex' | 'krm'; amount: number }
  | { kind: 'state'; state: string; applied: boolean }
  | { kind: 'none' };

/**
 * 敵の攻撃を受ける（Battle Sheet のダメージ式ボタン）。
 * attack は敵の攻撃方法（physics / magic / both / free1〜3 / 状態異常 / STR などの能力値攻撃）。
 */
export function receiveAttack(
  ctx: EffectContext,
  attack: string,
  func: string,
  dice: readonly number[],
  multiplier = 1,
): AttackResult {
  const c = ctx.state.chara;
  const statAttack = /(str|int|dex|krm)([0-9]{0,2})/i.exec(attack);
  if (statAttack) {
    if (judgeEscape(func, dice, c, multiplier)) return { kind: 'evaded' };
    const stat = statAttack[1]!.toLowerCase() as 'str';
    const amount = Number(statAttack[2] || 1);
    updateStats(ctx, { [stat]: -amount });
    return { kind: 'stat', stat, amount };
  }
  if (['poison', 'frozen', 'stone', 'curse', 'forget'].includes(attack)) {
    if (judgeEscape(func, dice, c, multiplier)) return { kind: 'evaded' };
    return { kind: 'state', state: attack, applied: updateState(ctx, attack) };
  }
  const raw = computeDamage(func, dice, c, multiplier);
  const damage = Math.max(0, raw);
  // ボーナス（鏡の盾・銀の竪琴）でダメージを 1 減らす
  const hp = Math.max(0, ctx.state.bonus === 'gi14' ? raw - 1 : raw);
  const mp = Math.max(0, ctx.state.bonus === 'gi15' ? raw - 1 : raw);
  switch (attack) {
    case 'physics':
      c.hp = Number(c.hp) - hp;
      return { kind: 'damage', target: 'hp', hp, mp: 0, damage };
    case 'magic':
      c.mp = Number(c.mp) - mp;
      return { kind: 'damage', target: 'mp', hp: 0, mp, damage };
    case 'both':
      c.hp = Number(c.hp) - hp;
      c.mp = Number(c.mp) - mp;
      return { kind: 'damage', target: 'both', hp, mp, damage };
    case 'free1':
    case 'free2':
    case 'free3':
      c[attack] = Number(c[attack]) - damage;
      return { kind: 'damage', target: attack, hp: 0, mp: 0, damage };
    default:
      return { kind: 'none' };
  }
}

/**
 * こちらから攻撃する（Battle Sheet の敵 HP ボタン）。新しい敵の HP を返す。
 * 敵の HP がパラメーター（"p01"）の場合は、パラメーターも更新する。
 */
export function attackEnemy(
  ctx: EffectContext,
  enemy: Enemy,
  currentHp: number,
  dice: readonly number[],
  multiplier = 1,
): { hp: number; damage: number } {
  const damage = Math.max(0, computeDamage(enemy.funcOpp ?? '', dice, ctx.state.chara, multiplier));
  const hp = Math.max(0, currentHp - damage);
  if (typeof enemy.hp === 'string' && enemy.hp.startsWith('p'))
    updateParams(ctx, [`${enemy.hp}:@${hp}`]);
  return { hp, damage };
}

/** 敵の現在の HP（パラメーター参照なら現在値） */
export function enemyHp(
  enemy: Enemy,
  paramValue: (id: string) => string | number | undefined,
): number | undefined {
  if (enemy.hp === undefined) return undefined;
  if (typeof enemy.hp === 'string') return Number(paramValue(enemy.hp) ?? 0);
  return enemy.hp;
}
