// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';

vi.mock('./FlowView.js', () => ({ FlowView: () => null }));
vi.mock('./Splitter.js', () => ({
  Splitter: () => null,
  useSideWidth: () => [undefined, vi.fn()],
}));

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

async function seedProjects(scenarios: unknown[]) {
  vi.resetModules();
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
      scenarios.forEach((scenario, index) =>
        tx.objectStore('scenarios').put({
          id: index === 0 ? 'draft-project' : `project-${index}`,
          updatedAt: '2026-11-09T12:00:00Z',
          scenario,
        }),
      );
    };
  });
}

it('opens an unfinished saved work, reports problems, and allows correction before test play', async () => {
  await seedProjects([
    {
      ...emptyScenario('復元した作品'),
      // 以前のエディターで本文・文言を空欄にした保存データ。
      scenes: [{ id: '0', choices: [{ to: [''] }], effects: { hp: '1..' } }],
    },
  ]);

  const { App } = await import('./App.js');
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

it('resumes preview after editing without repeating effects, and discards it on project switches', async () => {
  await seedProjects([
    {
      ...emptyScenario('試遊の保持'),
      params: [{ id: 'p01', initial: 0 }],
      scenes: [
        { id: '0', text: '出発', choices: [{ label: '森へ', to: ['1'] }] },
        {
          id: '1',
          text: '森の中',
          bgm: 'forest',
          effects: { params: ['p01:1'] },
          choices: [],
        },
        { id: '2', text: '森の先', choices: [] },
      ],
    },
    emptyScenario('別の作品'),
  ]);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const persistence = await import('./store-persistence.js');
  const syncResources = vi.spyOn(persistence, 'updateProjectResourceScenarioId');
  const readResources = vi.spyOn(persistence, 'listProjectResources');
  const { App } = await import('./App.js');
  const { container } = render(<App />);
  await screen.findByDisplayValue('試遊の保持');
  fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
  fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
  fireEvent.click(screen.getByRole('button', { name: /森へ/ }));
  expect(screen.getByText('森の中')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: '音声を再生' }));
  fireEvent.click(screen.getByRole('tab', { name: 'シーン' }));
  fireEvent.change(screen.getByLabelText('本文'), { target: { value: '編集後の森' } });
  fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
  expect(screen.getByText('編集後の森')).toBeTruthy();
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '音声を再生' }).checked).toBe(
    false,
  );
  expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
  expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('1');

  fireEvent.change(screen.getByLabelText('編集するシーン'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
  expect(screen.getByText('編集後の森')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '現在の状態で§2へ移動' }));
  expect(screen.getByText('森の先')).toBeTruthy();
  expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
  fireEvent.click(screen.getByRole('tab', { name: 'シーン' }));
  fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
  fireEvent.click(screen.getByRole('button', { name: '直前のシーンからやり直す' }));
  expect(screen.getByText('編集後の森')).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('1');
  expect(screen.getByLabelText<HTMLSelectElement>('編集するシーン').value).toBe('1');

  for (const title of ['別の作品', '試遊の保持']) {
    fireEvent.click(screen.getByRole('button', { name: '作品…' }));
    fireEvent.click(screen.getByRole('button', { name: '作品一覧を開く' }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${title}`) }));
    await screen.findByDisplayValue(title);
    fireEvent.click(screen.getByRole('tab', { name: '試遊' }));
    expect(container.querySelector('.pg-play-page')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('試遊の開始BGM').value).toBe('');
  }
  await waitFor(() => expect(syncResources.mock.lastCall?.[0]).toBe('draft-project'));
  await act(async () => {
    await syncResources.mock.results.at(-1)!.value;
    await readResources.mock.results.at(-1)!.value;
  });
});
