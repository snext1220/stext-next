/**
 * @stext/convert — 旧形式から stext/2 への一方向変換。
 *
 * Universal パッケージ: XML の解析には pure JavaScript のパーサ（fast-xml-parser）を使い、
 * ブラウザでも Node でも同じコードで動く。
 */
import { SCENARIO_FORMAT } from '@stext/schema';
import { readPlaygroundJson, readScenarioXml } from './legacy.js';
import { toV2, type ConvertOptions, type ConvertResult } from './to-v2.js';

/** 変換元として扱う形式 */
export const SOURCE_FORMATS = ['scenario-xml', 'playground-json'] as const;

export type SourceFormat = (typeof SOURCE_FORMATS)[number];

/** 変換先の形式 */
export const TARGET_FORMAT = SCENARIO_FORMAT;

/** scenario.xml の文字列を変換する */
export function convertScenarioXml(xml: string, options?: ConvertOptions): ConvertResult {
  return toV2(readScenarioXml(xml), options);
}

/** Playground の JSON（edges 形式）を変換する */
export function convertPlaygroundJson(json: unknown, options?: ConvertOptions): ConvertResult {
  return toV2(readPlaygroundJson(json), options);
}

export {
  readPlaygroundJson,
  readScenarioXml,
  type LegacyNode,
  type LegacyScenario,
} from './legacy.js';
export {
  DEFAULT_SCHEMA_URL,
  toV2,
  type ConvertOptions,
  type ConvertResult,
  type ConvertStats,
} from './to-v2.js';
