import type { MagicName } from '@stext/core';

type EffectInfo = {
  mode: '自動' | '手動';
  detail?: string;
};

const automatic: EffectInfo = { mode: '自動' };
const enemyMagic: EffectInfo = {
  mode: '手動',
  detail: '対象の敵の全滅は自動反映されません。撃破チェックは目印で、敵HPや戦利品は変わりません。',
};

export const MAGIC_AUTOMATION: Record<MagicName, EffectInfo> = {
  HEAL: automatic,
  PEACE: automatic,
  CURE: automatic,
  MELT: automatic,
  'STONE-FLESH': automatic,
  'UN-CURCE': automatic,
  'AIR-HAND': automatic,
  RESURRECT: {
    mode: '自動',
    detail:
      'HP・MPは最大値の半分（端数切り捨て）に設定され、現在値より下がることもあります。回復は自動ですが、冒険中１回の使用は自分で管理してください。',
  },
  'REDUCE-LIFE': automatic,
  REJUVENATE: {
    mode: '手動',
    detail: '判定のやり直しを自分で扱います。反映済みの結果は自動では取り消されません。',
  },
  PROTECT: {
    mode: '手動',
    detail: 'HPダメージを受けるとき［操作］の倍率を1/2にし、１ターン後に戻します。',
  },
  'HOLY-WATER': {
    mode: '手動',
    detail: 'MPダメージを受けるとき［操作］の倍率を1/2にし、１ターン後に戻します。',
  },
  'CHANGE-AIR': {
    mode: '手動',
    detail: '戦闘を回避し、戦利品を得ない扱いを自分で判断します。',
  },
  'GIVE-VIGOR': {
    mode: '手動',
    detail: '敵の攻撃力２倍と戦利品２倍を自分で扱います。戦利品は自動では倍増しません。',
  },
  EXPLOSION: enemyMagic,
  DELUGE: enemyMagic,
  FREEZE: enemyMagic,
  'DESTROY-A': enemyMagic,
  'LIGHT-CROSS': enemyMagic,
  'NOILA-TEM': enemyMagic,
};

const halfRecovery: EffectInfo = {
  mode: '手動',
  detail: '［ステータスを編集］で回復を反映し、冒険中１回の使用を自分で管理します。',
};
const evadeBattle: EffectInfo = {
  mode: '手動',
  detail: 'ダイス条件、戦闘回避と戦利品の扱いを自分で判断します。',
};

export const BONUS_AUTOMATION: Record<string, EffectInfo | undefined> = {
  gi01: automatic,
  gi02: automatic,
  gi03: automatic,
  gi04: automatic,
  gi05: automatic,
  gi06: automatic,
  gi07: automatic,
  gi08: automatic,
  gi09: automatic,
  gi10: automatic,
  gi11: automatic,
  gi12: halfRecovery,
  gi13: halfRecovery,
  gi14: automatic,
  gi15: automatic,
  gi16: evadeBattle,
  gi17: evadeBattle,
  gi18: automatic,
  gi19: automatic,
  gi20: automatic,
  gi21: automatic,
  gi22: automatic,
  gi23: automatic,
  bgi01: automatic,
  bgi02: automatic,
  bgi03: {
    mode: '自動',
    detail:
      '開始時の呪いは自動です。解除後の星を消費しない攻撃魔法と３回の制限は自動対応していません。［唱える］には必要な星が必要で、通常どおり消費します。',
  },
  bgi04: {
    mode: '自動',
    detail:
      '開始時の毒は自動です。毒を解除するまで、魔法ダメージを受けるとき［操作］の倍率を1/2にし、効果終了後に戻します。',
  },
  bgi05: {
    mode: '自動',
    detail:
      '開始時の忘却は自動です。忘却の解除時に０だった能力値の回復は［ステータスを編集］で反映します。',
  },
};
