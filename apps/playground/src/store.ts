/**
 * 編集中のシナリオの状態：元に戻す／やり直す、ブラウザへの自動保存。
 */
import { validateScenarioDraft, type DraftScenario as Scenario } from '@stext/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyScenario } from './model.js';
import { resourceMimeType, validateResourceFile, type LocalResource } from './resources.js';

const DATABASE_NAME = 'stext-next-playground';
const DATABASE_VERSION = 2;
const SCENARIOS_STORE = 'scenarios';
const RESOURCES_STORE = 'resources';
const LEGACY_CURRENT_ID = 'current';
const CURRENT_KEY = 'stext-next:playground:current';
const CURRENT_PROJECT_KEY = 'stext-next:playground:current-project';
const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY = 500;
/** 同じ項目への続けての入力は、この時間内なら一回の変更として元に戻す */
const MERGE_MS = 1000;

interface StoredScenario {
  id: string;
  scenario: unknown;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  scenarioId: string | undefined;
  updatedAt: string;
  loadError?: string;
}

interface RestoredProject {
  id: string;
  scenario: Scenario;
}

export type SaveStatus = 'loading' | 'pending' | 'saving' | 'saved' | 'error';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let settled = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SCENARIOS_STORE)) {
        request.result.createObjectStore(SCENARIOS_STORE, { keyPath: 'id' });
      }
      if (!request.result.objectStoreNames.contains(RESOURCES_STORE)) {
        const resources = request.result.createObjectStore(RESOURCES_STORE, {
          keyPath: ['projectId', 'path'],
        });
        resources.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error('IndexedDBを開けませんでした'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error('IndexedDBを開けません。他のタブを閉じて再試行してください'));
    };
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  const failure = (message: string): Error => {
    if (transaction.error?.name === 'QuotaExceededError')
      return new Error(
        'ブラウザーの保存容量が不足しています。不要な素材を削除してから再試行してください',
      );
    return transaction.error ?? new Error(message);
  };
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(failure('IndexedDBの処理が中断されました'));
    transaction.onerror = () => reject(failure('IndexedDBの処理に失敗しました'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDBの読み込みに失敗しました'));
  });
}

async function getStoredScenario(id: string): Promise<StoredScenario | undefined> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SCENARIOS_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const [record] = await Promise.all([
      requestResult(transaction.objectStore(SCENARIOS_STORE).get(id)),
      completed,
    ]);
    return record as StoredScenario | undefined;
  } finally {
    database.close();
  }
}

async function saveScenario(id: string, scenario: Scenario): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SCENARIOS_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(SCENARIOS_STORE).put({
      id,
      scenario,
      updatedAt: new Date().toISOString(),
    } satisfies StoredScenario);
    await completed;
  } finally {
    database.close();
  }
}

async function deleteStoredProject(
  id: string,
  replacement?: { id: string; scenario: Scenario },
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SCENARIOS_STORE, RESOURCES_STORE], 'readwrite');
    const completed = transactionComplete(transaction);
    const scenarios = transaction.objectStore(SCENARIOS_STORE);
    const resources = transaction.objectStore(RESOURCES_STORE);
    scenarios.delete(id);
    if (replacement) {
      scenarios.put({
        id: replacement.id,
        scenario: replacement.scenario,
        updatedAt: new Date().toISOString(),
      } satisfies StoredScenario);
    }
    const keys = resources.index('projectId').getAllKeys(id);
    keys.onsuccess = () => {
      for (const key of keys.result) resources.delete(key);
    };
    await completed;
  } finally {
    database.close();
  }
}

