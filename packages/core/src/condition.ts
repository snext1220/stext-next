/**
 * 条件 AST の評価。旧エンジン（sgml.js の conditionSingle と SgmlFunc）と同じ判定をする。
 */
import type { ConditionNode, StatKey } from '@stext/schema';
import { canCast, type MagicName } from './magic.js';

export interface ConditionContext {
  flags: ReadonlySet<string>;
  items: ReadonlySet<string>;
  chara: Readonly<Record<StatKey, number>> & {
    race: string;
    sex: string;
    age: string;
    /** 状態異常（なければ空文字） */
    state: string;
    job: string;
  };
  /** 月・火星・水星・木星・金星・土星・太陽の順 */
  stars: readonly number[];
  params: Readonly<Record<string, string | number>>;
  /** パラメーターの初期値 */
  paramInitial: (id: string) => string | number | undefined;
  /** 経過シーン数 */
  elapsed: number;
  /** シナリオ ID ごとの獲得済み実績 */
  results: Readonly<Record<string, readonly string[]>>;
  /** min 以上 max 以下の整数を返す */
  randomInt: (min: number, max: number) => number;
}

export function evaluateCondition(node: ConditionNode, ctx: ConditionContext): boolean {
  if ('all' in node) return node.all.every((n) => evaluateCondition(n, ctx));
  if ('any' in node) return node.any.some((n) => evaluateCondition(n, ctx));
  if ('not' in node) return !evaluateCondition(node.not, ctx);
  if ('flag' in node) return ctx.flags.has(node.flag);
  if ('item' in node) return ctx.items.has(node.item);
  if ('has' in node) return ctx.flags.has(node.has) || ctx.items.has(node.has);
  if ('result' in node) return ctx.results[node.scenario]?.includes(node.result) ?? false;
  if ('magic' in node) return canCast(node.magic as MagicName, ctx.stars, ctx.chara.state);
  if ('stars' in node) {
    if (Array.isArray(node.stars)) return node.stars.every((n, i) => (ctx.stars[i] ?? 0) >= n);
    return ctx.stars.slice(0, 7).reduce((a, b) => a + b, 0) >= node.stars;
  }
  if ('stat' in node) return compare(Number(ctx.chara[node.stat]), node);
  if ('param' in node) {
    const current = paramValue(node.param, ctx);
    if ('gte' in node) return Number(current) >= node.gte;
    return typeof node.eq === 'number' ? Number(current) === node.eq : current === node.eq;
  }
  if ('elapsed' in node) return ctx.elapsed >= node.elapsed.gte;
  if ('chara' in node) {
    const { race, sex, age, state, job } = ctx.chara;
    return [race, sex, age, state.toUpperCase(), job].includes(node.chara.toUpperCase());
  }
  return callFunction(node.fn, node.args, ctx);
}

function compare(
  v: number,
  c: { gt: number } | { gte: number } | { lt: number } | { lte: number } | { eq: number },
) {
  if ('gt' in c) return v > c.gt;
  if ('gte' in c) return v >= c.gte;
  if ('lt' in c) return v < c.lt;
  if ('lte' in c) return v <= c.lte;
  return v === c.eq;
}

/** 未設定（0 や空文字を含む）なら初期値（旧エンジンの挙動） */
function paramValue(id: string, ctx: ConditionContext) {
  return ctx.params[id] || ctx.paramInitial(id);
}

function callFunction(name: string, args: (string | number)[], ctx: ConditionContext): boolean {
  const n = (i: number) => Number(args[i]);
  switch (name) {
    case 'rand':
      return ctx.randomInt(0, 100) <= n(0);
    case 'include': {
      const ids = args.slice(1).map(String);
      return ids.filter((id) => ctx.flags.has(id) || ctx.items.has(id)).length >= n(0);
    }
    case 'range': {
      const key = String(args[0]);
      const v = key.startsWith('p')
        ? Number(ctx.params[key] ?? ctx.paramInitial(key))
        : key === 'e'
          ? ctx.elapsed
          : Number(ctx.chara[key as StatKey]);
      return n(1) <= v && v < n(2);
    }
    case 'cycle': {
      const [size, div, index] = [n(0), n(1), n(2)];
      const round = Math.floor(ctx.elapsed / size);
      const min = round * size + div * (index - 1) + 1;
      const max = round * size + div * index;
      return min <= ctx.elapsed && ctx.elapsed <= max;
    }
    default:
      throw new Error(`不明な関数です: ${name}`);
  }
}
