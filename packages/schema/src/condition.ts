/**
 * 条件式：構造化した条件 AST と、旧エンジンの文字列記法との相互変換。
 *
 * 文字列記法の解釈は旧エンジン（snext1220/stext の stext/sgml.js
 * judgeMultiCondition / conditionSingle）の挙動に合わせている。
 * 詳細は docs/migration-plan.md §2.3。
 */

/** 魔法名（旧エンジン Common.magic のキー） */
export const MAGIC_NAMES = [
  'HEAL',
  'PEACE',
  'CURE',
  'MELT',
  'STONE-FLESH',
  'UN-CURCE',
  'AIR-HAND',
  'RESURRECT',
  'REDUCE-LIFE',
  'REJUVENATE',
  'PROTECT',
  'HOLY-WATER',
  'CHANGE-AIR',
  'GIVE-VIGOR',
  'EXPLOSION',
  'DELUGE',
  'FREEZE',
  'DESTROY-A',
  'LIGHT-CROSS',
  'NOILA-TEM',
] as const;

export const STAT_KEYS = ['hp', 'mp', 'str', 'int', 'dex', 'krm', 'free1', 'free2', 'free3'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const CONDITION_FUNCTIONS = ['rand', 'include', 'range', 'cycle'] as const;
export type ConditionFunction = (typeof CONDITION_FUNCTIONS)[number];

/** 数値の比較（いずれか一つを指定する） */
export type Comparison =
  | { gt: number }
  | { gte: number }
  | { lt: number }
  | { lte: number }
  | { eq: number };

export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { not: ConditionNode }
  /** フラグが立っている */
  | { flag: string }
  /** アイテムを持っている */
  | { item: string }
  /** フラグまたはアイテムを持っている（シナリオに定義がない ID。旧記法の互換用） */
  | { has: string }
  /** 実績を獲得済み（シナリオ横断） */
  | { result: string; scenario: string }
  /** その魔法を唱えられる */
  | { magic: string }
  /** 星を所持している（配列は月・火星・水星・木星・金星・土星・太陽の順の個別数、数値は総数） */
  | { stars: number[] | number }
  /** 能力値の比較 */
  | ({ stat: StatKey } & Comparison)
  /** パラメーターの比較（数値は eq / gte、文字列は eq のみ） */
  | { param: string; eq: number | string }
  | { param: string; gte: number }
  /** 経過シーン数 */
  | { elapsed: { gte: number } }
  /** 種族・性別・年齢・状態異常・職業のいずれかが一致 */
  | { chara: string }
  /** 組み込み関数 */
  | { fn: ConditionFunction; args: (string | number)[] };

/** シナリオの条件フィールド：文字列記法または条件 AST */
export type Condition = string | ConditionNode;

export interface ParseOptions {
  /** シナリオで定義されたフラグ ID。指定すると ID の種類をこれで判定する */
  flags?: Iterable<string>;
  /** シナリオで定義されたアイテム ID */
  items?: Iterable<string>;
}

export type ParseResult = { ok: true; node: ConditionNode } | { ok: false; error: string };

export class ConditionSyntaxError extends Error {
  override name = 'ConditionSyntaxError';
}

const ALIASES: [string, string][] = [
  ['#NOT#', '!'],
  ['#AND#', '&'],
  ['#OR#', '|'],
  ['#L#', '('],
  ['#R#', ')'],
];

const FN_RE = /^fn:([a-z0-9]+)[([](.*?)[)\]]$/i;
const STAT_RE = /^o(hp|mp|str|int|dex|krm|freeiii|freeii|freei)\s*(\d+)\s*([+-])?$/i;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const FREE_NAMES: Record<string, StatKey> = { freei: 'free1', freeii: 'free2', freeiii: 'free3' };

/** 文字列記法の条件を AST に変換する。構文エラーは ok: false で返す */
export function parseCondition(source: string, options: ParseOptions = {}): ParseResult {
  try {
    return { ok: true, node: parseConditionOrThrow(source, options) };
  } catch (e) {
    if (e instanceof ConditionSyntaxError) return { ok: false, error: e.message };
    throw e;
  }
}

export function parseConditionOrThrow(source: string, options: ParseOptions = {}): ConditionNode {
  const flags = options.flags ? new Set(options.flags) : undefined;
  const items = options.items ? new Set(options.items) : undefined;
  let s = source.trim();
  for (const [from, to] of ALIASES) s = s.split(from).join(to);
  if (s === '') throw new ConditionSyntaxError('条件が空です');

  const atom = (raw: string) => parseAtom(raw, flags, items);

  // 演算子も関数もなければ、カンマ区切りの「すべて」（先頭が - なら全体の否定）
  if (!/fn:/i.test(s) && !/[&|!()]/.test(s)) {
    const negate = s.startsWith('-');
    const parts = (negate ? s.slice(1) : s).split(',').map((p) => p.trim());
    if (parts.some((p) => p === '')) throw new ConditionSyntaxError(`空の項目があります: ${source}`);
    if (parts.some((p) => p.startsWith('-'))) {
      // 旧エンジンでは「-f01」がそういう名前の ID として扱われ、常に偽になっていた
      throw new ConditionSyntaxError(
        `カンマ区切りの途中の「-」は否定になりません（旧エンジンでは常に偽）。「&」と「!」で書き直してください: ${source}`,
      );
    }
    const nodes = parts.map(atom);
    const node = nodes.length === 1 ? nodes[0]! : { all: nodes };
    return negate ? { not: node } : node;
  }
  return new FullParser(s, source, atom).parse();
}

/** & | ! ( ) を使う記法。優先順位は ! > & > | */
class FullParser {
  private pos = 0;

  constructor(
    private readonly s: string,
    private readonly source: string,
    private readonly atom: (raw: string) => ConditionNode,
  ) {}

  parse(): ConditionNode {
    const node = this.or();
    this.skipSpaces();
    if (this.pos < this.s.length) this.fail(`「${this.s[this.pos]}」が余分です`);
    return node;
  }

  private or(): ConditionNode {
    const nodes = [this.and()];
    while (this.eat('|')) {
      this.eat('|');
      nodes.push(this.and());
    }
    return nodes.length === 1 ? nodes[0]! : { any: nodes.flatMap((n) => ('any' in n ? n.any : [n])) };
  }

  private and(): ConditionNode {
    const nodes = [this.unary()];
    while (this.eat('&')) {
      this.eat('&');
      nodes.push(this.unary());
    }
    return nodes.length === 1 ? nodes[0]! : { all: nodes.flatMap((n) => ('all' in n ? n.all : [n])) };
  }

  private unary(): ConditionNode {
    if (this.eat('!')) return { not: this.unary() };
    if (this.eat('(')) {
      const node = this.or();
      if (!this.eat(')')) this.fail('「)」が足りません');
      return node;
    }
    return this.operand();
  }

  private operand(): ConditionNode {
    this.skipSpaces();
    const start = this.pos;
    if (/^fn:/i.test(this.s.slice(this.pos))) {
      // 関数呼び出しは最初の閉じ括弧までを一つの項として扱う（旧エンジンと同じ）
      const close = this.s.slice(this.pos).search(/[)\]]/);
      if (close < 0) this.fail('関数の閉じ括弧がありません');
      this.pos += close + 1;
    } else {
      while (this.pos < this.s.length && !'&|!()'.includes(this.s[this.pos]!)) this.pos++;
    }
    const raw = this.s.slice(start, this.pos).trim();
    if (raw === '') this.fail('条件の項がありません');
    if (raw.startsWith('-')) return { not: this.atom(raw.slice(1)) };
    return this.atom(raw);
  }

  private eat(ch: string): boolean {
    this.skipSpaces();
    if (this.s[this.pos] === ch) {
      this.pos++;
      return true;
    }
    return false;
  }

  private skipSpaces() {
    while (this.s[this.pos] === ' ') this.pos++;
  }

  private fail(message: string): never {
    throw new ConditionSyntaxError(`${message}（${this.pos + 1}文字目）: ${this.source}`);
  }
}

