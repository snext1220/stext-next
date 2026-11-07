/**
 * 保存先。旧エンジンと同じキー（シナリオ ID と sorcerian_text）で localStorage に保存する。
 * localStorage が使えない環境（プライベートブラウズなど）でも動くよう、失敗は無視してメモリに持つ。
 */
import {
  GLOBAL_SAVE_KEY,
  emptyGlobalState,
  readLegacyGlobal,
  readLegacySave,
  type GameState,
  type GlobalState,
} from '@stext/core';

const memory = new Map<string, string>();

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeRaw(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても遊び続けられる
  }
}

export function loadGlobal(): GlobalState {
  const raw = readRaw(GLOBAL_SAVE_KEY);
  try {
    return raw ? readLegacyGlobal(raw) : emptyGlobalState();
  } catch {
    return emptyGlobalState();
  }
}

export function saveGlobal(global: GlobalState) {
  writeRaw(GLOBAL_SAVE_KEY, JSON.stringify(global));
}

export function loadGame(id: string): GameState | undefined {
  const raw = readRaw(id);
  if (!raw) return undefined;
  try {
    return readLegacySave(raw);
  } catch {
    return undefined;
  }
}

export function saveGame(id: string, state: GameState) {
  writeRaw(id, JSON.stringify(state));
}

export const SLOT_COUNT = 5;

export interface SaveSlot {
  savedAt: string;
  state: GameState;
}

const SLOTS_PREFIX = 'stext-next:slots:';

export function slotsKey(id: string): string {
  return `${SLOTS_PREFIX}${encodeURIComponent(id)}`;
}

export function listSlotScenarioIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SLOTS_PREFIX)) ids.push(decodeURIComponent(key.slice(SLOTS_PREFIX.length)));
  }
  return ids;
}

/** 手動保存は永続化に失敗した場合、成功として扱わない。 */
export function writePersistent(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  if (value === null) memory.delete(key);
  else memory.set(key, value);
}

export function readPersistent(key: string): string | null {
  return localStorage.getItem(key);
}

export function restorePersistent(changes: readonly { key: string; value: string | null }[]) {
  const previous = changes.map(({ key }) => ({ key, value: readPersistent(key) }));
  let written = 0;
  try {
    for (const change of changes) {
      writePersistent(change.key, change.value);
      written++;
    }
  } catch (error) {
    const failures: string[] = [];
    for (const entry of previous.slice(0, written).reverse()) {
      try {
        writePersistent(entry.key, entry.value);
      } catch {
        failures.push(entry.key);
      }
    }
    if (failures.length)
      throw new Error(`復元に失敗し、一部の変更を元に戻せませんでした：${failures.join('、')}`, {
        cause: error,
      });
    throw error;
  }
}

export function parseSlots(raw: string): (SaveSlot | null)[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length !== SLOT_COUNT)
    throw new Error('スロットの形式が不正です');
  return data.map((item: unknown) => {
    if (item === null) return null;
    if (typeof item !== 'object' || !('savedAt' in item) || !('state' in item))
      throw new Error('スロットの形式が不正です');
    if (typeof item.savedAt !== 'string' || !Number.isFinite(Date.parse(item.savedAt)))
      throw new Error('スロットの保存日時が不正です');
    const state = readLegacySave(JSON.stringify(item.state));
    if (
      typeof state.chara !== 'object' ||
      typeof state.chara.name !== 'string' ||
      typeof state.chara.title !== 'string' ||
      state.stars.length !== 7 ||
      !state.stars.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      !Array.isArray(state.items) ||
      !state.items.every((v) => typeof v === 'string') ||
      !Array.isArray(state.flags) ||
      !state.flags.every((v) => typeof v === 'string') ||
      !state.params ||
      typeof state.params !== 'object' ||
      Array.isArray(state.params) ||
      typeof state.memos !== 'string' ||
      typeof state.bgm !== 'string' ||
      typeof state.ellapsed_scene !== 'number' ||
      (typeof state.scene !== 'string' && typeof state.scene !== 'number') ||
      state.isEnded !== false
    )
      throw new Error('スロットのセーブデータが不正です');
    return { savedAt: item.savedAt, state };
  });
}

export function loadSlots(id: string): (SaveSlot | null)[] {
  const raw = readPersistent(slotsKey(id));
  return raw === null ? Array.from({ length: SLOT_COUNT }, () => null) : parseSlots(raw);
}

export function saveSlots(id: string, slots: (SaveSlot | null)[]) {
  const raw = JSON.stringify(slots);
  parseSlots(raw);
  writePersistent(slotsKey(id), slots.every((slot) => slot === null) ? null : raw);
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  /** プレイ画面の本文の書体 */
  fontFamily: 'mincho' | 'gothic';
  /** 最後に遊んだシナリオ */
  recent?: string;
}

const SETTINGS_KEY = 'stext-next:settings';

export function loadSettings(): Settings {
  try {
    return {
      theme: 'system',
      fontSize: 'medium',
      fontFamily: 'mincho',
      ...(JSON.parse(readRaw(SETTINGS_KEY) ?? '{}') as Partial<Settings>),
    };
  } catch {
    return { theme: 'system', fontSize: 'medium', fontFamily: 'mincho' };
  }
}

export function saveSettings(settings: Settings) {
  writeRaw(SETTINGS_KEY, JSON.stringify(settings));
}
