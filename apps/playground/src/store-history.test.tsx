// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { type DraftScenario } from '@stext/schema';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import { useScenarioHistory } from './store-history.js';

function useHistory(initial: DraftScenario) {
  const [scenario, setScenario] = useState(initial);
  const history = useScenarioHistory(scenario, setScenario);
  return { scenario, ...history };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('scenario history', () => {
  it('supports undo, redo, replacement, and reset', () => {
    const initial = emptyScenario('初期');
    const changed = emptyScenario('変更');
    const replacement = emptyScenario('置換');
    const { result } = renderHook(() => useHistory(initial));

    act(() => result.current.update(changed));
    expect(result.current.scenario).toEqual(changed);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.scenario).toEqual(initial);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.scenario).toEqual(changed);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.replace(replacement));
    expect(result.current.scenario).toEqual(replacement);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.update(changed);
      result.current.reset();
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('merges consecutive updates with the same key within one second', () => {
    vi.useFakeTimers();
    const initial = emptyScenario('初期');
    const first = emptyScenario('1回目');
    const second = emptyScenario('2回目');
    const { result } = renderHook(() => useHistory(initial));

    act(() => result.current.update(first, 'title'));
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.update(second, 'title');
    });

    act(() => result.current.undo());
    expect(result.current.scenario).toEqual(initial);
    act(() => result.current.redo());
    expect(result.current.scenario).toEqual(second);
  });
});
