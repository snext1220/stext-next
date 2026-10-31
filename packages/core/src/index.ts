/**
 * @stext/core — ゲームエンジン。
 *
 * Universal パッケージ: DOM・Node 固有 API に依存しない。
 * 乱数・ランダム遷移の保持先などは呼び出し側から注入する（docs/migration-plan.md §2.2）。
 */
import { isScenarioFormat } from '@stext/schema';

export const ENGINE_VERSION = '0.1.0';

/** このエンジンが読み込める形式かどうか */
export function canLoad(scenario: { format?: unknown }): boolean {
  return isScenarioFormat(scenario.format);
}

export {
  createEngine,
  type ChooseResult,
  type ChoiceView,
  type Engine,
  type EngineOptions,
  type RandomCache,
  type SceneView,
  type Step,
} from './engine.js';
export {
  GLOBAL_SAVE_KEY,
  availableJobs,
  emptyGlobalState,
  newGameState,
  readLegacyGlobal,
  readLegacySave,
  type Character,
  type GameState,
  type GlobalState,
} from './state.js';
export type { GameEvent } from './effects.js';
export {
  applyDrop,
  attackEnemy,
  computeDamage,
  diceAt,
  dropFor,
  effectiveStats,
  enemyHp,
  judgeEscape,
  receiveAttack,
  rollDice,
  selectFunc,
  type AttackResult,
  type DiceRoll,
  type Drop,
} from './battle.js';
export { expandText, type ExpandedText } from './text.js';
export { pick, pickByWeight, randomInt, seededRandom, type RandomSource } from './random.js';
export * from './data.js';
export { MAGIC, canCast, type Magic, type MagicName } from './magic.js';
export { evaluateCondition, type ConditionContext } from './condition.js';
export { LEVEL_POINTS, RANKS, playerRank, type PlayerRank, type RankScenario } from './rank.js';
