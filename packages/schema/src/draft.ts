import { z } from 'zod';
import {
  AnswerChoiceSchema,
  ConditionNodeSchema,
  EffectsSchema,
  EnemySchema,
  FlagSchema,
  GoChoiceSchema,
  GroupSchema,
  ItemSchema,
  JumpChoiceSchema,
  LicenceSchema,
  MetaSchema,
  ParamSchema,
  ResultSchema,
  ScenarioSchema,
  SceneSchema,
  formatPath,
  type Issue,
} from './scenario.js';

const text = z.string();
// 旧エディターが空欄の文字列を省略して保存していたデータも復元する。
const field = text.prefault('');
const number = z.union([z.number(), z.nan(), z.literal(Infinity), z.literal(-Infinity)]);
const value = z.union([number, text]);

/** 入力途中の値は保持し、編集画面で扱う構造と型だけを検証する。 */
const DraftEffectsSchema = EffectsSchema.extend({
  items: z.array(text).optional(),
  flags: z.array(text).optional(),
  params: z.array(text).optional(),
  stars: z.union([z.array(number), text]).optional(),
  hp: value.optional(),
  mp: value.optional(),
  str: value.optional(),
  int: value.optional(),
  dex: value.optional(),
  krm: value.optional(),
  free1: value.optional(),
  free2: value.optional(),
  free3: value.optional(),
  max: EffectsSchema.shape.max
    .unwrap()
    .extend({
      hp: value.optional(),
      mp: value.optional(),
      str: value.optional(),
      int: value.optional(),
      dex: value.optional(),
      krm: value.optional(),
    })
    .optional(),
  state: text.optional(),
  result: text.optional(),
});

const DraftChoiceSchema = z.union([
  GoChoiceSchema.extend({
    label: field,
    to: z.array(text),
    if: z.union([text, ConditionNodeSchema]).optional(),
    cast: z.array(text).optional(),
    randomCacheDays: number.optional(),
  }),
  JumpChoiceSchema.extend({ allow: z.array(text) }),
  AnswerChoiceSchema.extend({ answer: field, to: field, else: field }),
]);

const DraftSceneSchema = SceneSchema.extend({
  text: field,
  choices: z.array(DraftChoiceSchema),
  effects: DraftEffectsSchema.optional(),
  enemies: z.array(text).optional(),
  nexts: z.array(text).optional(),
  rule: text.optional(),
});

const DraftScenarioSchema = ScenarioSchema.extend({
  meta: MetaSchema.extend({
    title: field,
    id: text.optional(),
    footerScene: text.optional(),
    constraint: MetaSchema.shape.constraint
      .unwrap()
      .extend({
        race: z.array(text).optional(),
        age: z.array(text).optional(),
        sex: text.optional(),
      })
      .optional(),
  }),
  items: z.array(ItemSchema.extend({ id: field, name: field })),
  flags: z.array(FlagSchema.extend({ id: field, text: field })),
  params: z.array(
    ParamSchema.extend({
      id: field,
      initial: value.optional(),
      min: number.optional(),
      max: number.optional(),
    }),
  ),
  enemies: z.array(EnemySchema.extend({ id: field, name: field, hp: value.optional() })),
  results: z.array(ResultSchema.extend({ id: field, name: field, level: number.optional() })),
  groups: z.array(
    GroupSchema.extend({ title: field, start: field, end: field, rule: text.optional() }),
  ),
  licence: z.array(LicenceSchema.extend({ name: field })),
  scenes: z.array(DraftSceneSchema),
});

export type DraftChoice = z.infer<typeof DraftChoiceSchema>;
export type DraftScene = z.infer<typeof DraftSceneSchema>;
export type DraftScenario = z.infer<typeof DraftScenarioSchema>;

export type ValidateDraftResult =
  { ok: true; scenario: DraftScenario } | { ok: false; issues: Issue[] };

/** 正式な stext/2 の検証は validateScenario で別途行う。 */
export function validateScenarioDraft(data: unknown): ValidateDraftResult {
  const result = DraftScenarioSchema.safeParse(data);
  if (result.success) return { ok: true, scenario: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: formatPath(issue.path),
      message: issue.message,
    })),
  };
}
