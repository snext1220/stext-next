/**
 * シーンに入ったときの効果の適用。旧エンジン（sgml.js）の Util.updateXxx と同じ計算をする。
 * 関数は渡された状態を直接書き換える（engine.ts が複製した状態を渡す）。
 */
import type { Effects, Scenario } from '@stext/schema';
import { STAR_IDS, type StarId } from './data.js';
import { pickByWeight, randomInt, type RandomSource } from './random.js';
import type { GameState, GlobalState } from './state.js';

/** エンジンが UI に伝える出来事（トースト表示などに使う） */
export type GameEvent =
  | { type: 'itemGained'; id: string }
  | { type: 'itemLost'; id: string }
  | { type: 'resultUnlocked'; id: string }
  | { type: 'stateGuarded'; state: string; bonus: string }
  | { type: 'stoneDeath' }
  | { type: 'forgetCured' }
  | { type: 'notEnoughStars' }
  | { type: 'itemUsed'; id: string }
  | { type: 'itemNotUsable'; id: string }
  | { type: 'bonusAwarded'; id: string }
  | { type: 'warning'; message: string };

interface ParamDef {
  initial: string | number | undefined;
  min: number | undefined;
  max: number | undefined;
}

/** パラメーターの定義。アイテムの個数用の p<アイテムID> も含む（旧エンジン params_map） */
export function paramDefinitions(scenario: Scenario): Map<string, ParamDef> {
  const defs = new Map<string, ParamDef>();
  for (const p of scenario.params) defs.set(p.id, { initial: p.initial, min: p.min, max: p.max });
  // アイテムの個数は 0〜99 だが、旧エンジンでは min が数値の 0 だったため上下限の丸めが働いていなかった
  for (const i of scenario.items)
    defs.set(`p${i.id}`, { initial: 0, min: undefined, max: undefined });
  return defs;
}

export interface EffectContext {
  state: GameState;
  global: GlobalState;
  scenarioId: string;
  params: Map<string, ParamDef>;
  hiddenFlags: ReadonlySet<string>;
  random: RandomSource;
  events: GameEvent[];
}

/** シーンの効果を旧エンジンと同じ順序で適用する（ボーナスと状態異常の経過も含む） */
export function applySceneEffects(ctx: EffectContext, effects: Effects | undefined) {
  const e = effects ?? {};
  updateItems(ctx, e.items);
  updateFlags(ctx, e.flags);
  if (e.params) updateParams(ctx, e.params);
  updateStars(ctx, e.stars);
  updateMax(ctx, e.max);
  updateHpMp(ctx, e.hp, e.mp);
  updateStats(ctx, e);
  updateFrees(ctx, e);
  if (e.state !== undefined) updateState(ctx, e.state);
  tickState(ctx);
  if (e.result) unlockResult(ctx, e.result);
  tickBonus(ctx);
}

/** パラメーターの現在値。未設定（0 や空文字も含む）なら初期値 */
export function paramValue(ctx: Pick<EffectContext, 'state' | 'params'>, id: string) {
  const v = ctx.state.params[id];
  return v === undefined || v === null ? ctx.params.get(id)?.initial : v;
}

export function updateItems(ctx: EffectContext, ops: string[] | undefined) {
  for (const raw of ops ?? []) {
    let item = raw.trim();
    if (item.includes(':')) {
      // 個数付き（i01:2、i01:@3）：p<アイテムID> を更新し、0 以下になったら消す
      updateParams(ctx, [`p${item}`]);
      const id = item.split(':')[0]!;
      item = Number(paramValue(ctx, `p${id}`)) <= 0 ? `-${id}` : id;
    }
    if (item.startsWith('-')) {
      const id = item.slice(1);
      if (ctx.state.items.includes(id)) ctx.events.push({ type: 'itemLost', id });
      ctx.state.items = ctx.state.items.filter((x) => x !== id);
    } else if (!ctx.state.items.includes(item)) {
      ctx.state.items.push(item);
      ctx.events.push({ type: 'itemGained', id: item });
    }
  }
}

