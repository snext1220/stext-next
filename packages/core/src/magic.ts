/**
 * 魔法の星コスト（旧エンジン Common.magic）。
 * stars は月・火星・水星・木星・金星・土星・太陽の順。
 */
import type { MAGIC_NAMES } from '@stext/schema';

export type MagicName = (typeof MAGIC_NAMES)[number];

export interface Magic {
  stars: readonly [number, number, number, number, number, number, number];
  description: string;
}

export const MAGIC: Readonly<Record<MagicName, Magic>> = {
  HEAL: { stars: [0, 0, 0, 1, 0, 1, 0], description: 'HPを15回復' },
  PEACE: { stars: [0, 0, 1, 0, 1, 0, 0], description: 'MPを10回復' },
  CURE: { stars: [0, 0, 0, 0, 1, 0, 1], description: '毒回復' },
  MELT: { stars: [0, 1, 0, 0, 1, 1, 1], description: '凍結を回復' },
  'STONE-FLESH': { stars: [0, 0, 0, 1, 1, 1, 1], description: '石化を回復' },
  'UN-CURCE': { stars: [2, 0, 1, 0, 0, 1, 0], description: '呪いを回復' },
  'AIR-HAND': { stars: [1, 0, 1, 0, 1, 0, 1], description: '見えない拳の衝撃で、忘却を回復' },
  RESURRECT: {
    stars: [0, 0, 0, 1, 3, 0, 1],
    description: 'HP/MP半分で復活（但し、冒険に一度だけ）',
  },
  'REDUCE-LIFE': {
    stars: [0, 1, 1, 0, 1, 1, 0],
    description: '体力を犠牲に（HP-25）、すべての状態異常を回復',
  },
  REJUVENATE: {
    stars: [0, 2, 0, 1, 0, 0, 1],
    description: '時の流れを巻き戻し（現在の判定をやり直し）',
  },
  PROTECT: { stars: [1, 0, 0, 1, 1, 0, 1], description: 'HPダメージを半減（1ターンのみ）' },
  'HOLY-WATER': { stars: [0, 0, 2, 2, 0, 0, 0], description: 'MPダメージを半減（1ターンのみ）' },
  'CHANGE-AIR': { stars: [1, 0, 0, 1, 1, 1, 0], description: '戦闘を回避（アイテムは得られない）' },
  'GIVE-VIGOR': { stars: [1, 1, 1, 0, 0, 1, 0], description: '敵の攻撃力が2倍＆取得アイテム2倍' },
  EXPLOSION: { stars: [0, 1, 0, 1, 0, 1, 2], description: '地属性の敵を全滅' },
  DELUGE: { stars: [4, 0, 0, 0, 0, 1, 0], description: '火属性の敵を全滅' },
  FREEZE: { stars: [0, 2, 0, 0, 0, 1, 2], description: '水属性の敵を全滅' },
  'DESTROY-A': { stars: [1, 0, 4, 0, 0, 0, 0], description: '風属性の敵を全滅' },
  'LIGHT-CROSS': { stars: [0, 2, 0, 2, 0, 1, 0], description: '霊属性の敵を全滅' },
  'NOILA-TEM': { stars: [1, 1, 1, 1, 1, 1, 1], description: 'すべての属性の敵を全滅' },
};

/** 星が足りていて、呪われていなければ唱えられる（UN-CURCE は呪い中でも可） */
export function canCast(name: MagicName, stars: readonly number[], state: string): boolean {
  const magic = MAGIC[name];
  if (magic.stars.some((n, i) => (stars[i] ?? 0) < n)) return false;
  return state !== 'curse' || name === 'UN-CURCE';
}
