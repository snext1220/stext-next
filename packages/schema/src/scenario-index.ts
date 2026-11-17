/**
 * シナリオ一覧（scenarios/index.json）のスキーマ。
 *
 * プレイヤーの書庫に表示するメタデータと、エディター補完用の JSON Schema を定義する。
 */
import { z } from 'zod';

const id = z.string().min(1);

export const ScenarioIndexEntrySchema = z.strictObject({
  id: id.describe('シナリオ ID。scenarios/<id>/scenario.json の <id> と一致させます。'),
  title: z.string().describe('書庫に表示するタイトル。'),
  author: z.string().optional().describe('作者名。'),
  v2: z.boolean().optional().describe('true の場合、書庫に NText 対応マークを表示します。'),
  listed: z.boolean().describe('true の場合に書庫の候補になります。'),
  series: z.string().optional().describe('シリーズ名。'),
  tags: z.array(z.string()).optional().describe('分類。'),
  published: z.string().optional().describe('公開日。YYYY-MM-DD 形式を推奨します。'),
  updated: z.string().optional().describe('更新日。YYYY-MM-DD 形式を推奨します。'),
  level: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe('難易度。1～5 の整数です。'),
  comment: z.string().optional().describe('書庫に表示する紹介文。'),
  scenes: z.number().describe('シナリオのシーン数。'),
  results: z.number().describe('シナリオの実績数。'),
  clears: z.array(z.string()).optional().describe('いずれかを獲得するとクリアとみなす実績 ID。'),
  unpublished: z.boolean().optional().describe('true の場合、公開前として書庫に表示しません。'),
  quest: z.string().optional().describe('感想アンケートの Google フォーム ID。'),
  prologue: z.string().optional().describe('書庫の詳細に表示するプロローグ。'),
  bgm: z.array(z.string()).optional().describe('使用する共通 BGM 名。@ は付けません。'),
});

export const ScenarioIndexSchema = z.array(ScenarioIndexEntrySchema);

export type ScenarioIndexEntry = z.infer<typeof ScenarioIndexEntrySchema>;
export type ScenarioIndex = z.infer<typeof ScenarioIndexSchema>;

/** 書庫一覧編集用の JSON Schema */
export function scenarioIndexJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(ScenarioIndexSchema, { target: 'draft-2020-12' }) as Record<
    string,
    unknown
  >;
}
