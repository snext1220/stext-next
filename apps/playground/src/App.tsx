import { convertPlaygroundJson, convertScenarioXml } from '@stext/convert';
import {
  validateScenario,
  validateScenarioDraft,
  type DraftScenario as Scenario,
} from '@stext/schema';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createScenarioArchive, findMissingResources, validateArchiveId } from './archive.js';
import { findProblems, problemsByScene } from './checks.js';
import { SCENARIO_BASE, TEMPLATE_BASE } from './config.js';
import { Definitions } from './Definitions.js';
import { FlowView } from './FlowView.js';
import { HELP_INDEX, useHelp } from './help/HelpPanel.js';
import { autoLayout } from './layout.js';
import {
  pickLocalFile,
  scenarioJson,
  useLocalFileSync,
  type LocalFileHandle,
} from './localFileSync.js';
import {
  addChoice,
  addScene,
  deleteScene,
  emptyScenario,
  findScene,
  sceneSelectionGroups,
  setPosition,
} from './model.js';
import { PostDialog } from './PostDialog.js';
import { Problems } from './Problems.js';
import { ProjectDialog } from './ProjectDialog.js';
import { ResourcesPanel } from './ResourcesPanel.js';
import { SceneSearchDialog } from './SceneSearchDialog.js';
import type { LocalResource } from './resources.js';
import { SceneEditor } from './SceneEditor.js';
import { Splitter, useSideWidth } from './Splitter.js';
import { useScenarioStore } from './store.js';
import {
  emptyPreviewStartOverrides,
  TestPlay,
  type PreviewRun,
  type PreviewStartOverrides,
} from './TestPlay.js';
import { clearLegacyPostData } from './post.js';
import { ExportDialog, WorkDialog, type WorkMenuTemplate } from './WorkspaceMenus.js';

type Tab = 'scene' | 'defs' | 'resources' | 'problems' | 'play';

