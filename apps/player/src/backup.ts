/**
 * セーブデータのバックアップ／リストア。旧エンジンの .stext ファイルも読み込む。
 *
 * - 旧形式のシナリオ一つ：中身はセーブデータの JSON そのもの
 * - 旧形式のすべて：中身は「キー」「値」を一行ずつ交互に並べたもの
 *   （キーはシナリオ ID と、実績・ボーナスを持つ sorcerian_text）
 */
import { GLOBAL_SAVE_KEY, readLegacyGlobal, readLegacySave } from '@stext/core';
import { parseSlots, slotsKey } from './storage.js';

export const ALL = 'all';

export function backupFileName(key: string, now = Date.now()): string {
  return `${key}-${now}.stext`;
}

export interface RestoreEntry {
  key: string;
  value: string;
}

export interface RestoreChange {
  key: string;
  value: string | null;
}

interface BackupScenario {
  id: string;
  auto: string | null;
  slots: string | null;
}

interface BackupV2 {
  format: 'stext-next-backup/1';
  global?: string | null;
  scenarios: BackupScenario[];
}

/** 手動スロットを含む新形式。対象シナリオの空きスロットも記録する。 */
export function createBackup(
  target: string,
  ids: readonly string[],
  get: (key: string) => string | null,
): string | null {
  const scenarios = (target === ALL ? ids : target === GLOBAL_SAVE_KEY ? [] : [target]).map(
    (id) => ({ id, auto: get(id), slots: get(slotsKey(id)) }),
  );
  const global = target === ALL || target === GLOBAL_SAVE_KEY ? get(GLOBAL_SAVE_KEY) : undefined;
  if (!global && !scenarios.some((s) => s.auto || s.slots)) return null;
  const backup: BackupV2 = {
    format: 'stext-next-backup/1',
    ...(global !== undefined ? { global } : {}),
    scenarios,
  };
  const content = JSON.stringify(backup);
  parseRestore('', content);
  return content;
}

function validateGame(value: string) {
  const state = readLegacySave(value);
  if (
    typeof state.chara !== 'object' ||
    typeof state.chara.name !== 'string' ||
    (typeof state.scene !== 'string' && typeof state.scene !== 'number') ||
    !state.stars.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    !Array.isArray(state.items) ||
    !Array.isArray(state.flags) ||
    !state.params ||
    typeof state.params !== 'object' ||
    Array.isArray(state.params)
  )
    throw new Error('セーブデータの形式が正しくありません');
}

function validateGlobal(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('基本情報の形式が正しくありません');
  const global = readLegacyGlobal(value);
  if (
    !Array.isArray(global.items) ||
    !global.items.every((item) => typeof item === 'string') ||
    !global.results ||
    typeof global.results !== 'object' ||
    Array.isArray(global.results) ||
    !Object.values(global.results).every(
      (results) => Array.isArray(results) && results.every((result) => typeof result === 'string'),
    ) ||
    typeof global.bgm !== 'boolean' ||
    typeof global.panel !== 'boolean'
  )
    throw new Error('基本情報の形式が正しくありません');
}

function validScenarioId(id: string): boolean {
  return (
    id.length > 0 &&
    id !== ALL &&
    id !== GLOBAL_SAVE_KEY &&
    !id.startsWith('stext-next:') &&
    !/[\r\n]/.test(id)
  );
}

export function parseRestore(fileName: string, content: string): RestoreChange[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = undefined;
  }
  if (parsed && typeof parsed === 'object' && 'format' in parsed) {
    if (
      parsed.format !== 'stext-next-backup/1' ||
      !('scenarios' in parsed) ||
      !Array.isArray(parsed.scenarios)
    )
      throw new Error('バックアップの形式が正しくありません');
    const changes: RestoreChange[] = [];
    if ('global' in parsed) {
      if (parsed.global !== null && typeof parsed.global !== 'string')
        throw new Error('基本情報の形式が正しくありません');
      if (parsed.global !== null) validateGlobal(parsed.global);
      changes.push({ key: GLOBAL_SAVE_KEY, value: parsed.global });
    }
    const seen = new Set<string>();
    for (const item of parsed.scenarios as unknown[]) {
      if (
        !item ||
        typeof item !== 'object' ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !validScenarioId(item.id) ||
        seen.has(item.id) ||
        !('auto' in item) ||
        !('slots' in item) ||
        (item.auto !== null && typeof item.auto !== 'string') ||
        (item.slots !== null && typeof item.slots !== 'string')
      )
        throw new Error('シナリオのバックアップ形式が正しくありません');
      seen.add(item.id);
      if (item.auto !== null) validateGame(item.auto);
      if (item.slots !== null) parseSlots(item.slots);
      changes.push(
        { key: item.id, value: item.auto },
        { key: slotsKey(item.id), value: item.slots },
      );
    }
    if (!changes.length) throw new Error('バックアップの中にデータがありません');
    return changes;
  }
  const legacy = parseBackup(fileName, content);
  if (legacy.some((e) => e.key !== GLOBAL_SAVE_KEY && !validScenarioId(e.key)))
    throw new Error('シナリオ ID が不正です');
  return legacy;
}

/** バックアップファイルを読み、書き戻す内容を返す。形式が正しくなければ例外 */
export function parseBackup(fileName: string, content: string): RestoreEntry[] {
  const key = fileName.split('-')[0] ?? '';
  const entries: RestoreEntry[] = [];
  if (key === ALL) {
    const lines = content.split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    if (lines.length % 2 !== 0) throw new Error('バックアップの途中が欠けています');
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i += 2) {
      const k = lines[i]!.trim();
      const v = lines[i + 1]!;
      if (!k || !v || seen.has(k)) throw new Error('バックアップの形式が正しくありません');
      seen.add(k);
      entries.push({ key: k, value: v });
    }
  } else {
    entries.push({ key, value: content.trim() });
  }
  if (entries.length === 0) throw new Error('バックアップの中にデータがありません');
  for (const e of entries) {
    try {
      if (e.key === GLOBAL_SAVE_KEY) validateGlobal(e.value);
      else validateGame(e.value);
    } catch {
      throw new Error(`「${e.key}」のデータを読み込めません（.stext ファイルか確かめてください）`);
    }
  }
  return entries;
}

/** ブラウザでファイルとして保存させる */
export function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
