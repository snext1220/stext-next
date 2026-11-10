import type { DraftScenario as Scenario } from '@stext/schema';
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const HISTORY_LIMIT = 100;
/** 同じ項目への続けての入力は、この時間内なら一回の変更として元に戻す */
const MERGE_MS = 1000;

export interface ScenarioHistory {
  update: (next: Scenario, mergeKey?: string) => void;
  replace: (next: Scenario) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useScenarioHistory(
  scenario: Scenario,
  setScenario: Dispatch<SetStateAction<Scenario>>,
): ScenarioHistory {
  const [past, setPast] = useState<Scenario[]>([]);
  const [future, setFuture] = useState<Scenario[]>([]);
  const last = useRef<{ key: string; at: number } | null>(null);

  const update = useCallback(
    (next: Scenario, mergeKey?: string) => {
      const now = Date.now();
      const merge =
        mergeKey !== undefined &&
        last.current?.key === mergeKey &&
        now - last.current.at < MERGE_MS;
      if (!merge) setPast((items) => [...items.slice(-HISTORY_LIMIT + 1), scenario]);
      last.current = mergeKey !== undefined ? { key: mergeKey, at: now } : null;
      setFuture([]);
      setScenario(next);
    },
    [scenario, setScenario],
  );

  const reset = useCallback(() => {
    setPast([]);
    setFuture([]);
    last.current = null;
  }, []);

  const replace = useCallback(
    (next: Scenario) => {
      reset();
      setScenario(next);
    },
    [reset, setScenario],
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture([scenario, ...future]);
    last.current = null;
    setScenario(previous);
  }, [past, future, scenario, setScenario]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, scenario]);
    last.current = null;
    setScenario(next);
  }, [past, future, scenario, setScenario]);

  return {
    update,
    replace,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
