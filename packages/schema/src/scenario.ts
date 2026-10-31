/**
 * シナリオ JSON（stext/2）のスキーマ。
 *
 * 型（TypeScript）と JSON Schema はここから生成する。
 * 値の書き方（"full"、"-5..-1"、"@3" など）は旧形式を引き継いでいる。
 */
import { z } from 'zod';
import {
  CONDITION_FUNCTIONS,
  MAGIC_NAMES,
  STAT_KEYS,
  type Condition as ConditionType,
  type ConditionNode as ConditionNodeType,
} from './condition.js';

export const SCENARIO_FORMAT = 'stext/2';
export type ScenarioFormat = typeof SCENARIO_FORMAT;

/** 選択肢の遷移先で「直前の場面に戻る」を表す予約 ID（旧エンジンの 90000） */
export const BACK_SCENE_ID = '90000';

const id = z.string().min(1);
const text = z.string();
const num = z.number();

// ───── 条件 ─────

const comparisons = [
  z.strictObject({ gt: num }),
  z.strictObject({ gte: num }),
  z.strictObject({ lt: num }),
  z.strictObject({ lte: num }),
  z.strictObject({ eq: num }),
] as const;

export const ConditionNodeSchema: z.ZodType<ConditionNodeType> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(ConditionNodeSchema).min(1) }),
    z.strictObject({ any: z.array(ConditionNodeSchema).min(1) }),
    z.strictObject({ not: ConditionNodeSchema }),
    z.strictObject({ flag: id }),
    z.strictObject({ item: id }),
    z.strictObject({ has: id }),
    z.strictObject({ result: id, scenario: id }),
    z.strictObject({ magic: z.enum(MAGIC_NAMES) }),
    z.strictObject({ stars: z.union([z.array(z.int().min(0)).min(1).max(7), z.int().min(0)]) }),
    ...comparisons.map((c) => c.extend({ stat: z.enum(STAT_KEYS) })),
    z.strictObject({ param: id, eq: z.union([num, z.string()]) }),
    z.strictObject({ param: id, gte: num }),
    z.strictObject({ elapsed: z.strictObject({ gte: z.int().min(0) }) }),
    z.strictObject({ chara: id }),
    z.strictObject({ fn: z.enum(CONDITION_FUNCTIONS), args: z.array(z.union([z.string(), num])) }),
  ]),
);

/** 文字列記法、または条件 AST */
export const ConditionSchema: z.ZodType<ConditionType> = z.union([
  z.string().min(1),
  ConditionNodeSchema,
]);

// ───── 効果 ─────

const range = z.string().regex(/^-?\d+\.\.-?\d+$/, '「最小..最大」の形式で書きます');
const setValue = z.string().regex(/^@-?\d+$/, '「@値」の形式で書きます');

export const EffectsSchema = z.strictObject({
  /** 入手（"i01"）、消失（"-i01"）、個数の増減（"i01:2" / "i01:@3"） */
  items: z.array(id).optional(),
  /** 立てる（"f01"）、消す（"-f01"。隠しフラグのみ） */
  flags: z.array(id).optional(),
  /** パラメーターの更新（"p01:1" 加算、"p01:@5" 代入、"p01:文字列" 代入） */
  params: z.array(id).optional(),
  /** 星の増減（月・火星・水星・木星・金星・土星・太陽の順）、または "div2"（すべてを1/2、小数可） */
  stars: z.union([z.array(z.int()).min(1).max(7), z.string().regex(/^div\d+(\.\d+)?$/)]).optional(),
  hp: z.union([z.int(), z.enum(['full', 'half']), range]).optional(),
  mp: z.union([z.int(), z.enum(['full', 'half']), range]).optional(),
  str: z.union([z.int(), z.literal('full'), setValue]).optional(),
  int: z.union([z.int(), z.literal('full'), setValue]).optional(),
  dex: z.union([z.int(), z.literal('full'), setValue]).optional(),
  krm: z.union([z.int(), z.literal('full'), setValue]).optional(),
  free1: z.union([z.int(), setValue, range]).optional(),
  free2: z.union([z.int(), setValue, range]).optional(),
  free3: z.union([z.int(), setValue, range]).optional(),
  /** 最大値・初期値の増減（旧形式の hp_max など） */
  max: z
    .strictObject({
      hp: z.union([z.int(), range]).optional(),
      mp: z.union([z.int(), range]).optional(),
      str: z.union([z.int(), range]).optional(),
      int: z.union([z.int(), range]).optional(),
      dex: z.union([z.int(), range]).optional(),
      krm: z.union([z.int(), range]).optional(),
    })
    .optional(),
  /** 状態異常にする（"poison"）、解除する（"-poison"、"-all"） */
  state: z.string().regex(/^-?[a-z]+$/).optional(),
  /** 獲得する実績 */
  result: id.optional(),
});

