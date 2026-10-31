import type { ScenarioEntry } from './data.js';

/** 共通 BGM（assets/common/bgm/。シナリオでは @field05 のように指定する）の分類 */
export const BGM_GROUPS: readonly { label: string; tracks: readonly string[] }[] = [
  { label: 'フィールド', tracks: ['field01', 'field02', 'field03', 'field04', 'field05'] },
  { label: '町', tracks: ['town01', 'town02', 'town03'] },
  { label: '城', tracks: ['castle01'] },
  { label: '会話', tracks: ['talk01', 'talk02'] },
  { label: '戦闘', tracks: ['battle01', 'battle01d', 'battle02', 'battle02d', 'battle03'] },
  { label: 'エンディング', tracks: ['end01', 'end01d', 'end02', 'end03'] },
  { label: '幕末', tracks: ['n30j001', 'n30j002', 'n30j003', 'n30j004'] },
];

/** 共通の効果音（assets/common/se/） */
export const SOUND_EFFECTS: readonly (readonly [name: string, label: string])[] = [
  ['dice', 'ダイス'],
  ['damage', 'ダメージ'],
  ['guard', '回避'],
  ['drop', '戦利品'],
  ['magic', '魔法'],
  ['state', '状態異常'],
];

/** 曲ごとに、その曲を使っている書庫のシナリオ（書庫の並び順） */
export function bgmUsage(entries: readonly ScenarioEntry[]): Map<string, ScenarioEntry[]> {
  const usage = new Map<string, ScenarioEntry[]>();
  for (const e of entries) {
    if (!e.listed) continue;
    for (const name of e.bgm ?? []) {
      const list = usage.get(name) ?? [];
      list.push(e);
      usage.set(name, list);
    }
  }
  return usage;
}
