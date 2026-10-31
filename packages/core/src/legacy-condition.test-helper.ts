/**
 * 旧エンジン（snext1220/stext の sgml.js）の条件判定をそのまま移植したもの。
 * 新しい条件 AST の評価と結果が一致することを確かめるためだけに使う（テスト専用）。
 */
import type { ConditionContext } from './condition.js';
import { MAGIC } from './magic.js';

type Magic = readonly number[];

export function legacyJudge(orgCond: string, ctx: ConditionContext): boolean {
  let c = orgCond;
  c = c.split('#NOT#').join('!');
  c = c.split('#AND#').join('&');
  c = c.split('#OR#').join('|');
  c = c.split('#L#').join('(');
  c = c.split('#R#').join(')');
  c = c.replace(/fn:[a-z0-9]+\(.*?\)/gi, (m) => m.replace('(', '[').replace(')', ']'));
  if (c.includes('fn:') || /([&|!()]{1})/.test(c)) return Boolean(conditionFull(c, ctx));
  if (c.indexOf('-') !== 0) return conditionAllTrue(c, ctx);
  return !conditionAllTrue(c.substring(1), ctx);
}

function conditionAllTrue(org: string, ctx: ConditionContext) {
  return org.split(',').every((c) => conditionSingle(c, ctx));
}

function conditionFull(org: string, ctx: ConditionContext) {
  let evalStr = '';
  const ope = /([&|!()]{1,2})/;
  for (const c of org.split(ope)) {
    if (!c) continue;
    if (ope.test(c)) evalStr += c;
    else if (c.indexOf('-') !== 0) evalStr += conditionSingle(c, ctx);
    else evalStr += !conditionSingle(c.substring(1), ctx);
  }
  return new Function(`return (${evalStr});`)();
}

function conditionSingle(raw: string, ctx: ConditionContext): boolean {
  const cond = raw.trim();
  return Boolean(
    ctx.flags.has(cond) ||
    ctx.items.has(cond) ||
    canUseMagicByName(cond, ctx) ||
    ifParam(cond, ctx) ||
    ifStatus(cond, ctx) ||
    ifElapsed(cond, ctx) ||
    isCharaState(cond, ctx) ||
    hasStars(cond, ctx) ||
    hasResult(cond, ctx) ||
    ifFunction(cond, ctx),
  );
}

function canUseMagic(magic: Magic, ctx: ConditionContext) {
  if (magic.some((n, i) => (ctx.stars[i] ?? 0) < n)) return false;
  return ctx.chara.state !== 'curse';
}

function canUseMagicByName(name: string, ctx: ConditionContext) {
  if (name.indexOf('m') !== 0) return false;
  const magic = MAGIC[name.substring(1) as keyof typeof MAGIC];
  if (!magic) throw new TypeError('unknown magic');
  return canUseMagic(magic.stars, ctx);
}

const isNumeric = (v: string) => v.trim() !== '' && !Number.isNaN(Number(v));

function ifParam(cond: string, ctx: ConditionContext) {
  if (!cond.startsWith('p')) return false;
  const [name, value] = cond.split(':') as [string, string];
  let current = ctx.params[name];
  if (!current) current = ctx.paramInitial(name)!;
  if (value.startsWith('@')) return Number(value.substring(1)) === Number(current);
  if (!isNumeric(value)) return value === current;
  return Number(current) >= Number(value);
}

function ifStatus(cond: string, ctx: ConditionContext) {
  if (cond.indexOf('o') !== 0) return false;
  const set = cond.match(/o(hp|mp|str|int|dex|krm|freei|freeii|freeiii)\s*(\d{1,})(\+|-)?\s*/i)!;
  let key = set[1]!.toLowerCase();
  key = key.replace('freeiii', 'free3').replace('freeii', 'free2').replace('freei', 'free1');
  const v = Number(ctx.chara[key as 'hp']);
  if (!set[3]) return v >= Number(set[2]);
  if (set[3] === '-') return v < Number(set[2]);
  return v > Number(set[2]);
}

function ifElapsed(cond: string, ctx: ConditionContext) {
  if (!cond.startsWith('e')) return false;
  return ctx.elapsed >= Number(cond.substring(1));
}

function isCharaState(state: string, ctx: ConditionContext) {
  if (state.indexOf('x') !== 0) return false;
  const { race, sex, age, job } = ctx.chara;
  return [race, sex, age, ctx.chara.state.toUpperCase(), job].includes(
    state.substring(1).toUpperCase(),
  );
}

function hasStars(at: string, ctx: ConditionContext) {
  if (at.indexOf('s') !== 0) return false;
  if (at.includes(':')) {
    return at
      .substring(1)
      .split(':')
      .every((n, i) => !((ctx.stars[i] ?? 0) < Number(n)));
  }
  return ctx.stars.slice(0, 7).reduce((a, b) => a + b, 0) >= Number(at.substring(1));
}

function hasResult(result: string, ctx: ConditionContext) {
  if (result.indexOf('r') !== 0) return false;
  const parts = result.split(':');
  const info = ctx.results[parts[1]!.trim()];
  return info !== undefined ? info.includes(parts[0]!.trim()) : undefined;
}

function ifFunction(exp: string, ctx: ConditionContext) {
  const m = exp.match(/fn:(?<name>[a-z0-9]+)\[(?<args>.*?)\]/i);
  if (!m) return false;
  const args = m.groups!.args!.split(',');
  const num = (i: number) => Number(args[i]);
  switch (m.groups!.name) {
    case 'rand':
      return ctx.randomInt(0, 100) <= num(0);
    case 'include':
      return args.slice(1).filter((id) => ctx.flags.has(id) || ctx.items.has(id)).length >= num(0);
    case 'range': {
      const key = args[0]!;
      let v: number;
      if (key.startsWith('p')) v = Number(ctx.params[key] ?? ctx.paramInitial(key));
      else if (key === 'e') v = ctx.elapsed;
      else v = Number(ctx.chara[key as 'hp']);
      return num(1) <= v && v < num(2);
    }
    case 'cycle': {
      const [size, div, index] = [num(0), num(1), num(2)];
      const t = Math.floor(ctx.elapsed / size);
      return (
        t * size + div * (index - 1) + 1 <= ctx.elapsed && ctx.elapsed <= t * size + div * index
      );
    }
    default:
      throw new Error('Function Name is invalid.');
  }
}
