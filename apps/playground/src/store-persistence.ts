import { validateScenarioDraft, type DraftScenario as Scenario } from '@stext/schema';
import { emptyScenario } from './model.js';
import { resourceMimeType, validateResourceFile, type LocalResource } from './resources.js';

const DATABASE_NAME = 'stext-next-playground';
const DATABASE_VERSION = 2;
const SCENARIOS_STORE = 'scenarios';
const RESOURCES_STORE = 'resources';
const LEGACY_CURRENT_ID = 'current';
const CURRENT_KEY = 'stext-next:playground:current';
const CURRENT_PROJECT_KEY = 'stext-next:playground:current-project';

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

export interface InitialProject {
  restored?: RestoredProject;
  projects: ProjectSummary[];
  error?: string;
}

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

export async function saveScenario(id: string, scenario: Scenario): Promise<void> {
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

export async function deleteStoredProject(
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

export async function listStoredProjects(): Promise<ProjectSummary[]> {
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

export function createProjectId(): string {
  return crypto.randomUUID();
}

export function setCurrentProjectId(id: string): void {
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

export async function loadProject(id: string): Promise<Scenario> {
  const stored = await getStoredScenario(id);
  if (!stored) throw new Error('選択した作品が見つかりません。作品一覧を更新してください');
  return readDraft(stored.scenario);
}

export async function listProjectResources(projectId: string): Promise<LocalResource[]> {
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

export async function loadExportSnapshot(
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

export async function saveProjectResource(
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

export async function deleteProjectResource(projectId: string, path: string): Promise<void> {
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

export async function updateProjectResourceScenarioId(
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

let initialProjectLoad: Promise<InitialProject> | undefined;

export function loadInitialProject(): Promise<InitialProject> {
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
