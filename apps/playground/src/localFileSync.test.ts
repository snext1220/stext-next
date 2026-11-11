// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftScenario } from '@stext/schema';
import {
  linkLocalFile,
  reflectLocalFile,
  scenarioJson,
  useLocalFileSync,
} from './localFileSync.js';
import { emptyScenario } from './model.js';

function scenario(title = '編集中の作品'): DraftScenario {
  const result = emptyScenario(title);
  return { ...result, meta: { ...result.meta, id: 'gods' } };
}

function file(initial = scenarioJson(scenario())) {
  let contents = initial;
  let pending = '';
  const writable = {
    write: vi.fn(async (text: string) => {
      pending = text;
    }),
    close: vi.fn(async () => {
      contents = pending;
    }),
    abort: vi.fn(async () => {}),
  };
  const handle = {
    name: 'scenario.json',
    getFile: vi.fn(async () => {
      const snapshot = contents;
      return { text: async () => snapshot };
    }),
    requestPermission: vi.fn(async (): Promise<PermissionState> => 'granted'),
    createWritable: vi.fn(async () => writable),
  };
  return {
    handle,
    writable,
    read: () => contents,
    change: (text: string) => {
      contents = text;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('local file I/O', () => {
  it('links matching contents without requesting write access or writing', async () => {
    const target = file();
    const confirm = vi.fn();
    const link = await linkLocalFile(target.handle, scenario(), confirm);
    expect(link).toEqual({
      handle: target.handle,
      scenarioId: 'gods',
      baseline: target.read(),
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(target.handle.requestPermission).not.toHaveBeenCalled();
    expect(target.handle.createWritable).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation of differing contents and supports cancellation', async () => {
    const target = file(scenarioJson(scenario('手元の作品')));
    const confirm = vi.fn<(message: string) => boolean>(() => false);
    expect(await linkLocalFile(target.handle, scenario(), confirm)).toBeUndefined();
    expect(confirm.mock.calls[0]?.[0]).toContain('手元の変更を失う可能性');
    expect(target.handle.createWritable).not.toHaveBeenCalled();
    expect(await linkLocalFile(target.handle, scenario(), () => true)).toBeTruthy();
  });

  it.each(['', '<scenario />', '{}', '{"edges":[]}', '{"format":"stext/1"}', 'null'])(
    'rejects invalid or non-stext/2 content: %s',
    async (text) => {
      const target = file(text);
      await expect(linkLocalFile(target.handle, scenario(), vi.fn())).rejects.toThrow();
      expect(target.handle.createWritable).not.toHaveBeenCalled();
    },
  );

  it.each([
    [undefined, 'gods'],
    ['gods', undefined],
    [' ', 'gods'],
    ['gods', 'another'],
  ])('rejects missing or mismatching IDs (%s / %s)', async (sourceId, targetId) => {
    const source = scenario();
    source.meta.id = sourceId;
    const local = scenario();
    local.meta.id = targetId;
    const target = file(scenarioJson(local));
    const confirm = vi.fn(() => true);
    await expect(linkLocalFile(target.handle, source, confirm)).rejects.toThrow(/シナリオID/);
    expect(confirm).not.toHaveBeenCalled();
    expect(target.handle.createWritable).not.toHaveBeenCalled();
  });

  it('writes UTF-8-ready formatted draft JSON and updates the baseline only after closing', async () => {
    const target = file();
    const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
    const draft = scenario('未完成な日本語の作品');
    draft.scenes[0]!.text = '';
    draft.scenes[0]!.effects = { hp: '1..' };
    const result = await reflectLocalFile(link, draft);
    expect(target.handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(target.writable.write).toHaveBeenCalledWith(scenarioJson(draft));
    expect(target.writable.close).toHaveBeenCalledOnce();
    expect(target.read()).toBe(`${JSON.stringify(draft, null, 2)}\n`);
    expect(result.baseline).toBe(target.read());
    expect(result.reflectedAt).toBeTruthy();
    expect(link.reflectedAt).toBeUndefined();
    await reflectLocalFile(result, scenario('2回目'));
    expect(target.writable.close).toHaveBeenCalledTimes(2);
  });

  it('blocks reflection after the editing ID changes without requesting permission', async () => {
    const target = file();
    const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
    const changed = scenario();
    changed.meta.id = 'changed';
    await expect(reflectLocalFile(link, changed)).rejects.toThrow(/IDが保存先と一致/);
    expect(target.handle.requestPermission).not.toHaveBeenCalled();
    expect(target.handle.createWritable).not.toHaveBeenCalled();
  });

  it('detects even whitespace-only external edits and never creates a writable stream', async () => {
    const target = file();
    const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
    const baseline = link.baseline;
    target.change(`${baseline}\n`);
    await expect(reflectLocalFile(link, scenario())).rejects.toThrow(/外部で変更/);
    expect(target.handle.createWritable).not.toHaveBeenCalled();
    expect(target.read()).toBe(`${baseline}\n`);
    expect(link.baseline).toBe(baseline);
  });

  it.each(['denied', 'prompt'] satisfies PermissionState[])(
    'does not write when permission is %s',
    async (permission) => {
      const target = file();
      const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
      target.handle.requestPermission.mockResolvedValue(permission);
      await expect(reflectLocalFile(link, scenario())).rejects.toThrow(/許可されません/);
      expect(target.handle.createWritable).not.toHaveBeenCalled();
    },
  );

  it('propagates deleted-file and stream-creation errors without updating linkage', async () => {
    const target = file();
    const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
    target.handle.getFile.mockRejectedValueOnce(new DOMException('削除済み', 'NotFoundError'));
    await expect(reflectLocalFile(link, scenario())).rejects.toThrow('削除済み');
    expect(target.handle.createWritable).not.toHaveBeenCalled();
    target.handle.createWritable.mockRejectedValueOnce(new Error('保存先が読み取り専用'));
    await expect(reflectLocalFile(link, scenario())).rejects.toThrow('読み取り専用');
    expect(link.reflectedAt).toBeUndefined();
  });

  it.each(['write', 'close'] as const)(
    'aborts after %s fails and never advances the baseline',
    async (step) => {
      const target = file();
      const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
      const baseline = link.baseline;
      target.writable[step].mockRejectedValueOnce(new Error(`${step}エラー`));
      await expect(reflectLocalFile(link, scenario('変更'))).rejects.toThrow(
        '元ファイルの内容を確認',
      );
      expect(target.writable.abort).toHaveBeenCalledOnce();
      expect(link.baseline).toBe(baseline);
      expect(link.reflectedAt).toBeUndefined();
    },
  );

  it('reports abort failure alongside the original write failure', async () => {
    const target = file();
    const link = (await linkLocalFile(target.handle, scenario(), vi.fn()))!;
    target.writable.write.mockRejectedValueOnce(new Error('write失敗'));
    target.writable.abort.mockRejectedValueOnce(new Error('abort失敗'));
    await expect(reflectLocalFile(link, scenario())).rejects.toThrow(
      /write失敗.*abort失敗.*元ファイル/,
    );
  });
});

describe('per-project linkage', () => {
  it('retains links across project switches, isolates identical scenario IDs and forgets deleted projects', async () => {
    const first = file();
    const second = file();
    vi.stubGlobal(
      'showOpenFilePicker',
      vi
        .fn()
        .mockResolvedValue([first.handle])
        .mockResolvedValueOnce([first.handle])
        .mockResolvedValueOnce([second.handle]),
    );
    const { result, rerender, unmount } = renderHook(
      ({ projectId }) => useLocalFileSync(projectId, scenario()),
      { initialProps: { projectId: 'project-a' } },
    );
    await act(() => result.current.choose());
    expect(result.current.link?.handle).toBe(first.handle);
    rerender({ projectId: 'project-b' });
    expect(result.current.link).toBeUndefined();
    expect(result.current.feedback).toBeNull();
    await act(() => result.current.choose());
    expect(result.current.link?.handle).toBe(second.handle);
    rerender({ projectId: 'project-a' });
    expect(result.current.link?.handle).toBe(first.handle);
    act(() => result.current.forget('project-b'));
    rerender({ projectId: 'project-b' });
    expect(result.current.link).toBeUndefined();
    rerender({ projectId: 'project-a' });
    act(() => result.current.forgetCurrent());
    expect(result.current.link).toBeUndefined();
    expect(first.writable.write).not.toHaveBeenCalled();
    await act(() => result.current.choose());
    unmount();
    const fresh = renderHook(() => useLocalFileSync('project-a', scenario()));
    expect(fresh.result.current.link).toBeUndefined();
  });

  it('preserves the existing link on picker cancellation, rejected confirmation or invalid targets', async () => {
    const target = file();
    const picker = vi.fn().mockResolvedValue([target.handle]);
    vi.stubGlobal('showOpenFilePicker', picker);
    const { result } = renderHook(() => useLocalFileSync('project', scenario()));
    await act(() => result.current.choose());
    const link = result.current.link;
    picker.mockRejectedValueOnce(new DOMException('取消', 'AbortError'));
    await act(() => result.current.choose());
    expect(result.current.link).toBe(link);
    expect(result.current.feedback).toBeNull();
    picker.mockResolvedValueOnce([file(scenarioJson(scenario('異なる作品'))).handle]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(() => result.current.choose());
    expect(result.current.link).toBe(link);
    picker.mockResolvedValueOnce([file('not JSON').handle]);
    await act(() => result.current.choose());
    expect(result.current.link).toBe(link);
    expect(result.current.feedback?.error).toBe(true);
    picker.mockRejectedValueOnce(new DOMException('許可なし', 'SecurityError'));
    await act(() => result.current.choose());
    expect(result.current.feedback?.text).toBe('許可なし');
    expect(result.current.link).toBe(link);
  });

  it('surfaces read AbortErrors instead of treating them as picker cancellation', async () => {
    const target = file();
    target.handle.getFile.mockRejectedValueOnce(new DOMException('読み込み失敗', 'AbortError'));
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([target.handle]));
    const { result } = renderHook(() => useLocalFileSync('project', scenario()));
    await act(() => result.current.choose());
    expect(result.current.feedback?.text).toBe('読み込み失敗');
    expect(result.current.link).toBeUndefined();
  });

  it('rejects duplicate operations, keeps the operation snapshot and waits for close before success', async () => {
    const target = file();
    const picker = vi.fn().mockResolvedValue([target.handle]);
    vi.stubGlobal('showOpenFilePicker', picker);
    const initial = scenario();
    const { result, rerender } = renderHook(({ work }) => useLocalFileSync('project', work), {
      initialProps: { work: initial },
    });
    await act(async () => {
      await Promise.all([result.current.choose(), result.current.choose()]);
    });
    expect(picker).toHaveBeenCalledOnce();
    let finish!: () => void;
    target.writable.close.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let reflection!: Promise<void>;
    await act(async () => {
      reflection = result.current.reflect();
      await Promise.resolve();
    });
    expect(result.current.busy).toBe(true);
    expect(result.current.link?.reflectedAt).toBeUndefined();
    expect(result.current.feedback).toBeNull();
    rerender({ work: scenario('処理中の編集') });
    await act(async () => {
      await result.current.reflect();
      await result.current.choose();
      result.current.forgetCurrent();
    });
    expect(result.current.link).toBeTruthy();
    expect(picker).toHaveBeenCalledOnce();
    expect(target.writable.write).toHaveBeenCalledExactlyOnceWith(scenarioJson(initial));
    await act(async () => {
      finish();
      await reflection;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.link?.reflectedAt).toBeTruthy();
    expect(result.current.feedback?.text).toBe('ローカルファイルへ反映しました。');
  });

  it('preserves the baseline on failure and permits retry', async () => {
    const target = file();
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([target.handle]));
    const { result } = renderHook(() => useLocalFileSync('project', scenario()));
    await act(() => result.current.choose());
    const link = result.current.link;
    target.handle.requestPermission.mockRejectedValueOnce(new Error('権限要求失敗'));
    await act(() => result.current.reflect());
    expect(result.current.link).toBe(link);
    expect(result.current.feedback).toMatchObject({ error: true, text: '権限要求失敗' });
    expect(result.current.busy).toBe(false);
    await act(() => result.current.reflect());
    expect(result.current.feedback?.error).toBe(false);
  });

  it('reports unsupported, insecure or missing-selection environments', async () => {
    const picker = vi.fn().mockResolvedValue([]);
    vi.stubGlobal('showOpenFilePicker', picker);
    const { result, rerender } = renderHook(() => useLocalFileSync('project', scenario()));
    await act(() => result.current.choose());
    expect(result.current.feedback?.text).toContain('選択されませんでした');
    vi.stubGlobal('isSecureContext', false);
    rerender();
    expect(result.current.supported).toBe(false);
    await act(() => result.current.choose());
    expect(result.current.feedback?.text).toContain('利用できません');
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('showOpenFilePicker', undefined);
    rerender();
    expect(result.current.supported).toBe(false);
    await act(() => result.current.reflect());
    expect(result.current.feedback?.text).toContain('選択してください');
  });
});
