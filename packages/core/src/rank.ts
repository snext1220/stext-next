/**
 * プレイヤーランク（旧エンジン PlayerRank と同じ計算）。
 *
 * 経験値 = ボーナスアイテムの数 × 10 + クリアしたシナリオのレベル点 + 獲得した実績の数 × 2
 */
import { BONUS_ITEMS } from './data.js';
import type { GlobalState } from './state.js';

/** シナリオのレベル（1〜5）ごとのクリア得点 */
export const LEVEL_POINTS = [100, 150, 170, 180, 200] as const;

/** ランク（経験値がこの点に届くまでがそのランク） */
export const RANKS = [
  { pt: 50, en: 'Novice Adventurer', jp: '駆け出し' },
  { pt: 100, en: 'Initiate', jp: '新参者' },
  { pt: 200, en: 'Aspirant', jp: '大志を抱く者' },
  { pt: 300, en: 'Battler', jp: '戦人（いくさびと）' },
  { pt: 500, en: 'Adept', jp: '熟練者' },
  { pt: 700, en: 'Chevalier', jp: '義侠の者' },
  { pt: 1000, en: 'Conjurer', jp: '奇術師' },
  { pt: 1300, en: 'Theurgist', jp: '神々に祈る者' },
  { pt: 1600, en: 'Warrior', jp: '古つわもの' },
  { pt: 2000, en: 'Enchanter', jp: '魅了する者' },
  { pt: 2500, en: 'Warlock', jp: '七つの塔の魔術師' },
  { pt: 3000, en: 'Sorcerer', jp: 'ソーサリアン' },
  { pt: 3500, en: 'Necromancer', jp: '死者と語る者' },
  { pt: 4000, en: 'Illusionist', jp: '幻惑を魅せる者' },
  { pt: 5000, en: 'Master Lord', jp: '偉大なる領主' },
  { pt: 99999, en: 'Dragon Slayer', jp: 'ドラゴンスレイヤー' },
] as const;

/** 公開シナリオの情報（旧リポジトリの stext.xml に当たる） */
export interface RankScenario {
  id: string;
  /** レベル（1〜5） */
  level?: number;
  /** 実績の総数 */
  results: number;
  /** どれかを獲得していればクリアとみなす実績 */
  clears?: readonly string[];
}

export interface PlayerRank {
  /** ランクの番号（0 から。画像 rank<番号>.png に対応） */
  level: number;
  en: string;
  jp: string;
  /** 次のランクに必要な経験値（最高ランクでは undefined） */
  next: number | undefined;
  exp: number;
  /** 取り得る経験値の合計（実績の点は含まない。旧エンジンと同じ） */
  expAll: number;
  cleared: number;
  scenarios: number;
  bonus: number;
  bonusAll: number;
  results: number;
  resultsAll: number;
}

export function playerRank(global: GlobalState, scenarios: readonly RankScenario[]): PlayerRank {
  const bonusAll = Object.keys(BONUS_ITEMS.happy).length + Object.keys(BONUS_ITEMS.bad).length;
  let exp = global.items.length * 10;
  let expAll = bonusAll * 10;
  let cleared = 0;
  let results = 0;
  let resultsAll = 0;
  for (const s of scenarios) {
    const got = global.results[s.id] ?? [];
    const points = LEVEL_POINTS[(s.level ?? 1) - 1] ?? 0;
    if (s.clears?.some((r) => got.includes(r))) {
      exp += points;
      cleared += 1;
    }
    expAll += points;
    results += got.length;
    resultsAll += s.results;
  }
  exp += results * 2;
  const i = RANKS.findIndex((r) => exp < r.pt);
  const level = i < 0 ? RANKS.length - 1 : i;
  const rank = RANKS[level]!;
  return {
    level,
    en: rank.en,
    jp: rank.jp,
    next: i < 0 || level === RANKS.length - 1 ? undefined : rank.pt,
    exp,
    expAll,
    cleared,
    scenarios: scenarios.length,
    bonus: global.items.length,
    bonusAll,
    results,
    resultsAll,
  };
}
