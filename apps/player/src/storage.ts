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

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  /** 最後に遊んだシナリオ */
  recent?: string;
  /** 開発用のシナリオも書庫に出す */
  showUnlisted?: boolean;
}

const SETTINGS_KEY = 'stext-next:settings';

export function loadSettings(): Settings {
  try {
    return {
      theme: 'system',
      fontSize: 'medium',
      ...(JSON.parse(readRaw(SETTINGS_KEY) ?? '{}') as Partial<Settings>),
    };
  } catch {
    return { theme: 'system', fontSize: 'medium' };
  }
}

export function saveSettings(settings: Settings) {
  writeRaw(SETTINGS_KEY, JSON.stringify(settings));
}
