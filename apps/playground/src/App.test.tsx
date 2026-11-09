// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { emptyScenario } from './model.js';

vi.mock('./FlowView.js', () => ({ FlowView: () => null }));
vi.mock('./Splitter.js', () => ({
  Splitter: () => null,
  useSideWidth: () => [undefined, vi.fn()],
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('opens an unfinished saved work, reports problems, and allows correction before test play', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  localStorage.clear();
  localStorage.setItem('stext-next:playground:current-project', 'draft-project');
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('stext-next-playground', 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('scenarios', { keyPath: 'id' });
      request.result
        .createObjectStore('resources', { keyPath: ['projectId', 'path'] })
        .createIndex('projectId', 'projectId');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('scenarios', 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.objectStore('scenarios').put({
        id: 'draft-project',
        updatedAt: '2026-11-09T12:00:00Z',
        scenario: {
          ...emptyScenario('復元した作品'),
          // 以前のエディターで本文・文言を空欄にした保存データ。
          scenes: [{ id: '0', choices: [{ to: [''] }], effects: { hp: '1..' } }],
        },
      });
    };
  });

  render(<App />);
  await screen.findByDisplayValue('復元した作品');
  expect(screen.queryByText(/自動保存に失敗/)).toBeNull();
  expect((screen.getByLabelText('本文') as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByLabelText('文言') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('HP', { exact: true }) as HTMLInputElement).value).toBe('1..');

  fireEvent.click(screen.getByRole('tab', { name: /検査/ }));
  expect(document.querySelectorAll('.pg-problems .error').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
  expect(screen.getByRole('alert').textContent).toContain(
    'データ形式に問題があるため試遊できません',
  );

  fireEvent.click(screen.getByRole('tab', { name: 'シーン' }));
  fireEvent.change(screen.getByLabelText('HP', { exact: true }), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('遷移先', { exact: true }), { target: { value: '0' } });
  await waitFor(() => expect(screen.getByText('このブラウザーに保存済み')).toBeTruthy());
  fireEvent.click(screen.getByRole('tab', { name: /検査/ }));
  expect(document.querySelectorAll('.pg-problems .error')).toHaveLength(0);
  fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
  expect(screen.queryByText(/データ形式に問題/)).toBeNull();
  expect(screen.getByRole('button', { name: '最初から試遊' })).toBeTruthy();
});