function parseAtom(raw: string, flags?: Set<string>, items?: Set<string>): ConditionNode {
  const t = raw.trim();
  if (t === '') throw new ConditionSyntaxError('条件の項が空です');
  if (flags?.has(t)) return { flag: t };
  if (items?.has(t)) return { item: t };

  const fn = FN_RE.exec(t);
  if (fn) {
    const name = fn[1]!.toLowerCase();
    if (!(CONDITION_FUNCTIONS as readonly string[]).includes(name)) {
      throw new ConditionSyntaxError(`不明な関数です: ${t}`);
    }
    const args = fn[2]!.split(',').map((a) => {
      const v = a.trim();
      return NUMBER_RE.test(v) ? Number(v) : v;
    });
    return { fn: name as ConditionFunction, args };
  }
  if (t.startsWith('m') && (MAGIC_NAMES as readonly string[]).includes(t.slice(1))) {
    return { magic: t.slice(1) };
  }
  if (t.startsWith('p') && t.includes(':')) {
    const [id, value = ''] = t.split(':');
    if (value.startsWith('@')) {
      const n = value.slice(1);
      if (!NUMBER_RE.test(n)) throw new ConditionSyntaxError(`パラメーターの値が数値ではありません: ${t}`);
      return { param: id!, eq: Number(n) };
    }
    if (NUMBER_RE.test(value)) return { param: id!, gte: Number(value) };
    return { param: id!, eq: value };
  }
  if (t.startsWith('o')) {
    const m = STAT_RE.exec(t);
    if (!m) throw new ConditionSyntaxError(`能力値の条件として読めません: ${t}`);
    const key = m[1]!.toLowerCase();
    const stat = FREE_NAMES[key] ?? (key as StatKey);
    const n = Number(m[2]);
    if (m[3] === '+') return { stat, gt: n };
    if (m[3] === '-') return { stat, lt: n };
    return { stat, gte: n };
  }
  if (/^e\d+$/.test(t)) return { elapsed: { gte: Number(t.slice(1)) } };
  if (/^x.+$/.test(t)) return { chara: t.slice(1) };
  if (/^s\d+(:\d+)+$/.test(t)) return { stars: t.slice(1).split(':').map(Number) };
  if (/^s\d+$/.test(t)) return { stars: Number(t.slice(1)) };
  if (t.startsWith('r')) {
    const m = /^(r[^:]+):(.+)$/.exec(t);
    if (!m) throw new ConditionSyntaxError(`実績の条件には「:シナリオID」が必要です: ${t}`);
    return { result: m[1]!, scenario: m[2]!.trim() };
  }
  if (/^m[A-Z]/.test(t)) throw new ConditionSyntaxError(`不明な魔法です: ${t}`);
  if (/[\s,]/.test(t)) throw new ConditionSyntaxError(`条件の項として読めません: ${t}`);
  // 定義済みの一覧にない ID は接頭辞で判断し、どちらでもなければ「フラグかアイテム」とする
  if (t.startsWith('f')) return { flag: t };
  if (t.startsWith('i')) return { item: t };
  return { has: t };
}

