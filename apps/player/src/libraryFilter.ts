/** 書庫の検索条件（旧サイトの書庫の検索フォームと同じ項目） */
import type { GlobalState } from '@stext/core';
import type { ScenarioEntry } from './data.js';

export interface LibraryFilter {
  /** シリーズ名（空ならすべて） */
  series: string;
  keyword: string;
  /** 物語の長さ */
  length: '' | 'short' | 'medium' | 'long' | 'epic';
  /** 難易度（空ならすべて） */
  level: '' | '1' | '2' | '3' | '4' | '5';
  levelOp: 'gte' | 'eq' | 'lte';
  clear: '' | 'not_clear' | 'not_complete' | 'clear' | 'complete';
  /** アンケートのあるシナリオだけ */
  quest: boolean;
  sort: 'published' | 'updated' | 'scenes' | 'results';
  order: 'desc' | 'asc';
}

export const DEFAULT_FILTER: LibraryFilter = {
  series: '',
  keyword: '',
  length: '',
  level: '',
  levelOp: 'eq',
  clear: '',
  quest: false,
  sort: 'published',
  order: 'desc',
};

export const LENGTHS = [
  { value: 'short', label: '短編（70シーン未満）' },
  { value: 'medium', label: '中編（70～200シーン）' },
  { value: 'long', label: '長編（200～500シーン）' },
  { value: 'epic', label: '大長編（500シーン以上）' },
] as const;

export const CLEAR_STATES = [
  { value: 'not_clear', label: '未クリア' },
  { value: 'not_complete', label: '未コンプリート' },
  { value: 'clear', label: 'クリア済' },
  { value: 'complete', label: 'コンプリート済' },
] as const;

export const SORT_KEYS = [
  { value: 'published', label: '公開日' },
  { value: 'updated', label: '更新日' },
  { value: 'scenes', label: 'シーン数' },
  { value: 'results', label: '実績数' },
] as const;

/** 既定から変えた条件の数（並び順は数えない） */
export function activeConditions(f: LibraryFilter): number {
  return [f.series, f.keyword.trim(), f.length, f.level, f.clear, f.quest].filter(Boolean).length;
}

/** クリアとみなす実績のどれかを獲得している */
export function isCleared(e: ScenarioEntry, global: GlobalState): boolean {
  const got = global.results[e.id] ?? [];
  return (e.clears ?? []).some((r) => got.includes(r));
}

/** 実績をすべて獲得している */
export function isComplete(e: ScenarioEntry, global: GlobalState): boolean {
  return e.results > 0 && (global.results[e.id]?.length ?? 0) >= e.results;
}

function lengthOf(scenes: number): LibraryFilter['length'] {
  if (scenes < 70) return 'short';
  if (scenes < 200) return 'medium';
  if (scenes < 500) return 'long';
  return 'epic';
}

/** 「2018-1-15」のように桁のそろっていない日付も比べられる数にする（なければ undefined） */
function dateValue(s: string | undefined): number | undefined {
  const m = /^(\d+)-(\d+)-(\d+)/.exec(s ?? '');
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : undefined;
}

function sortValue(e: ScenarioEntry, key: LibraryFilter['sort']): number | undefined {
  switch (key) {
    case 'published':
      return dateValue(e.published);
    case 'updated':
      return dateValue(e.updated);
    case 'scenes':
      return e.scenes;
    case 'results':
      return e.results;
  }
}

function matchesKeyword(e: ScenarioEntry, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [
    e.title,
    e.author,
    e.series,
    ...(e.tags ?? []),
    e.comment,
    e.prologue?.replace(/<[^>]+>/g, ''),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

/** 条件で絞り込み、並べ替える。値のないもの（公開日のないものなど）は並び順にかかわらず最後 */
export function filterScenarios(
  entries: readonly ScenarioEntry[],
  f: LibraryFilter,
  global: GlobalState,
): ScenarioEntry[] {
  const level = Number(f.level);
  const result = entries.filter((e) => {
    if (f.series && e.series !== f.series) return false;
    if (!matchesKeyword(e, f.keyword)) return false;
    if (f.length && lengthOf(e.scenes) !== f.length) return false;
    if (f.level) {
      if (e.level === undefined) return false;
      if (f.levelOp === 'gte' && e.level < level) return false;
      if (f.levelOp === 'eq' && e.level !== level) return false;
      if (f.levelOp === 'lte' && e.level > level) return false;
    }
    switch (f.clear) {
      case 'not_clear':
        if (isCleared(e, global)) return false;
        break;
      case 'not_complete':
        if (isComplete(e, global)) return false;
        break;
      case 'clear':
        if (!isCleared(e, global)) return false;
        break;
      case 'complete':
        if (!isComplete(e, global)) return false;
        break;
    }
    if (f.quest && !e.quest) return false;
    return true;
  });
  const sign = f.order === 'desc' ? -1 : 1;
  // 同じ値のものは index.json の順（公開日の新しい順）のまま
  return result
    .map((e, i) => ({ e, i, v: sortValue(e, f.sort) }))
    .sort((a, b) => {
      if (a.v === undefined || b.v === undefined)
        return a.v === b.v ? a.i - b.i : a.v === undefined ? 1 : -1;
      return (a.v - b.v) * sign || a.i - b.i;
    })
    .map(({ e }) => e);
}
