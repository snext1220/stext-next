// @vitest-environment jsdom
import { Blob as NativeBlob } from 'node:buffer';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { validateScenario, type DraftScenario } from '@stext/schema';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findProblems } from './checks.js';
import { emptyScenario } from './model.js';

const CURRENT_PROJECT_KEY = 'stext-next:playground:current-project';
let useScenarioStore: (typeof import('./store.js'))['useScenarioStore'];

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('stext-next-playground', 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('scenarios', { keyPath: 'id' });
      request.result
        .createObjectStore('resources', { keyPath: ['projectId', 'path'] })
        .createIndex('projectId', 'projectId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seed(id: string, scenario: unknown, withResource = false): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['scenarios', 'resources'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore('scenarios').put({ id, scenario, updatedAt: '2026-11-09T12:00:00Z' });
      if (withResource)
        tx.objectStore('resources').put({
          projectId: id,
          scenarioId: 'draft',
          path: 'capture/image.png',
          fileName: 'image.png',
          mimeType: 'image/png',
          blob: new NativeBlob(['image'], { type: 'image/png' }),
          createdAt: '2026-11-09T12:00:00Z',
          updatedAt: '2026-11-09T12:00:00Z',
        });
    });
  } finally {
    db.close();
  }
}

async function readRecord(id: string): Promise<unknown> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('scenarios').objectStore('scenarios').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function readResources(projectId: string): Promise<unknown[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction('resources')
        .objectStore('resources')
        .index('projectId')
        .getAll(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function draft(): DraftScenario {
  return {
    ...emptyScenario('未完成の作品'),
    meta: { id: 'draft', title: '未完成の作品', constraint: { race: ['F'] } },
    scenes: [
      {
        id: '0',
        text: '書きかけの本文',
        choices: [{ label: '次へ', to: [''], cast: ['HEA'] }],
        effects: { hp: '1..', stars: 'div' },
      },
    ],
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  ({ useScenarioStore } = await import('./store.js'));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('draft project recovery', () => {
  it('restores a draft on startup, preserving its ID, values and resources', async () => {
    const unfinished = draft();
    await seed('draft-project', unfinished, true);
    localStorage.setItem(CURRENT_PROJECT_KEY, 'draft-project');
    const { result } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.resourcesReady).toBe(true));

    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.scenario).toEqual(unfinished);
    expect(result.current.projectId).toBe('draft-project');
    expect(result.current.projects).toEqual([
      expect.objectContaining({ id: 'draft-project', title: '未完成の作品' }),
    ]);
    expect(result.current.resources[0]?.projectId).toBe('draft-project');
    expect(findProblems(result.current.scenario)).toContainEqual(
      expect.objectContaining({ severity: 'error', sceneId: '0' }),
    );
    expect(validateScenario(result.current.scenario).ok).toBe(false);
    expect(await readRecord('draft-project')).toMatchObject({ scenario: unfinished });
  });

  it('opens drafts from the list, exports them with resources, and saves corrections', async () => {
    await seed('complete-project', emptyScenario('完成した作品'));
    await seed('draft-project', draft(), true);
    localStorage.setItem(CURRENT_PROJECT_KEY, 'complete-project');
    const { result, unmount } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.saveError).toBeNull();

    await act(async () => {
      await result.current.openProject('draft-project');
    });
    await waitFor(() => expect(result.current.resourcesReady).toBe(true));
    let snapshot: Awaited<ReturnType<typeof result.current.createExportSnapshot>> | undefined;
    await act(async () => {
      snapshot = await result.current.createExportSnapshot();
    });
    expect(snapshot?.scenario).toEqual(draft());
    expect(snapshot?.resources).toHaveLength(1);
    expect(snapshot?.resources[0]?.path).toBe('capture/image.png');
    expect(await snapshot?.resources[0]?.blob.text()).toBe('image');

    const corrected = {
      ...emptyScenario('修正した作品'),
      meta: { id: 'draft', title: '修正した作品' },
    };
    act(() => result.current.update(corrected));
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(findProblems(result.current.scenario).filter((p) => p.severity === 'error')).toEqual([]);
    expect(await readRecord('draft-project')).toMatchObject({ scenario: corrected });
    expect(result.current.resources).toHaveLength(1);

    unmount();
    vi.resetModules();
    ({ useScenarioStore } = await import('./store.js'));
    const reopened = renderHook(() => useScenarioStore());
    await waitFor(() => expect(reopened.result.current.resourcesReady).toBe(true));
    expect(reopened.result.current.scenario).toEqual(corrected);
    expect(reopened.result.current.projectId).toBe('draft-project');
    expect(reopened.result.current.resources).toHaveLength(1);
  });

  it('restores the latest draft when no current project is recorded', async () => {
    await seed('draft-project', draft());
    const { result } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.projectId).toBe('draft-project');
    expect(result.current.scenario).toEqual(draft());
  });

  it('migrates unfinished legacy IndexedDB projects without deleting their data', async () => {
    await seed('current', draft());
    const { result } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.saveError).toBeNull();
    expect(result.current.scenario).toEqual(draft());
    expect(result.current.projectId).not.toBe('current');
    expect(await readRecord('current')).toMatchObject({ scenario: draft() });
    expect(await readRecord(result.current.projectId)).toMatchObject({ scenario: draft() });
  });

  it('migrates unfinished legacy localStorage data', async () => {
    localStorage.setItem('stext-next:playground:current', JSON.stringify(draft()));
    const { result } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.scenario).toEqual(draft());
    expect(result.current.saveStatus).toBe('saved');
  });

  it('keeps structurally broken records visible without blocking other projects', async () => {
    const broken = { ...emptyScenario('破損'), scenes: null };
    await seed('broken-project', broken, true);
    await seed('draft-project', draft());
    localStorage.setItem(CURRENT_PROJECT_KEY, 'broken-project');
    const { result } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.saveStatus).toBe('error');
    expect(result.current.saveError).toContain('scenes');
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.projects.find((p) => p.id === 'broken-project')?.loadError).toContain(
      'scenes',
    );
    await act(async () => {
      await result.current.openProject('draft-project');
    });
    expect(result.current.scenario).toEqual(draft());
    expect(result.current.saveError).toBeNull();
    expect(await readRecord('broken-project')).toMatchObject({ scenario: broken });
  });

  it('deletes a project with its resources and starts a fresh project', async () => {
    await seed('active-project', draft(), true);
    await seed('other-project', emptyScenario('別の作品'));
    localStorage.setItem(CURRENT_PROJECT_KEY, 'active-project');
    const { result } = renderHook(() => useScenarioStore());
    await waitFor(() => expect(result.current.resourcesReady).toBe(true));

    await act(async () => {
      await expect(result.current.deleteProject('active-project')).resolves.toBe(true);
    });

    expect(result.current.projectId).not.toBe('active-project');
    expect(result.current.scenario).toEqual(emptyScenario());
    expect(result.current.resources).toEqual([]);
    expect(result.current.projects.map((project) => project.id)).toContain('other-project');
    expect(result.current.projects.map((project) => project.id)).not.toContain('active-project');
    expect(await readRecord('active-project')).toBeUndefined();
    expect(await readResources('active-project')).toEqual([]);
    await waitFor(async () => {
      expect(await readResources(result.current.projectId)).toEqual([]);
    });
  });
});
