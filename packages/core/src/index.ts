/**
 * @stext/core — ゲームエンジン。
 *
 * Universal パッケージ: DOM・Node 固有 API に依存しない。
 * 乱数・永続化・素材パスは呼び出し側から注入する（docs/migration-plan.md §2.2）。
 * エンジン本体は Phase 3 で実装する。
 */
import { isScenarioFormat } from '@stext/schema';

export const ENGINE_VERSION = '0.0.0';

/** このエンジンが読み込める形式かどうか */
export function canLoad(scenario: { format?: unknown }): boolean {
  return isScenarioFormat(scenario.format);
}
