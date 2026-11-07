// @vitest-environment jsdom
import { newGameState } from '@stext/core';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveDialog } from './SaveDialog.js';
import { loadSlots, slotsKey } from './storage.js';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('手動セーブ', () => {
  it('keeps five independent slots per scenario, confirms overwrite and delete, and loads', async () => {
    const state = newGameState(() => 0);
    state.scene = '12';
    const onLoad = vi.fn();
    const onClose = vi.fn();
    render(<SaveDialog id="a" state={state} onLoad={onLoad} onClose={onClose} />);
    const slots = screen.getAllByRole('listitem');
    expect(slots).toHaveLength(5);
    fireEvent.click(within(slots[0]!).getByRole('button', { name: 'セーブ' }));
    expect(loadSlots('a')[0]?.state.scene).toBe('12');
    expect(loadSlots('b')).toEqual([null, null, null, null, null]);
    fireEvent.click(within(slots[0]!).getByRole('button', { name: 'セーブ' }));
    expect(window.confirm).toHaveBeenCalledWith('スロット 1 を上書きしますか？');
    fireEvent.click(screen.getByRole('button', { name: 'ロード', pressed: false }));
    fireEvent.click(within(slots[0]!).getByRole('button', { name: 'ロード' }));
    await waitFor(() =>
      expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ scene: '12' })),
    );
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(within(slots[0]!).getByRole('button', { name: '削除' }));
    expect(loadSlots('a')[0]).toBeNull();
  });

  it('reports corrupt slots and a failed persistent save', () => {
    localStorage.setItem(slotsKey('a'), 'broken');
    const { unmount } = render(<SaveDialog id="a" onLoad={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('読み込めません');
    unmount();
    localStorage.clear();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('容量不足');
    });
    render(<SaveDialog id="a" state={newGameState(() => 0)} onLoad={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(
      within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'セーブ' }),
    );
    expect(screen.getByRole('alert').textContent).toContain('容量不足');
    expect(screen.getAllByText('空き')).toHaveLength(5);
  });

  it('only offers loading at an ending and respects a cancelled load', async () => {
    const state = newGameState(() => 0);
    const onLoad = vi.fn();
    const { unmount } = render(
      <SaveDialog id="a" state={state} onLoad={onLoad} onClose={vi.fn()} />,
    );
    fireEvent.click(
      within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'セーブ' }),
    );
    unmount();
    vi.mocked(window.confirm).mockReturnValue(false);
    render(
      <SaveDialog id="a" state={{ ...state, isEnded: true }} onLoad={onLoad} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'セーブ' })).toBeNull();
    fireEvent.click(
      within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'ロード' }),
    );
    expect(onLoad).not.toHaveBeenCalled();
  });
});