export function updateFlags(ctx: EffectContext, ops: string[] | undefined) {
  for (const raw of ops ?? []) {
    const flag = raw.trim();
    if (flag.startsWith('-')) {
      const id = flag.slice(1);
      // 消せるのは隠しフラグだけ
      if (ctx.hiddenFlags.has(id)) ctx.state.flags = ctx.state.flags.filter((x) => x !== id);
      else ctx.events.push({ type: 'warning', message: `${id}：隠しフラグ以外は削除できません。` });
    } else if (!ctx.state.flags.includes(flag)) {
      ctx.state.flags.push(flag);
    }
  }
}

/** p01:1（加算）、p01:@5（代入）、p01:文字列（代入） */
export function updateParams(ctx: Pick<EffectContext, 'state' | 'params'>, ops: readonly string[]) {
  for (const op of ops) {
    const [name = '', value = ''] = op.split(':');
    const def = ctx.params.get(name);
    let current: string | number | undefined = ctx.state.params[name];
    if (!current) current = def?.initial;
    if (Number.isNaN(Number(value)) && !value.startsWith('@')) {
      current = value;
    } else {
      current = value.startsWith('@') ? Number(value.slice(1)) : Number(current) + Number(value);
      if (def?.min !== undefined && def.max !== undefined) {
        if (current < def.min) current = def.min;
        else if (current > def.max) current = def.max;
      }
    }
    ctx.state.params[name] = current;
  }
}

function updateStars(ctx: EffectContext, stars: Effects['stars']) {
  if (stars === undefined) return;
  const s = ctx.state.stars;
  if (Array.isArray(stars)) {
    stars.forEach((v, i) => {
      s[i] = Math.max(0, Number(s[i] ?? 0) + v);
    });
  } else {
    const n = Number(stars.slice(3));
    for (let i = 0; i < 7; i++) s[i] = Math.floor(Number(s[i] ?? 0) / n);
  }
}

/** "-5..-1" なら範囲内の乱数、それ以外は数値 */
function amount(ctx: EffectContext, v: number | string): number {
  const [a, b] = String(v).split('..');
  return b !== undefined ? randomInt(ctx.random, Number(a), Number(b)) : Number(a);
}

function updateMax(ctx: EffectContext, max: Effects['max']) {
  if (!max) return;
  const c = ctx.state.chara;
  const keys = {
    hp: 'hp_m',
    mp: 'mp_m',
    str: 'str_i',
    int: 'int_i',
    dex: 'dex_i',
    krm: 'krm_i',
  } as const;
  for (const [k, prop] of Object.entries(keys) as [
    keyof typeof keys,
    (typeof keys)[keyof typeof keys],
  ][]) {
    const v = max[k];
    if (v !== undefined && v !== 0) c[prop] = Number(c[prop]) + amount(ctx, v);
  }
}

export function updateHpMp(
  ctx: EffectContext,
  hp: number | string | undefined,
  mp: number | string | undefined,
) {
  const c = ctx.state.chara;
  for (const [v, cur, max] of [
    [hp, 'hp', 'hp_m'],
    [mp, 'mp', 'mp_m'],
  ] as const) {
    if (v === undefined || v === 0 || v === '') continue;
    if (v === 'full') c[cur] = c[max];
    else if (v === 'half') c[cur] = Math.floor(c[max] / 2);
    else c[cur] = Math.min(c[max], Number(c[cur]) + amount(ctx, v));
  }
}

export function updateStats(ctx: EffectContext, e: Pick<Effects, 'str' | 'int' | 'dex' | 'krm'>) {
  const c = ctx.state.chara;
  for (const k of ['str', 'int', 'dex', 'krm'] as const) {
    const v = e[k];
    if (v === undefined || v === 0) continue;
    if (v === 'full') c[k] = c[`${k}_i`];
    else if (String(v).startsWith('@')) c[k] = Number(String(v).slice(1));
    else c[k] = Number(c[k]) + Number(v);
  }
}

export function updateFrees(ctx: EffectContext, e: Pick<Effects, 'free1' | 'free2' | 'free3'>) {
  const c = ctx.state.chara;
  for (const k of ['free1', 'free2', 'free3'] as const) {
    const v = e[k];
    if (v === undefined || v === 0) continue;
    if (String(v).startsWith('@')) c[k] = Number(String(v).slice(1));
    else c[k] = Number(c[k]) + amount(ctx, v);
  }
}

