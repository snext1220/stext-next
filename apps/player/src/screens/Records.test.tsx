// @vitest-environment jsdom
import { emptyGlobalState, newGameState } from '@stext/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup } from '../backup.js';
import { loadSlots, saveSlots, slotsKey } from '../storage.js';
import { Records } from './Records.js';

vi.mock('../data.js', () => ({
  loadIndex: () =>
    Promise.resolve([{ id: 'a', title: '冒険Ａ', listed: true, scenes: 1, results: 0 }]),
}));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('記録の復元', () => {
  it('includes slots for a scenario not in the index', async () => {
    saveSlots('local-scenario', [
      { savedAt: '2026-11-07T00:00:00Z', state: newGameState(() => 0) },
      null,
      null,
      null,
      null,
    ]);
    render(<Records global={emptyGlobalState()} onGlobal={vi.fn()} />);
    expect(await screen.findByRole('option', { name: 'local-scenario' })).toBeTruthy();
  });

  it('confirms and replaces an autosave and slots, including empty slots', async () => {
    const state = newGameState(() => 0);
    state.scene = '1';
    const oldSlots = JSON.stringify([
      { savedAt: '2026-11-07T00:00:00Z', state },
      null,
      null,
      null,
      null,
    ]);
    const content = createBackup('a', ['a'], (key) => (key === slotsKey('a') ? oldSlots : null))!;
    state.scene = '2';
    localStorage.setItem('a', JSON.stringify(state));
    saveSlots('a', [null, { savedAt: '2026-11-07T01:00:00Z', state }, null, null, null]);
    const onGlobal = vi.fn();
    const { container } = render(<Records global={emptyGlobalState()} onGlobal={onGlobal} />);
    await screen.findByRole('option', { name: '冒険Ａ' });
    const file = new File([''], 'a-1.stext');
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    fireEvent.change(container.querySelector('#restore-file')!, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/リストアが完了/)).toBeTruthy());
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(localStorage.getItem('a')).toBeNull();
    expect(loadSlots('a')[0]?.state.scene).toBe('1');
    expect(loadSlots('a')[1]).toBeNull();
    expect(onGlobal).toHaveBeenCalled();
  });

  it('does not change storage when restoration is cancelled', async () => {
    const state = newGameState(() => 0);
    const content = createBackup('a', ['a'], (key) =>
      key === 'a' ? JSON.stringify(state) : null,
    )!;
    localStorage.setItem('a', JSON.stringify(state));
    vi.mocked(window.confirm).mockReturnValue(false);
    const { container } = render(<Records global={emptyGlobalState()} onGlobal={vi.fn()} />);
    await screen.findByRole('option', { name: '冒険Ａ' });
    const file = new File([''], 'a-1.stext');
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    fireEvent.change(container.querySelector('#restore-file')!, { target: { files: [file] } });
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(localStorage.getItem('a')).toBe(JSON.stringify(state));
  });
});