export function App() {
  const store = useScenarioStore();
  const { scenario } = store;
  const localFile = useLocalFileSync(store.projectId, scenario);
  const [readingFile, setReadingFile] = useState(false);
  const fileReading = useRef(false);
  const [selected, setSelected] = useState<string | undefined>(() => scenario.scenes[0]?.id);
  const [previewScene, setPreviewScene] = useState<string>();
  const [previewSetup, setPreviewSetup] = useState<{
    projectId: string | undefined;
    overrides: PreviewStartOverrides;
  }>(() => ({ projectId: store.projectId, overrides: emptyPreviewStartOverrides(scenario) }));
  const [previewSession, setPreviewSession] = useState<{
    projectId: string | undefined;
    run: PreviewRun;
  } | null>(null);
  const [tab, setTab] = useState<Tab>('scene');
  const [previewAudioEnabled, setPreviewAudioEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  // 開き直したときはフロー図を作り直して全体が見えるようにする
  const [flowKey, setFlowKey] = useState(0);
  const [templates, setTemplates] = useState<WorkMenuTemplate[]>([]);
  const [published, setPublished] = useState<{ id: string; title: string }[]>([]);
  const [scenarioResultTotals, setScenarioResultTotals] = useState<ReadonlyMap<
    string,
    number
  > | null>(null);
  const [scenarioIndexError, setScenarioIndexError] = useState<string | null>(null);
  const [sideWidth, setSideWidth] = useSideWidth();
  const [showWorkMenu, setShowWorkMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postingSnapshot, setPostingSnapshot] = useState<{
    scenario: Scenario;
    projectId: string;
    resources: LocalResource[];
  } | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [showSceneSearch, setShowSceneSearch] = useState(false);
  const [resourceUrls, setResourceUrls] = useState<Record<string, string>>({});
  const [zipProgress, setZipProgress] = useState<{
    phase: 'preparing' | 'creating';
    completedBytes: number;
    totalBytes: number;
  } | null>(null);
  const [postPreparing, setPostPreparing] = useState(false);
  const preparingSnapshot = zipProgress?.phase === 'preparing' || postPreparing;
  const workspaceLocked = preparingSnapshot || localFile.busy || readingFile;
  const openHelp = useHelp();

  const problems = useMemo(() => findProblems(scenario), [scenario]);
  const playable = useMemo(
    () => (tab === 'play' ? validateScenario(scenario) : null),
    [scenario, tab],
  );
  const byScene = useMemo(() => problemsByScene(problems), [problems]);
  const scene = selected ? findScene(scenario, selected) : undefined;
  const sceneGroups = useMemo(() => sceneSelectionGroups(scenario), [scenario]);
  const [focusRequest, setFocusRequest] = useState<{ id: string }>();
  const previewStartOverrides =
    previewSetup.projectId === store.projectId
      ? previewSetup.overrides
      : emptyPreviewStartOverrides(scenario);
  const updatePreviewStartOverrides = useCallback(
    (overrides: PreviewStartOverrides) =>
      setPreviewSetup({ projectId: store.projectId, overrides }),
    [store.projectId],
  );
  const clearPreviewStartOverrides = useCallback(
    () =>
      setPreviewSetup({
        projectId: store.projectId,
        overrides: emptyPreviewStartOverrides(scenario),
      }),
    [scenario, store.projectId],
  );
  const onPreviewSceneChange = useCallback((id: string | undefined) => {
    setPreviewScene(id);
  }, []);

  useEffect(() => {
    const urls = Object.fromEntries(
      store.resources.map((resource) => [resource.path, URL.createObjectURL(resource.blob)]),
    );
    const timer = window.setTimeout(() => setResourceUrls(urls), 0);
    return () => {
      window.clearTimeout(timer);
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    };
  }, [store.resources]);

  useEffect(() => {
    fetch(`${TEMPLATE_BASE}templates.json`)
      .then((r) => r.json() as Promise<WorkMenuTemplate[]>)
      .then(setTemplates, () => {});
    fetch(`${SCENARIO_BASE}index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`シナリオ一覧を読み込めませんでした（${r.status}）`);
        return r.json() as Promise<
          { id: string; title: string; listed: boolean; results: number }[]
        >;
      })
      .then((list) => {
        setPublished(list.filter((e) => e.listed));
        setScenarioResultTotals(new Map(list.map((entry) => [entry.id, entry.results])));
      })
      .catch((e: unknown) =>
        setScenarioIndexError(
          e instanceof Error ? e.message : 'シナリオ一覧を読み込めませんでした',
        ),
      );
  }, []);

  // Ctrl+Z / Ctrl+Shift+Z（入力欄の中では、ブラウザの取り消しに任せる）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if (workspaceLocked) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, workspaceLocked]);

  if (!store.ready || store.transitioning)
    return (
      <div className="pg-loading" role="status">
        {store.ready
          ? '作品を保存して切り替えています…'
          : 'このブラウザーに保存されたシナリオを読み込んでいます…'}
      </div>
    );

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage((m) => (m === text ? null : m)), 4000);
  };

  const open = async (s: Scenario, note: string) => {
    const laid = autoLayout(s);
    try {
      const id = await store.createProject(laid);
      if (!id) throw new Error('作品の作成が中断されました');
      setPreviewSession(null);
      setPreviewSetup({ projectId: undefined, overrides: emptyPreviewStartOverrides(laid) });
      setFlowKey((k) => k + 1);
      setSelected(laid.scenes[0]?.id);
      setFocusRequest(undefined);
      setTab('scene');
      flash(note);
      return id;
    } catch (e) {
      flash(`作品を切り替えられませんでした: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const openFile = async (
    file: Pick<File, 'name' | 'text'> | undefined,
    handle?: LocalFileHandle,
  ) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (/\.xml$/i.test(file.name))
        return await open(
          convertScenarioXml(text, {}).scenario,
          `${file.name} を変換して開きました`,
        );
      const data = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(data['edges']))
        return await open(
          convertPlaygroundJson(data, {}).scenario,
          `${file.name}（旧 Playground）を変換して開きました`,
        );
      const v = validateScenarioDraft(data);
      if (!v.ok)
        throw new Error(
          `stext/2 のシナリオとして読めません：${v.issues[0]?.path} ${v.issues[0]?.message}`,
        );
      const scenarioId = v.scenario.meta.id;
      const canLink = handle && scenarioId?.trim();
      const note = canLink
        ? `${file.name} を開き、保存先にも連携しました。まだファイルには書き込んでいません。`
        : handle
          ? `${file.name} を開きました。ID未設定のため未連携です。作品と保存先に同じIDを設定後、［保存先ファイルを選択…］で連携してください。`
          : `${file.name} を開きました`;
      const id = await open(v.scenario, note);
      if (id && handle && scenarioId?.trim())
        localFile.attach(id, { handle, scenarioId, baseline: text });
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  };

  const readFile = async (fallbackFile?: File) => {
    if (fileReading.current) return;
    fileReading.current = true;
    setReadingFile(true);
    try {
      if (fallbackFile) {
        await openFile(fallbackFile);
      } else {
        const handle = await pickLocalFile(true);
        if (!handle) return;
        const file = await handle.getFile();
        await openFile({ name: handle.name, text: () => file.text() }, handle);
      }
      setShowWorkMenu(false);
    } catch (error) {
      flash(
        `ファイルを読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      fileReading.current = false;
      setReadingFile(false);
    }
  };

  const openUrl = async (url: string, note: string) => {
    try {
      const v = validateScenarioDraft(await (await fetch(url)).json());
      if (!v.ok) throw new Error('シナリオの形式が正しくありません');
      await open(v.scenario, note);
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = () => {
    downloadBlob(
      new Blob([scenarioJson(scenario)], { type: 'application/json' }),
      `${scenario.meta.id || 'scenario'}.json`,
    );
  };

  const downloadArchive = async () => {
    if (zipProgress) return;
    const idError = validateArchiveId(scenario.meta.id);
    if (idError) {
      flash(idError);
      return;
    }

    setZipProgress({ phase: 'preparing', completedBytes: 0, totalBytes: 0 });
    try {
      const snapshot = await store.createExportSnapshot();
      const snapshotId = snapshot.scenario.meta.id;
      const snapshotIdError = validateArchiveId(snapshotId);
      if (snapshotIdError) throw new Error(snapshotIdError);
      const missing = findMissingResources(store.projectId, snapshot.scenario, snapshot.resources);
      if (
        missing.length > 0 &&
        !window.confirm(
          `次の素材は未登録のためZIPに含まれません。\n\n${missing.join('\n')}\n\nこのままZIPを作成しますか？`,
        )
      )
        return;
      setZipProgress({ phase: 'creating', completedBytes: 0, totalBytes: 0 });
      const archive = await createScenarioArchive(
        store.projectId,
        snapshot.scenario,
        snapshot.resources,
        ({ completedBytes, totalBytes }) =>
          setZipProgress({ phase: 'creating', completedBytes, totalBytes }),
      );
      downloadBlob(archive, `${snapshotId}.zip`);
      flash('ZIPをダウンロードしました');
    } catch (error) {
      flash(`ZIPを作成できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setZipProgress(null);
    }
  };

  const preparePost = async () => {
    if (postPreparing || zipProgress) return;
    const cleanupError = clearLegacyPostData();
    if (cleanupError) {
      flash(`旧投稿フォームの保存情報を削除できませんでした: ${cleanupError}`);
      return;
    }
    setPostPreparing(true);
    try {
      const snapshot = await store.createExportSnapshot();
      setPostingSnapshot({
        ...snapshot,
        projectId: store.projectId,
      });
      setPosting(true);
    } catch (error) {
      flash(
        `提出用の作品を保存できませんでした: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setPostPreparing(false);
    }
  };

  const newScene = (from?: string) => {
    const r = addScene(scenario, from ? { from } : {});
    store.update(autoLayout(r.scenario));
    setSelected(r.id);
    setTab('scene');
  };

  const errors = problems.filter((p) => p.severity === 'error').length;

  return (
    <div className="pg">
      <header className="pg-bar">
        <strong className="stext-brand">
          SORCERIAN NText <small>Playground</small>
        </strong>
        <input
          className="pg-title"
          aria-label="シナリオのタイトル"
          value={scenario.meta.title}
          disabled={workspaceLocked}
          onChange={(e) =>
            store.update(
              { ...scenario, meta: { ...scenario.meta, title: e.target.value } },
              'meta.title',
            )
          }
        />
        <div className="pg-menu" inert={workspaceLocked}>
          <button type="button" onClick={() => setShowWorkMenu(true)}>
            作品…
          </button>
          <button type="button" onClick={() => setShowExportMenu(true)}>
            エクスポート…
          </button>
          <button type="button" onClick={() => void preparePost()}>
            提出…
          </button>
          <button
            type="button"
            onClick={store.undo}
            disabled={!store.canUndo}
            title="元に戻す（Ctrl+Z）"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={store.redo}
            disabled={!store.canRedo}
            title="やり直す（Ctrl+Shift+Z）"
          >
            ↷
          </button>
          {openHelp && (
            <button type="button" onClick={() => openHelp(HELP_INDEX)}>
              ヘルプ
            </button>
          )}
        </div>
        {zipProgress && (
          <div className="pg-save-state" role="status" aria-live="polite">
            {zipProgress.phase === 'preparing'
              ? 'ZIP作成用のデータを保存しています…'
              : `ZIPを作成しています… ${
                  zipProgress.totalBytes
                    ? Math.floor((zipProgress.completedBytes / zipProgress.totalBytes) * 100)
                    : 0
                }%`}
          </div>
        )}
        {postPreparing && (
          <div className="pg-save-state" role="status" aria-live="polite">
            提出用の作品を保存しています…
          </div>
        )}
      </header>
      {message && (
        <div className="pg-message" role="status">
          {message}
        </div>
      )}
      <div
        className={`pg-save-state${store.saveStatus === 'error' ? ' error' : ''}`}
        role={store.saveStatus === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {store.saveStatus === 'pending' && '変更を保存します…'}
        {store.saveStatus === 'saving' && 'このブラウザーに保存中…'}
        {store.saveStatus === 'saved' && 'このブラウザーに保存済み'}
        {store.saveStatus === 'error' && (
          <>
            <span>自動保存に失敗しました: {store.saveError}</span>
            <button type="button" onClick={store.retrySave}>
              再試行
            </button>
          </>
        )}
      </div>
      <main
        className="pg-main"
        inert={workspaceLocked}
        style={
          sideWidth === undefined
            ? undefined
            : ({ '--pg-side-width': `${sideWidth}px` } as CSSProperties)
        }
      >
        <section className="pg-flow-pane">
          <div className="pg-flow-tools">
            <select
              className="pg-scene-select"
              aria-label="編集するシーン"
              value={scene?.id ?? ''}
              onChange={(e) => {
                setSelected(e.target.value);
                setTab('scene');
                setFocusRequest({ id: e.target.value });
              }}
            >
              <option value="" disabled>
                編集するシーンを選択
              </option>
              {sceneGroups.map((group, index) => (
                <optgroup key={index} label={group.title}>
                  {group.scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}：{s.summary || '（サマリーなし）'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={() => setShowSceneSearch(true)}>
              シーンを検索…
            </button>
            <button type="button" onClick={() => newScene()}>
              ＋ シーン
            </button>
            <button type="button" onClick={() => newScene(selected)} disabled={!selected}>
              ＋ 選択中のシーンから
            </button>
            <button
              type="button"
              onClick={() => {
                store.update(autoLayout(scenario, true));
                setFlowKey((k) => k + 1);
              }}
            >
              自動で並べる
            </button>
            <span className="pg-hint">
              {scenario.scenes.length} シーン · 右の点から別のシーンへ線を引くと選択肢になります
            </span>
          </div>
          <FlowView
            key={flowKey}
            scenario={scenario}
            selected={selected}
            playingScene={previewScene}
            focusRequest={focusRequest}
            problems={byScene}
            onSelect={(id) => {
              setSelected(id);
              if (tab !== 'play') setTab('scene');
            }}
            onMove={(id, x, y) => store.update(setPosition(scenario, id, x, y))}
            onConnect={(from, to) => {
              store.update(addChoice(scenario, from, to));
              setSelected(from);
              setTab('scene');
            }}
          />
        </section>
        <Splitter width={sideWidth} onChange={setSideWidth} />
        <aside className="pg-side">
          <div className="tabs pg-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'scene'}
              onClick={() => setTab('scene')}
            >
              シーン
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'defs'}
              onClick={() => setTab('defs')}
            >
              定義
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'resources'}
              onClick={() => setTab('resources')}
            >
              素材
              {store.resources.length > 0 && (
                <span className="pg-badge">{store.resources.length}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'problems'}
              onClick={() => setTab('problems')}
            >
              検査
              {problems.length > 0 && (
                <span className={`pg-badge${errors ? ' error' : ''}`}>{problems.length}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'play'}
              onClick={() => setTab('play')}
            >
              試遊
            </button>
          </div>
          <div className="pg-side-body">
            {tab === 'scene' &&
              (scene ? (
                <SceneEditor
                  key={scene.id}
                  scenario={scenario}
                  scene={scene}
                  onChange={store.update}
                  onRenamed={setSelected}
                  onAddScene={() => newScene(scene.id)}
                  onDelete={() => {
                    store.update(deleteScene(scenario, scene.id));
                    setSelected(scenario.scenes[0]?.id);
                    flash(`§${scene.id} を削除しました（元に戻せます）`);
                  }}
                />
              ) : (
                <p className="pg-hint">フロー図でシーンを選んでください。</p>
              ))}
            {tab === 'defs' && <Definitions scenario={scenario} onChange={store.update} />}
            {tab === 'resources' && (
              <ResourcesPanel
                scenario={scenario}
                resources={store.resources}
                ready={store.resourcesReady}
                error={store.resourceError}
                urls={resourceUrls}
                onRegister={store.registerResource}
                onDelete={store.deleteResource}
              />
            )}
            {tab === 'problems' && (
              <Problems
                problems={problems}
                onSelect={(id) => {
                  setSelected(id);
                  setTab('scene');
                }}
              />
            )}
            {tab === 'play' && playable && !playable.ok && (
              <p className="pg-error" role="alert">
                データ形式に問題があるため試遊できません。［検査］タブで問題箇所を確認し、修正してください。
              </p>
            )}
            {tab === 'play' && playable?.ok && (
              <TestPlay
                key={store.projectId}
                audioEnabled={previewAudioEnabled}
                onAudioEnabledChange={setPreviewAudioEnabled}
                scenario={playable.scenario}
                initialRun={
                  previewSession && previewSession.projectId === store.projectId
                    ? previewSession.run
                    : null
                }
                onRunChange={(run) => {
                  setPreviewSession({ projectId: store.projectId, run });
                  const id = String(run.state.scene);
                  setSelected(id);
                  setFocusRequest({ id });
                }}
                startScene={selected}
                onSceneChange={onPreviewSceneChange}
                startOverrides={previewStartOverrides}
                onStartOverridesChange={updatePreviewStartOverrides}
                onClearStartOverrides={clearPreviewStartOverrides}
                resourceUrls={resourceUrls}
                scenarioResultTotals={scenarioResultTotals}
                scenarioIndexError={scenarioIndexError}
              />
            )}
          </div>
        </aside>
      </main>
      {showWorkMenu && (
        <WorkDialog
          busy={readingFile}
          autoLink={localFile.supported}
          onPickFile={() => void readFile()}
          templates={templates}
          published={published}
          onNew={() => {
            setShowWorkMenu(false);
            void open(emptyScenario(), '新しいシナリオを始めました');
          }}
          onOpenTemplate={(id) => {
            setShowWorkMenu(false);
            void openUrl(`${TEMPLATE_BASE}${id}.json`, 'テンプレートを開きました');
          }}
          onOpenPublished={(id) => {
            setShowWorkMenu(false);
            void openUrl(`${SCENARIO_BASE}${id}/scenario.json`, '公開シナリオを開きました');
          }}
          onOpenFile={(file) => {
            void readFile(file);
          }}
          onOpenSavedProjects={() => setShowProjects(true)}
          onClose={() => setShowWorkMenu(false)}
        />
      )}
      {showExportMenu && (
        <ExportDialog
          onExportZip={() => void downloadArchive()}
          onExportJson={download}
          onClose={() => setShowExportMenu(false)}
          zipDisabled={zipProgress !== null}
          localFile={localFile}
        />
      )}
      {posting && postingSnapshot && (
        <PostDialog
          scenario={postingSnapshot.scenario}
          projectId={postingSnapshot.projectId}
          resources={postingSnapshot.resources}
          errors={
            findProblems(postingSnapshot.scenario).filter((problem) => problem.severity === 'error')
              .length
          }
          onClose={() => {
            setPosting(false);
            setPostingSnapshot(null);
          }}
        />
      )}
      {showProjects && (
        <ProjectDialog
          projects={store.projects}
          currentId={store.projectId}
          onClose={() => setShowProjects(false)}
          onDelete={async (id) => {
            const wasCurrent = await store.deleteProject(id);
            localFile.forget(id);
            if (wasCurrent) {
              setPreviewSession(null);
              setPreviewSetup({
                projectId: undefined,
                overrides: emptyPreviewStartOverrides(emptyScenario()),
              });
              setSelected('0');
              setFocusRequest(undefined);
              setFlowKey((key) => key + 1);
              setTab('scene');
              setShowProjects(false);
              flash('編集中の作品と登録素材を削除し、新しいシナリオを開始しました');
            } else {
              flash('保存済みの作品と登録素材を削除しました');
            }
            return wasCurrent;
          }}
          onOpen={(id) => {
            void store.openProject(id).then(
              (loaded) => {
                setPreviewSession(null);
                setPreviewSetup({ projectId: id, overrides: emptyPreviewStartOverrides(loaded) });
                setSelected(loaded.scenes[0]?.id);
                setFocusRequest(undefined);
                setFlowKey((key) => key + 1);
                setTab('scene');
                setShowProjects(false);
                flash(`「${loaded.meta.title || '無題'}」を開きました`);
              },
              (error: unknown) =>
                flash(
                  `作品を開けませんでした: ${error instanceof Error ? error.message : String(error)}`,
                ),
            );
          }}
        />
      )}
      {showSceneSearch && (
        <SceneSearchDialog
          scenario={scenario}
          onClose={() => setShowSceneSearch(false)}
          onSelect={(id) => {
            setSelected(id);
            setTab('scene');
            setFocusRequest({ id });
            setShowSceneSearch(false);
          }}
        />
      )}
    </div>
  );
}