/** ボーナスアイテムが防ぐ状態異常 */
const GUARDS: Record<string, string> = {
  gi18: 'poison',
  gi19: 'curse',
  gi20: 'frozen',
  gi21: 'stone',
  gi22: 'forget',
};

/** 状態異常にする（"poison"）、解除する（"-poison"、"-all"） */
export function updateState(ctx: EffectContext, value: string): boolean {
  const c = ctx.state.chara;
  if (value.startsWith('-')) {
    const s = value.slice(1);
    if (s === 'all' || c.state === s) c.state = '';
    return true;
  }
  const bonus = ctx.state.bonus;
  if (bonus && GUARDS[bonus] === value) {
    ctx.events.push({ type: 'stateGuarded', state: value, bonus });
    return false;
  }
  c.state = value;
  return true;
}

/** シーンごとの状態異常の経過（旧エンジン updateStates） */
function tickState(ctx: EffectContext) {
  const c = ctx.state.chara;
  if (c.state === 'poison') {
    c.hp -= 1;
    c.stone_scene = 0;
    c.poison_scene = 0;
  } else if (c.state === 'stone') {
    c.stone_scene += 1;
    c.forget_scene = 0;
    if (c.stone_scene === 30) ctx.events.push({ type: 'stoneDeath' });
  } else if (c.state === 'forget') {
    c.forget_scene += 1;
    c.stone_scene = 0;
    if (c.forget_scene === 20) {
      c.forget_scene = 0;
      ctx.events.push({ type: 'forgetCured' });
      updateState(ctx, '-forget');
    }
  } else {
    c.stone_scene = 0;
    c.forget_scene = 0;
  }
}

export function unlockResult(ctx: EffectContext, id: string) {
  const results = (ctx.global.results[ctx.scenarioId] ??= []);
  if (!results.includes(id)) {
    results.push(id);
    ctx.events.push({ type: 'resultUnlocked', id });
  }
}

/** シーンごとのボーナス（旧エンジン Bonus.updateStatusByBonus） */
function tickBonus(ctx: EffectContext) {
  const hit = (weights: number[]) => pickByWeight(ctx.random, weights);
  switch (ctx.state.bonus) {
    case 'gi08':
      if (hit([0.3]) === 0) updateHpMp(ctx, 1, 0);
      break;
    case 'gi09':
      if (hit([0.3]) === 0) updateHpMp(ctx, 0, 1);
      break;
    case 'bgi01': {
      const r = hit([0.3, 0.4]);
      if (r === 0) updateHpMp(ctx, -1, 0);
      else if (r === 1) updateHpMp(ctx, 0, 1);
      break;
    }
    case 'bgi02': {
      const r = hit([0.3, 0.4]);
      if (r === 0) updateHpMp(ctx, 0, -1);
      else if (r === 1) updateHpMp(ctx, 1, 0);
      break;
    }
  }
}

/** 冒険開始時のボーナス（旧エンジン Bonus.initBonusStatus） */
export function applyStartBonus(ctx: EffectContext) {
  const star = (id: StarId, n: number) => {
    const i = STAR_IDS.indexOf(id);
    ctx.state.stars[i] = Number(ctx.state.stars[i] ?? 0) + n;
  };
  const b = ctx.state.bonus;
  const starBonus: Record<string, StarId> = {
    gi01: 'mon',
    gi02: 'tue',
    gi03: 'wed',
    gi04: 'thu',
    gi05: 'fri',
    gi06: 'sat',
    gi07: 'sun',
  };
  if (b && starBonus[b]) star(starBonus[b], 5);
  else if (b === 'gi10') updateStats(ctx, { str: 1 });
  else if (b === 'gi11') updateStats(ctx, { int: 1 });
  else if (b === 'gi23') STAR_IDS.forEach((id) => star(id, 1));
  else if (b === 'bgi03') updateState(ctx, 'curse');
  else if (b === 'bgi04') updateState(ctx, 'poison');
  else if (b === 'bgi05') updateState(ctx, 'forget');
}

/** 星を一つ指定して増減する（ドロップや魔法シートで使う） */
export function addStar(state: GameState, id: StarId, n: number) {
  const i = STAR_IDS.indexOf(id);
  state.stars[i] = Number(state.stars[i] ?? 0) + n;
}