// ───── 選択肢 ─────

const choiceBase = {
  /** 選択肢の直前に表示する文章（旧形式で選択肢の間に書かれていた文章） */
  before: text.optional(),
};

/** 通常の選択肢 */
export const GoChoiceSchema = z.strictObject({
  ...choiceBase,
  label: text,
  /** 遷移先。複数あればランダムに一つを選ぶ */
  to: z.array(id).min(1),
  /** 表示条件 */
  if: ConditionSchema.optional(),
  /** 選んだときに唱える（星を消費する）魔法 */
  cast: z.array(z.enum(MAGIC_NAMES)).optional(),
  /** ランダム遷移の結果を保持する日数 */
  randomCacheDays: z.int().positive().optional(),
});

/** 番号を入力して移動する（旧形式の [..](X)） */
export const JumpChoiceSchema = z.strictObject({
  ...choiceBase,
  kind: z.literal('jump'),
  /** 移動できる番号 */
  allow: z.array(id).min(1),
});

/** 文字を入力して答える（旧形式の [..](Q)） */
export const AnswerChoiceSchema = z.strictObject({
  ...choiceBase,
  kind: z.literal('answer'),
  answer: text,
  /** 正解のときの遷移先 */
  to: id,
  /** 不正解のときの遷移先 */
  else: id,
});

export const ChoiceSchema = z.union([GoChoiceSchema, JumpChoiceSchema, AnswerChoiceSchema]);

// ───── シーン ─────

export const SceneSchema = z.strictObject({
  id,
  summary: text.optional(),
  /** 本文（Markdown と ${...} マクロ）。選択肢は含めない */
  text,
  /** 選択肢の後ろに表示する文章 */
  afterText: text.optional(),
  choices: z.array(ChoiceSchema),
  effects: EffectsSchema.optional(),
  /** 登場する敵（同じ ID の繰り返しは複数体） */
  enemies: z.array(id).optional(),
  end: z.enum(['happy', 'bad', 'good']).optional(),
  /** 続編として案内するシナリオ */
  nexts: z.array(id).optional(),
  bgm: z.string().optional(),
  se: z.string().optional(),
  /** ルールとして表示するシーンの ID */
  rule: id.optional(),
  /** ダイスの指定（旧形式のまま） */
  dice: z.string().optional(),
  /** meta.footerScene の自動付加をしない */
  excludeFooter: z.boolean().optional(),
  /** エディター専用の情報。エンジンは使わない */
  editor: z
    .strictObject({
      x: num.optional(),
      y: num.optional(),
      level: num.optional(),
      color: z.string().optional(),
      group: z.string().optional(),
    })
    .optional(),
});

// ───── シナリオ ─────

const race = z.enum(['FIGHTER', 'WIZARD', 'DWARF', 'ELF']);

