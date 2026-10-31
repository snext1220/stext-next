/**
 * @stext/schema — シナリオ JSON（stext/2）のスキーマと型。
 *
 * Universal パッケージ: DOM・Node 固有 API に依存しない。
 * JSON Schema 本体と条件 AST の型は Phase 2 で追加する（docs/migration-plan.md §2.3, §3）。
 */

/** シナリオ JSON の `format` フィールドに入る値 */
export const SCENARIO_FORMAT = 'stext/2';

export type ScenarioFormat = typeof SCENARIO_FORMAT;

/** `format` フィールドの値が、このパッケージが扱う形式かどうか */
export function isScenarioFormat(value: unknown): value is ScenarioFormat {
  return value === SCENARIO_FORMAT;
}
