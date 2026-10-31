/**
 * @stext/convert — 旧形式から stext/2 への一方向変換。
 *
 * Universal パッケージ: XML パーサは呼び出し側から注入する
 * （ブラウザは DOMParser、Node は任意のパーサ）。変換本体は Phase 2 で実装する。
 */
import { SCENARIO_FORMAT } from '@stext/schema';

/** 変換元として扱う形式 */
export const SOURCE_FORMATS = ['scenario-xml', 'playground-json', 'gbat'] as const;

export type SourceFormat = (typeof SOURCE_FORMATS)[number];

/** 変換先の形式 */
export const TARGET_FORMAT = SCENARIO_FORMAT;
