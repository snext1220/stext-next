/**
 * 編集中のシナリオの状態：元に戻す／やり直す、ブラウザへの自動保存。
 */
import type { DraftScenario as Scenario } from '@stext/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProjectId,
  deleteProjectResource,
  deleteStoredProject,
  listProjectResources,
  listStoredProjects,
  loadCurrent,
  loadExportSnapshot,
  loadInitialProject,
  loadProject,
  saveProjectResource,
  saveScenario,
  setCurrentProjectId,
  updateProjectResourceScenarioId,
} from './store-persistence.js';
import type { ProjectSummary } from './store-persistence.js';
import type { LocalResource } from './resources.js';
import { emptyScenario } from './model.js';
import { useScenarioHistory } from './store-history.js';

export { loadCurrent };
export type { ProjectSummary };

const AUTOSAVE_DELAY = 500;

export type SaveStatus = 'loading' | 'pending' | 'saving' | 'saved' | 'error';

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
  createProject: (scenario: Scenario) => Promise<string | undefined>;
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
  const history = useScenarioHistory(scenario, setScenario);
  const resetHistory = history.reset;
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
        resetHistory();
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
    [projectId, scenario, resetHistory],
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
          resetHistory();
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
    [projectId, scenario, resetHistory],
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
        resetHistory();
        setProjectId(id);
        setScenario(next);
        setProjects(loadedProjects);
        setSaveStatus('saved');
        setSaveError(null);
        return id;
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
    [projectId, scenario, resetHistory],
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
    update: history.update,
    replace: history.replace,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
