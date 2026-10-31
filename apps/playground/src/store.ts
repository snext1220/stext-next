/**
 * 編集中のシナリオの状態：元に戻す／やり直す、ブラウザへの自動保存、マイストレージ。
 */
import { validateScenario, type Scenario } from '@stext/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyScenario } from './model.js';

const CURRENT_KEY = 'stext-next:playground:current';
const SLOTS_KEY = 'stext-next:playground:slots';
const HISTORY_LIMIT = 100;
/** 同じ項目への続けての入力は、この時間内なら一回の変更として元に戻す */
const MERGE_MS = 1000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても編集は続けられる
  }
}

export function loadCurrent(): Scenario {
  const raw = read(CURRENT_KEY);
  if (raw) {
    try {
      const v = validateScenario(JSON.parse(raw));
      if (v.ok) return v.scenario;
    } catch {
      // 壊れていれば新しく始める
    }
  }
  return emptyScenario();
}

export interface Slot {
  name: string;
  savedAt: string;
  scenario: Scenario;
}

export function loadSlots(): Slot[] {
  try {
    return JSON.parse(read(SLOTS_KEY) ?? '[]') as Slot[];
  } catch {
    return [];
  }
}

export function saveSlot(name: string, scenario: Scenario): Slot[] {
  const slots = [
    { name, savedAt: new Date().toISOString(), scenario },
    ...loadSlots().filter((s) => s.name !== name),
  ];
  write(SLOTS_KEY, JSON.stringify(slots));
  return slots;
}

export function deleteSlot(name: string): Slot[] {
  const slots = loadSlots().filter((s) => s.name !== name);
  write(SLOTS_KEY, JSON.stringify(slots));
  return slots;
}

export interface Store {
  scenario: Scenario;
  /** 変更する。mergeKey が同じ連続した変更は、元に戻すときに一つにまとめる */
  update: (next: Scenario, mergeKey?: string) => void;
  /** 別のシナリオに入れ替える（履歴は消える） */
  replace: (next: Scenario) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useScenarioStore(): Store {
  const [scenario, setScenario] = useState<Scenario>(loadCurrent);
  const [past, setPast] = useState<Scenario[]>([]);
  const [future, setFuture] = useState<Scenario[]>([]);
  const last = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => write(CURRENT_KEY, JSON.stringify(scenario)), 300);
    return () => clearTimeout(t);
  }, [scenario]);

  const update = useCallback(
    (next: Scenario, mergeKey?: string) => {
      const now = Date.now();
      const merge =
        mergeKey !== undefined &&
        last.current?.key === mergeKey &&
        now - last.current.at < MERGE_MS;
      if (!merge) setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), scenario]);
      last.current = mergeKey !== undefined ? { key: mergeKey, at: now } : null;
      setFuture([]);
      setScenario(next);
    },
    [scenario],
  );

  const replace = useCallback((next: Scenario) => {
    setPast([]);
    setFuture([]);
    last.current = null;
    setScenario(next);
  }, []);

  const undo = useCallback(() => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([scenario, ...future]);
    last.current = null;
    setScenario(prev);
  }, [past, future, scenario]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, scenario]);
    last.current = null;
    setScenario(next);
  }, [past, future, scenario]);

  return {
    scenario,
    update,
    replace,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
