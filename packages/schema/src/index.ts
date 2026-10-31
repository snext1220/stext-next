/**
 * @stext/schema — シナリオ JSON（stext/2）のスキーマ・型・条件式。
 *
 * Universal パッケージ: DOM・Node 固有 API に依存しない。
 * 設計は docs/migration-plan.md §2.3（条件式）、§3（シナリオ JSON）。
 */
export * from './condition.js';
export * from './scenario.js';
export * from './check.js';

import { SCENARIO_FORMAT, type ScenarioFormat } from './scenario.js';

/** `format` フィールドの値が、このパッケージが扱う形式かどうか */
export function isScenarioFormat(value: unknown): value is ScenarioFormat {
  return value === SCENARIO_FORMAT;
}