export const MetaSchema = z.strictObject({
  id: id.optional(),
  title: text,
  author: text.optional(),
  description: text.optional(),
  keywords: z.array(text).optional(),
  /** キャラクター作成の制約 */
  constraint: z
    .strictObject({
      race: z.array(race).optional(),
      age: z.array(z.enum(['YOUNG', 'ADULT', 'OLD'])).optional(),
      sex: z.enum(['MALE', 'FEMALE']).optional(),
    })
    .optional(),
  bgm: z
    .strictObject({ main: z.string().optional(), happy: z.string().optional(), bad: z.string().optional() })
    .optional(),
  /** ステータス欄の表示名の置き換え（free1 など） */
  labels: z.record(z.string(), text).optional(),
  /** 画像セット（"custom" でシナリオ独自の画像） */
  imageSet: z.string().optional(),
  /** 見出しにシーン番号ではなく summary を表示する */
  showSummary: z.boolean().optional(),
  /** すべてのシーン（excludeFooter と end のシーンを除く）の末尾に付けるシーン */
  footerScene: id.optional(),
});

export const ItemSchema = z.strictObject({
  id,
  name: text,
  text: text.optional(),
  /** 使用時に作用する対象（hp、mp、state など） */
  target: z.string().optional(),
  effect: z.string().optional(),
  /** シナリオをまたいで持ち越す */
  shared: z.boolean().optional(),
});

export const FlagSchema = z.strictObject({
  id,
  text,
  /** 隠しフラグ（一覧に出さず、効果で消せる） */
  hidden: z.boolean().optional(),
});

export const ParamSchema = z.strictObject({
  id,
  text: text.optional(),
  initial: z.union([num, z.string()]).optional(),
  min: num.optional(),
  max: num.optional(),
});

export const EnemySchema = z.strictObject({
  id,
  name: text,
  text: text.optional(),
  element: z.string().optional(),
  attack: z.string().optional(),
  /** ダメージ式 */
  func: z.string().optional(),
  /** こちらから攻撃するときの式 */
  funcOpp: z.string().optional(),
  hp: num.optional(),
  /** ドロップ（旧形式のまま） */
  drop: z.string().optional(),
});

export const ResultSchema = z.strictObject({
  id,
  name: text,
  text: text.optional(),
  level: num.optional(),
});

export const GroupSchema = z.strictObject({
  title: text,
  start: id,
  end: id,
  rule: id.optional(),
  text: text.optional(),
});

export const LicenceSchema = z.strictObject({
  name: text,
  category: z.string().optional(),
  creator: z.string().optional(),
  url: z.string().optional(),
});

export const ScenarioSchema = z.strictObject({
  $schema: z.string().optional(),
  format: z.literal(SCENARIO_FORMAT),
  meta: MetaSchema,
  items: z.array(ItemSchema),
  flags: z.array(FlagSchema),
  params: z.array(ParamSchema),
  enemies: z.array(EnemySchema),
  results: z.array(ResultSchema),
  groups: z.array(GroupSchema),
  licence: z.array(LicenceSchema),
  scenes: z.array(SceneSchema),
});

export type Effects = z.infer<typeof EffectsSchema>;
export type GoChoice = z.infer<typeof GoChoiceSchema>;
export type JumpChoice = z.infer<typeof JumpChoiceSchema>;
export type AnswerChoice = z.infer<typeof AnswerChoiceSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type Param = z.infer<typeof ParamSchema>;
export type Enemy = z.infer<typeof EnemySchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Licence = z.infer<typeof LicenceSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;

export interface Issue {
  /** 問題のある場所（例: scenes[3].choices[0].if） */
  path: string;
  message: string;
}

export type ValidateResult = { ok: true; scenario: Scenario } | { ok: false; issues: Issue[] };

/** JSON の構造をスキーマで検証する */
export function validateScenario(data: unknown): ValidateResult {
  const r = ScenarioSchema.safeParse(data);
  if (r.success) return { ok: true, scenario: r.data };
  return {
    ok: false,
    issues: r.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })),
  };
}

export function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
    .join('');
}

/** エディター補完用の JSON Schema */
export function scenarioJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(ScenarioSchema, { target: 'draft-2020-12' }) as Record<string, unknown>;
}