async function listStoredProjects(): Promise<ProjectSummary[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SCENARIOS_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const [records] = await Promise.all([
      requestResult<StoredScenario[]>(transaction.objectStore(SCENARIOS_STORE).getAll()),
      completed,
    ]);
    return records
      .filter((record) => record.id !== LEGACY_CURRENT_ID)
      .map((record) => {
        const result = validateScenarioDraft(record.scenario);
        return {
          id: record.id,
          title: result.ok ? result.scenario.meta.title || '無題' : '読み込めない作品',
          scenarioId: result.ok ? result.scenario.meta.id : undefined,
          updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
          ...(!result.ok ? { loadError: draftReadError(result.issues) } : {}),
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    database.close();
  }
}

function draftReadError(issues: { path: string; message: string }[]): string {
  const issue = issues[0];
  return `編集用のデータ構造を読み込めません。保存データは削除していません: ${issue?.path} ${issue?.message}`;
}

function readDraft(data: unknown): Scenario {
  const result = validateScenarioDraft(data);
  if (!result.ok) throw new Error(draftReadError(result.issues));
  return result.scenario;
}

function createProjectId(): string {
  return crypto.randomUUID();
}

function setCurrentProjectId(id: string): void {
  try {
    localStorage.setItem(CURRENT_PROJECT_KEY, id);
  } catch {
    // 次回は更新日時が最新の作品を開く
  }
}

async function restoreProject(projects: ProjectSummary[]): Promise<RestoredProject> {
  const currentId = read(CURRENT_PROJECT_KEY);
  if (currentId) {
    const stored = await getStoredScenario(currentId);
    if (stored) {
      return { id: currentId, scenario: readDraft(stored.scenario) };
    }
  }

  if (projects.length) {
    const latest = projects.find((project) => !project.loadError) ?? projects[0]!;
    const stored = await getStoredScenario(latest.id);
    if (!stored) throw new Error('最新の作品を読み込めません');
    const scenario = readDraft(stored.scenario);
    setCurrentProjectId(latest.id);
    return { id: latest.id, scenario };
  }

  const legacy = await getStoredScenario(LEGACY_CURRENT_ID);
  if (legacy) {
    const scenario = readDraft(legacy.scenario);
    const id = createProjectId();
    await saveScenario(id, scenario);
    setCurrentProjectId(id);
    return { id, scenario };
  }

  const scenario = loadCurrent();
  const id = createProjectId();
  await saveScenario(id, scenario);
  setCurrentProjectId(id);
  return { id, scenario };
}

async function loadProject(id: string): Promise<Scenario> {
  const stored = await getStoredScenario(id);
  if (!stored) throw new Error('選択した作品が見つかりません。作品一覧を更新してください');
  return readDraft(stored.scenario);
}

async function listProjectResources(projectId: string): Promise<LocalResource[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RESOURCES_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const [resources] = await Promise.all([
      requestResult(transaction.objectStore(RESOURCES_STORE).index('projectId').getAll(projectId)),
      completed,
    ]);
    return resources as LocalResource[];
  } finally {
    database.close();
  }
}

async function loadExportSnapshot(
  projectId: string,
): Promise<{ scenario: Scenario; resources: LocalResource[] }> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SCENARIOS_STORE, RESOURCES_STORE], 'readonly');
    const completed = transactionComplete(transaction);
    const [stored, resources] = await Promise.all([
      requestResult<StoredScenario | undefined>(
        transaction.objectStore(SCENARIOS_STORE).get(projectId),
      ),
      requestResult<LocalResource[]>(
        transaction.objectStore(RESOURCES_STORE).index('projectId').getAll(projectId),
      ),
      completed,
    ]);
    if (!stored) throw new Error('ZIP作成対象のシナリオをIndexedDBから読み込めません');
    return { scenario: readDraft(stored.scenario), resources };
  } finally {
    database.close();
  }
}

async function saveProjectResource(
  projectId: string,
  scenarioId: string | undefined,
  path: string,
  file: File,
): Promise<void> {
  const validationError = validateResourceFile(path, file);
  if (validationError) throw new Error(validationError);
  const mimeType = resourceMimeType(file);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RESOURCES_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(RESOURCES_STORE);
    const request = store.get([projectId, path]);
    request.onsuccess = () => {
      const current = request.result as LocalResource | undefined;
      const now = new Date().toISOString();
      store.put({
        projectId,
        scenarioId,
        path,
        fileName: file.name,
        mimeType,
        blob: file.slice(0, file.size, mimeType),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      } satisfies LocalResource);
    };
    await completed;
  } finally {
    database.close();
  }
}