const STAT_NAMES: Record<StatKey, string> = {
  hp: 'HP',
  mp: 'MP',
  str: 'STR',
  int: 'INT',
  dex: 'DEX',
  krm: 'KRM',
  free1: 'FREEI',
  free2: 'FREEII',
  free3: 'FREEIII',
};

/**
 * AST を文字列記法に変換する。& | ! ( ) を使う記法で出力する。
 * parseCondition の結果を format して再び parse すると、元の AST に戻る。
 */
export function formatCondition(node: ConditionNode): string {
  return fmt(node, 'top');
}

function fmt(node: ConditionNode, parent: 'top' | 'all' | 'any' | 'not'): string {
  if ('all' in node) {
    const s = node.all.map((n) => fmt(n, 'all')).join('&');
    return parent === 'not' ? `(${s})` : s;
  }
  if ('any' in node) {
    const s = node.any.map((n) => fmt(n, 'any')).join('|');
    return parent === 'all' || parent === 'not' ? `(${s})` : s;
  }
  if ('not' in node) return '!' + fmt(node.not, 'not');
  if ('flag' in node) return node.flag;
  if ('item' in node) return node.item;
  if ('has' in node) return node.has;
  if ('result' in node) return `${node.result}:${node.scenario}`;
  if ('magic' in node) return `m${node.magic}`;
  if ('stars' in node) {
    return 's' + (Array.isArray(node.stars) ? node.stars.join(':') : String(node.stars));
  }
  if ('stat' in node) {
    const o = `o${STAT_NAMES[node.stat]}`;
    if ('gte' in node) return `${o}${node.gte}`;
    if ('gt' in node) return `${o}${node.gt}+`;
    if ('lt' in node) return `${o}${node.lt}-`;
    if ('lte' in node) return `${o}${node.lte + 1}-`;
    const range = `${o}${node.eq}&${o}${node.eq + 1}-`;
    return parent === 'all' || parent === 'top' ? range : `(${range})`;
  }
  if ('param' in node) {
    if ('gte' in node) return `${node.param}:${node.gte}`;
    return typeof node.eq === 'number' ? `${node.param}:@${node.eq}` : `${node.param}:${node.eq}`;
  }
  if ('elapsed' in node) return `e${node.elapsed.gte}`;
  if ('chara' in node) return `x${node.chara}`;
  return `fn:${node.fn}(${node.args.join(',')})`;
}

/** 条件 AST に出てくる判定ノードを順にたどる */
export function* walkCondition(node: ConditionNode): Generator<ConditionNode> {
  yield node;
  if ('all' in node) for (const n of node.all) yield* walkCondition(n);
  else if ('any' in node) for (const n of node.any) yield* walkCondition(n);
  else if ('not' in node) yield* walkCondition(node.not);
}
