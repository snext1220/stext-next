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

it('reflects through Export without mixing projects and locks the workspace until writing completes', async () => {
  const first = emptyScenario('連携元の作品');
  first.meta.id = 'gods';
  const second = emptyScenario('同じIDの別作品');
  second.meta.id = 'gods';
  await seedProjects([first, second]);
  let contents = JSON.stringify(first);
  let pending = '';
  let finish!: () => void;
  const closing = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const writable = {
    write: vi.fn(async (text: string) => {
      pending = text;
    }),
    close: vi.fn(async () => {
      await closing;
      contents = pending;
    }),
    abort: vi.fn(async () => {}),
  };
  const handle = {
    name: 'scenario.json',
    getFile: async () => ({ text: async () => contents }),
    requestPermission: vi.fn(async () => 'granted'),
    createWritable: vi.fn(async () => writable),
  };
  vi.stubGlobal('isSecureContext', true);
  const picker = vi.fn().mockResolvedValue([handle]);
  vi.stubGlobal('showOpenFilePicker', picker);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const persistence = await import('./store-persistence.js');
  const syncResources = vi.spyOn(persistence, 'updateProjectResourceScenarioId');
  const readResources = vi.spyOn(persistence, 'listProjectResources');
  const { App } = await import('./App.js');
  const { container } = render(<App />);
  await screen.findByDisplayValue('連携元の作品');
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
  fireEvent.click(screen.getByRole('button', { name: '保存先ファイルを選択…' }));
  await screen.findByText('保存先：scenario.json（ID: gods）');
  expect(writable.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  fireEvent.change(screen.getByLabelText('本文'), { target: { value: '反映する本文' } });
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
  fireEvent.click(screen.getByRole('button', { name: 'ローカルへ反映' }));
  await waitFor(() => expect(writable.close).toHaveBeenCalledOnce());
  expect(screen.getByLabelText<HTMLInputElement>('シナリオのタイトル').disabled).toBe(true);
  expect(container.querySelector('.pg-main')?.hasAttribute('inert')).toBe(true);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(container.querySelector('.pg-dialog-backdrop')!);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '閉じる' }).disabled).toBe(true);
  expect(screen.queryByText('ローカルファイルへ反映しました。')).toBeNull();
  await act(async () => {
    finish();
  });
  await screen.findByText('ローカルファイルへ反映しました。');
  expect(JSON.parse(contents).scenes[0].text).toBe('反映する本文');
  expect(container.querySelector('time')).toBeTruthy();
  expect(container.querySelector('.pg-main')?.hasAttribute('inert')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  expect(screen.getByLabelText<HTMLTextAreaElement>('本文').value).toBe('反映する本文');

  for (const title of ['同じIDの別作品', '連携元の作品']) {
    fireEvent.click(screen.getByRole('button', { name: '作品…' }));
    fireEvent.click(screen.getByRole('button', { name: '作品一覧を開く' }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${title}`) }));
    await screen.findByDisplayValue(title);
    fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
    expect(!!screen.queryByRole('button', { name: 'ローカルへ反映' })).toBe(
      title === '連携元の作品',
    );
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
  fireEvent.click(screen.getByRole('button', { name: '連携を解除' }));
  expect(screen.getByRole('button', { name: '保存先ファイルを選択…' })).toBeTruthy();
  expect(picker).toHaveBeenCalledOnce();
  expect(writable.write).toHaveBeenCalledOnce();
  await waitFor(() => expect(syncResources.mock.lastCall?.[0]).toBe('draft-project'));
  await act(async () => {
    await syncResources.mock.results.at(-1)!.value;
    await readResources.mock.results.at(-1)!.value;
  });
}, 15000);

it('opens and automatically links a file once, preserves its exact baseline and reflects edits', async () => {
  const original = emptyScenario('既存作品');
  original.meta.id = 'gods';
  await seedProjects([original]);
  const loaded = { ...original, meta: { ...original.meta, title: '読み込んだ作品' } };
  let contents = JSON.stringify(loaded) + '\r\n';
  const write = vi.fn(async (text: string) => {
    contents = text;
  });
  const handle = {
    name: 'scenario.json',
    getFile: vi.fn(async () => ({ text: async () => contents })),
    requestPermission: vi.fn(async () => 'granted'),
    createWritable: vi.fn(async () => ({ write, close: async () => {}, abort: async () => {} })),
  };
  let select!: (handles: (typeof handle)[]) => void;
  const picker = vi.fn<(options: unknown) => Promise<(typeof handle)[]>>(
    () =>
      new Promise<(typeof handle)[]>((resolve) => {
        select = resolve;
      }),
  );
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('showOpenFilePicker', picker);
  const confirm = vi.spyOn(window, 'confirm');
  const persistence = await import('./store-persistence.js');
  const syncResources = vi.spyOn(persistence, 'updateProjectResourceScenarioId');
  const readResources = vi.spyOn(persistence, 'listProjectResources');
  const { App } = await import('./App.js');
  const { container } = render(<App />);
  await screen.findByDisplayValue('既存作品');
  fireEvent.click(screen.getByRole('button', { name: '作品…' }));
  fireEvent.click(screen.getByRole('button', { name: 'ファイルを選択…' }));
  fireEvent.click(screen.getByRole('button', { name: 'ファイルを選択…' }));
  expect(picker).toHaveBeenCalledOnce();
  expect(picker.mock.calls[0]?.[0]).toMatchObject({
    types: [{ accept: { 'application/json': ['.json'], 'application/xml': ['.xml'] } }],
  });
  expect(container.querySelector('.pg-main')?.hasAttribute('inert')).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => {
    select([handle]);
  });
  await screen.findByDisplayValue('読み込んだ作品');
  await screen.findByText(/保存先にも連携しました/);
  expect(confirm).not.toHaveBeenCalled();
  expect(handle.requestPermission).not.toHaveBeenCalled();
  expect(handle.createWritable).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('本文'), { target: { value: '一度の選択で反映' } });
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
  await screen.findByText('保存先：scenario.json（ID: gods）');
  fireEvent.click(screen.getByRole('button', { name: 'ローカルへ反映' }));
  await screen.findByText('ローカルファイルへ反映しました。');
  expect(JSON.parse(contents).scenes[0].text).toBe('一度の選択で反映');
  contents += '\n';
  fireEvent.click(screen.getByRole('button', { name: 'ローカルへ反映' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toContain('外部で変更');
  expect(write).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  fireEvent.click(screen.getByRole('button', { name: '作品…' }));
  fireEvent.click(screen.getByRole('button', { name: '作品一覧を開く' }));
  fireEvent.click(await screen.findByRole('button', { name: /^既存作品/ }));
  await screen.findByDisplayValue('既存作品');
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
  expect(screen.queryByRole('button', { name: 'ローカルへ反映' })).toBeNull();
  await waitFor(() => expect(syncResources.mock.lastCall?.[0]).toBe('draft-project'));
  await act(async () => {
    await syncResources.mock.results.at(-1)!.value;
    await readResources.mock.results.at(-1)!.value;
  });
}, 15000);

it.each([
  ['ID未設定', 'scenario.json', JSON.stringify(emptyScenario('ID未設定')), /ID未設定のため未連携/],
  [
    '旧XML',
    'scenario.xml',
    '<scenario title="旧XML" author="作者"><scene id="0">本文</scene></scenario>',
    /変換して開きました/,
  ],
  [
    '旧JSON',
    'old.json',
    JSON.stringify({ title: '旧JSON', scenes: [{ id: '0', text: '本文' }], edges: [] }),
    /変換して開きました/,
  ],
])(
  'imports %s without linking the source file',
  async (_label, name, text, notice) => {
    await seedProjects([emptyScenario('元の作品')]);
    const handle = {
      name,
      getFile: async () => ({ text: async () => text }),
      requestPermission: vi.fn(),
      createWritable: vi.fn(),
    };
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([handle]));
    const persistence = await import('./store-persistence.js');
    const syncResources = vi.spyOn(persistence, 'updateProjectResourceScenarioId');
    const readResources = vi.spyOn(persistence, 'listProjectResources');
    const { App } = await import('./App.js');
    render(<App />);
    await screen.findByDisplayValue('元の作品');
    fireEvent.click(screen.getByRole('button', { name: '作品…' }));
    fireEvent.click(screen.getByRole('button', { name: 'ファイルを選択…' }));
    await screen.findByText(notice);
    fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
    expect(screen.getByRole('button', { name: '保存先ファイルを選択…' })).toBeTruthy();
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(handle.createWritable).not.toHaveBeenCalled();
    await waitFor(() => expect(syncResources.mock.calls.length).toBeGreaterThan(1));
    await act(async () => {
      await syncResources.mock.results.at(-1)!.value;
      await readResources.mock.results.at(-1)!.value;
    });
  },
  15000,
);

it.each(['cancel', 'read-error', 'invalid', 'create-error'] as const)(
  'does not attach a file to the existing work on %s',
  async (failure) => {
    await seedProjects([emptyScenario('変更しない作品')]);
    const source = emptyScenario('取り込み作品');
    source.meta.id = 'gods';
    const handle = {
      name: 'scenario.json',
      getFile: vi.fn().mockResolvedValue({
        text: async () => (failure === 'invalid' ? 'not JSON' : JSON.stringify(source)),
      }),
      requestPermission: vi.fn(),
      createWritable: vi.fn(),
    };
    if (failure === 'read-error') handle.getFile.mockRejectedValue(new Error('読み込み失敗'));
    const picker = vi.fn().mockResolvedValue([handle]);
    if (failure === 'cancel') picker.mockRejectedValue(new DOMException('取消', 'AbortError'));
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('showOpenFilePicker', picker);
    const persistence = await import('./store-persistence.js');
    const syncResources = vi.spyOn(persistence, 'updateProjectResourceScenarioId');
    const readResources = vi.spyOn(persistence, 'listProjectResources');
    const { App } = await import('./App.js');
    render(<App />);
    await screen.findByDisplayValue('変更しない作品');
    if (failure === 'create-error') {
      const save = persistence.saveScenario;
      vi.spyOn(persistence, 'saveScenario')
        .mockImplementationOnce(save)
        .mockRejectedValueOnce(new Error('作品作成失敗'));
    }
    fireEvent.click(screen.getByRole('button', { name: '作品…' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ファイルを選択…' }));
    });
    await waitFor(() => expect(screen.queryByText('ファイルを読み込んでいます…')).toBeNull());
    if (failure !== 'cancel') {
      await screen.findByText(
        failure === 'create-error'
          ? /作品を切り替えられませんでした/
          : failure === 'read-error'
            ? /読み込み失敗/
            : /JSON/,
        { selector: '.pg-message' },
      );
    }
    if (screen.queryByRole('dialog'))
      fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.getByDisplayValue('変更しない作品')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
    expect(screen.queryByRole('button', { name: 'ローカルへ反映' })).toBeNull();
    expect(handle.createWritable).not.toHaveBeenCalled();
    await waitFor(() => expect(syncResources).toHaveBeenCalled());
    await act(async () => {
      await syncResources.mock.results.at(-1)!.value;
      await readResources.mock.results.at(-1)!.value;
    });
  },
  15000,
);

it('keeps file-input imports available without File System Access and does not auto-link them', async () => {
  await seedProjects([emptyScenario('非対応環境')]);
  const imported = emptyScenario('通常のファイル読み込み');
  imported.meta.id = 'gods';
  const file = new File([], 'scenario.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(imported) });
  vi.stubGlobal('isSecureContext', false);
  const picker = vi.fn();
  vi.stubGlobal('showOpenFilePicker', picker);
  const persistence = await import('./store-persistence.js');
  const syncResources = vi.spyOn(persistence, 'updateProjectResourceScenarioId');
  const readResources = vi.spyOn(persistence, 'listProjectResources');
  const { App } = await import('./App.js');
  const { container } = render(<App />);
  await screen.findByDisplayValue('非対応環境');
  fireEvent.click(screen.getByRole('button', { name: '作品…' }));
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  await screen.findByDisplayValue('通常のファイル読み込み');
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート…' }));
  expect(screen.getByText(/この環境では利用できません/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'ローカルへ反映' })).toBeNull();
  expect(picker).not.toHaveBeenCalled();
  await waitFor(() => expect(syncResources.mock.calls.length).toBeGreaterThan(1));
  await act(async () => {
    await syncResources.mock.results.at(-1)!.value;
    await readResources.mock.results.at(-1)!.value;
  });
}, 15000);