async function deleteProjectResource(projectId: string, path: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RESOURCES_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(RESOURCES_STORE).delete([projectId, path]);
    await completed;
  } finally {
    database.close();
  }
}

async function updateProjectResourceScenarioId(
  projectId: string,
  scenarioId: string | undefined,
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RESOURCES_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(RESOURCES_STORE);
    const request = store.index('projectId').getAll(projectId);
    request.onsuccess = () => {
      for (const resource of request.result as LocalResource[]) {
        store.put({ ...resource, scenarioId });
      }
    };
    await completed;
  } finally {
    database.close();
  }
}

interface InitialProject {
  restored?: RestoredProject;
  projects: ProjectSummary[];
  error?: string;
}

let initialProjectLoad: Promise<InitialProject> | undefined;

function loadInitialProject(): Promise<InitialProject> {
  initialProjectLoad ??= (async () => {
    const projects = await listStoredProjects();
    try {
      const restored = await restoreProject(projects);
      return {
        restored,
        projects: projects.some((project) => project.id === restored.id)
          ? projects
          : await listStoredProjects(),
      };
    } catch (error) {
      return {
        projects,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();
  return initialProjectLoad;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadCurrent(): Scenario {
  const raw = read(CURRENT_KEY);
  if (raw) {
    try {
      const v = validateScenarioDraft(JSON.parse(raw));
      if (v.ok) return v.scenario;
    } catch {
      // 壊れていれば新しく始める
    }
  }
  return emptyScenario();
}

export interface Store {
  scenario: Scenario;
  projectId: string;
  projects: ProjectSummary[];
  ready: boolean;
  transitioning: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  retrySave: () => void;
  openProject: (id: string) => Promise<Scenario>;
  deleteProject: (id: string) => Promise<boolean>;
  createProject: (scenario: Scenario) => Promise<void>;
  resources: LocalResource[];
  resourcesReady: boolean;
  resourceError: string | null;
  registerResource: (path: string, file: File) => Promise<void>;
  deleteResource: (path: string) => Promise<void>;
  createExportSnapshot: () => Promise<{ scenario: Scenario; resources: LocalResource[] }>;
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
  const [scenario, setScenario] = useState<Scenario>(emptyScenario);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [resources, setResources] = useState<LocalResource[]>([]);
  const [resourcesOwnerId, setResourcesOwnerId] = useState('');
  const [resourcesReady, setResourcesReady] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [resourceErrorOwnerId, setResourceErrorOwnerId] = useState('');
  const [ready, setReady] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [past, setPast] = useState<Scenario[]>([]);
  const [future, setFuture] = useState<Scenario[]>([]);
  const last = useRef<{ key: string; at: number } | null>(null);
  const skipNextSave = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const resourceQueue = useRef<Promise<void>>(Promise.resolve());
  const snapshotting = useRef(false);
  const saveVersion = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void loadInitialProject().then(
      ({ restored, projects: loadedProjects, error }) => {
        if (!active) return;
        skipNextSave.current = true;
        setProjectId(restored?.id ?? createProjectId());
        setScenario(restored?.scenario ?? loadCurrent());
        setProjects(loadedProjects);
        setSaveStatus(error ? 'error' : 'saved');
        setSaveError(error ?? null);
        setReady(true);
      },
      (error: unknown) => {
        if (!active) return;
        skipNextSave.current = true;
        setProjectId(createProjectId());
        setScenario(loadCurrent());
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : String(error));
        setReady(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !projectId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const version = ++saveVersion.current;
    setSaveStatus('pending');
    setSaveError(null);
    const timer = setTimeout(() => {
      saveTimer.current = null;
      setSaveStatus('saving');
      saveQueue.current = saveQueue.current
        .then(() => saveScenario(projectId, scenario))
        .then(
          () => {
            if (version === saveVersion.current) {
              setCurrentProjectId(projectId);
              setSaveStatus('saved');
              setProjects((current) => [
                {
                  id: projectId,
                  title: scenario.meta.title || '無題',
                  scenarioId: scenario.meta.id,
                  updatedAt: new Date().toISOString(),
                },
                ...current.filter((project) => project.id !== projectId),
              ]);
            }
          },
          (error: unknown) => {
            if (version === saveVersion.current) {
              setSaveStatus('error');
              setSaveError(error instanceof Error ? error.message : String(error));
            }
          },
        );
    }, AUTOSAVE_DELAY);
    saveTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (saveTimer.current === timer) saveTimer.current = null;
    };
  }, [ready, projectId, scenario]);

  useEffect(() => {
    if (!ready || !projectId) return;
    let active = true;
    void listProjectResources(projectId).then(
      (loaded) => {
        if (!active) return;
        setResources(loaded);
        setResourcesOwnerId(projectId);
        setResourcesReady(true);
      },
      (error: unknown) => {
        if (!active) return;
        setResourceErrorOwnerId(projectId);
        setResourceError(error instanceof Error ? error.message : String(error));
        setResourcesReady(true);
      },
    );
    return () => {
      active = false;
    };
  }, [ready, projectId]);

  useEffect(() => {
    if (!ready || !projectId || resourcesOwnerId !== projectId) return;
    let active = true;
    void updateProjectResourceScenarioId(projectId, scenario.meta.id).then(
      async () => {
        const loaded = await listProjectResources(projectId);
        if (active) setResources(loaded);
      },
      (error: unknown) => {
        if (active) {
          setResourceErrorOwnerId(projectId);
          setResourceError(error instanceof Error ? error.message : String(error));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [ready, projectId, resourcesOwnerId, scenario.meta.id]);

  const retrySave = useCallback(() => {
    if (!ready || !projectId) return;
    const version = ++saveVersion.current;
    setSaveStatus('saving');
    setSaveError(null);
    saveQueue.current = saveQueue.current
      .then(() => saveScenario(projectId, scenario))
      .then(
        async () => {
          if (version !== saveVersion.current) return;
          setCurrentProjectId(projectId);
          setProjects((current) => [
            {
              id: projectId,
              title: scenario.meta.title || '無題',
              scenarioId: scenario.meta.id,
              updatedAt: new Date().toISOString(),
            },
            ...current.filter((project) => project.id !== projectId),
          ]);
          setSaveStatus('saved');
        },
        (error: unknown) => {
          if (version === saveVersion.current) {
            setSaveStatus('error');
            setSaveError(error instanceof Error ? error.message : String(error));
          }
        },
      );
  }, [ready, projectId, scenario]);

  const openProject = useCallback(
    async (id: string) => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const version = ++saveVersion.current;
      setTransitioning(true);
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await saveQueue.current.then(() => saveScenario(projectId, scenario));
        const loaded = await loadProject(id);
        const loadedProjects = await listStoredProjects();
        if (version !== saveVersion.current) return loaded;
        setCurrentProjectId(id);
        skipNextSave.current = true;
        setPast([]);
        setFuture([]);
        setProjectId(id);
        setScenario(loaded);
        setProjects(loadedProjects);
        setSaveStatus('saved');
        setSaveError(null);
        return loaded;
      } catch (error) {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : String(error));
        }
        throw error;
      } finally {
        setTransitioning(false);
      }
    },
    [projectId, scenario],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (snapshotting.current) throw new Error('ZIP作成用のデータを確定中です');
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const version = ++saveVersion.current;
      const isCurrent = id === projectId;
      const replacementId = isCurrent ? createProjectId() : undefined;
      const replacement = replacementId
        ? { id: replacementId, scenario: emptyScenario() }
        : undefined;
      setTransitioning(true);
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await resourceQueue.current;
        await saveQueue.current.then(() => saveScenario(projectId, scenario));
        await deleteStoredProject(id, replacement);
        const loadedProjects = await listStoredProjects();
        if (version !== saveVersion.current) return isCurrent;
        setProjects(loadedProjects);
        if (replacement) {
          setCurrentProjectId(replacement.id);
          skipNextSave.current = true;
          setPast([]);
          setFuture([]);
          last.current = null;
          setProjectId(replacement.id);
          setScenario(replacement.scenario);
          setResources([]);
          setResourcesOwnerId(replacement.id);
          setResourcesReady(true);
          setResourceError(null);
          setResourceErrorOwnerId(replacement.id);
        }
        setSaveStatus('saved');
        setSaveError(null);
        return isCurrent;
      } catch (error) {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : String(error));
        }
        throw error;
      } finally {
        setTransitioning(false);
      }
    },
    [projectId, scenario],
  );

  const createProject = useCallback(
    async (next: Scenario) => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const version = ++saveVersion.current;
      setTransitioning(true);
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await saveQueue.current.then(() => saveScenario(projectId, scenario));
        const id = createProjectId();
        await saveScenario(id, next);
        const loadedProjects = await listStoredProjects();
        if (version !== saveVersion.current) return;
        setCurrentProjectId(id);
        skipNextSave.current = true;
        setPast([]);
        setFuture([]);
        setProjectId(id);
        setScenario(next);
        setProjects(loadedProjects);
        setSaveStatus('saved');
        setSaveError(null);
      } catch (error) {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : String(error));
        }
        throw error;
      } finally {
        setTransitioning(false);
      }
    },
    [projectId, scenario],
  );

  const registerResource = useCallback(
    (path: string, file: File) => {
      if (snapshotting.current)
        return Promise.reject(
          new Error('ZIP作成用のデータを確定中です。完了後に再試行してください'),
        );
      setResourceError(null);
      const operation = resourceQueue.current
        .catch(() => {})
        .then(async () => {
          try {
            await saveProjectResource(projectId, scenario.meta.id, path, file);
            const loaded = await listProjectResources(projectId);
            setResources(loaded);
            setResourcesOwnerId(projectId);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setResourceErrorOwnerId(projectId);
            setResourceError(message);
            throw error;
          }
        });
      resourceQueue.current = operation;
      return operation;
    },
    [projectId, scenario.meta.id],
  );

  const deleteResource = useCallback(
    (path: string) => {
      if (snapshotting.current)
        return Promise.reject(
          new Error('ZIP作成用のデータを確定中です。完了後に再試行してください'),
        );
      setResourceError(null);
      const operation = resourceQueue.current
        .catch(() => {})
        .then(async () => {
          try {
            await deleteProjectResource(projectId, path);
            const loaded = await listProjectResources(projectId);
            setResources(loaded);
            setResourcesOwnerId(projectId);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setResourceErrorOwnerId(projectId);
            setResourceError(message);
            throw error;
          }
        });
      resourceQueue.current = operation;
      return operation;
    },
    [projectId],
  );

  const createExportSnapshot = useCallback(async () => {
    if (!ready || !projectId) throw new Error('作品をまだ読み込めません');
    if (snapshotting.current) throw new Error('ZIP作成用のデータを確定中です');
    snapshotting.current = true;
    const snapshotProjectId = projectId;
    const snapshotScenario = scenario;
    const version = ++saveVersion.current;
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      let resourceFailure: { error: unknown } | undefined;
      try {
        await resourceQueue.current;
      } catch (error) {
        resourceFailure = { error };
      }

      const save = saveQueue.current.then(() => saveScenario(snapshotProjectId, snapshotScenario));
      saveQueue.current = save.catch(() => {});
      try {
        await save;
      } catch (error) {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setSaveError(error instanceof Error ? error.message : String(error));
        }
        throw error;
      }
      if (version === saveVersion.current) {
        setCurrentProjectId(snapshotProjectId);
        setSaveStatus('saved');
        setSaveError(null);
      }
      if (resourceFailure) throw resourceFailure.error;
      return await loadExportSnapshot(snapshotProjectId);
    } finally {
      snapshotting.current = false;
    }
  }, [ready, projectId, scenario]);

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
    projectId,
    projects,
    ready,
    transitioning,
    saveStatus,
    saveError,
    retrySave,
    openProject,
    deleteProject,
    createProject,
    resources: resourcesOwnerId === projectId ? resources : [],
    resourcesReady: resourcesReady && resourcesOwnerId === projectId,
    resourceError: resourceErrorOwnerId === projectId ? resourceError : null,
    registerResource,
    deleteResource,
    createExportSnapshot,
    update,
    replace,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
