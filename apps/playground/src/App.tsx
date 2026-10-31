import { convertPlaygroundJson, convertScenarioXml } from '@stext/convert';
import { validateScenario, type Scenario } from '@stext/schema';
import { useEffect, useMemo, useState } from 'react';
import { findProblems, problemsByScene } from './checks.js';
import { SCENARIO_BASE, TEMPLATE_BASE } from './config.js';
import { Definitions } from './Definitions.js';
import { FlowView } from './FlowView.js';
import { autoLayout } from './layout.js';
import {
  addChoice,
  addScene,
  deleteScene,
  emptyScenario,
  findScene,
  setPosition,
} from './model.js';
import { Problems } from './Problems.js';
import { SceneEditor } from './SceneEditor.js';
import { deleteSlot, loadSlots, saveSlot, useScenarioStore, type Slot } from './store.js';
import { TestPlay } from './TestPlay.js';

type Tab = 'scene' | 'defs' | 'problems' | 'play';

interface TemplateEntry {
  id: string;
  name: string;
  scenes: number;
}

export function App() {
  const store = useScenarioStore();
  const { scenario } = store;
  const [selected, setSelected] = useState<string | undefined>(() => scenario.scenes[0]?.id);
  const [tab, setTab] = useState<Tab>('scene');
  const [message, setMessage] = useState<string | null>(null);
  // 開き直したときはフロー図を作り直して全体が見えるようにする
  const [flowKey, setFlowKey] = useState(0);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [published, setPublished] = useState<{ id: string; title: string }[]>([]);
  const [slots, setSlots] = useState<Slot[]>(loadSlots);

  const problems = useMemo(() => findProblems(scenario), [scenario]);
  const byScene = useMemo(() => problemsByScene(problems), [problems]);
  const scene = selected ? findScene(scenario, selected) : undefined;

  useEffect(() => {
    fetch(`${TEMPLATE_BASE}templates.json`)
      .then((r) => r.json() as Promise<TemplateEntry[]>)
      .then(setTemplates, () => {});
    fetch(`${SCENARIO_BASE}index.json`)
      .then((r) => r.json() as Promise<{ id: string; title: string; listed: boolean }[]>)
      .then(
        (list) => setPublished(list.filter((e) => e.listed)),
        () => {},
      );
  }, []);

  // Ctrl+Z / Ctrl+Shift+Z（入力欄の中では、ブラウザの取り消しに任せる）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage((m) => (m === text ? null : m)), 4000);
  };

  const open = (s: Scenario, note: string) => {
    const laid = autoLayout(s);
    store.replace(laid);
    setFlowKey((k) => k + 1);
    setSelected(laid.scenes[0]?.id);
    setTab('scene');
    flash(note);
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (/\.xml$/i.test(file.name))
        return open(convertScenarioXml(text, {}).scenario, `${file.name} を変換して開きました`);
      const data = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(data['edges']))
        return open(
          convertPlaygroundJson(data, {}).scenario,
          `${file.name}（旧 Playground）を変換して開きました`,
        );
      const v = validateScenario(data);
      if (!v.ok)
        throw new Error(
          `stext/2 のシナリオとして読めません：${v.issues[0]?.path} ${v.issues[0]?.message}`,
        );
      open(v.scenario, `${file.name} を開きました`);
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  };

  const openUrl = async (url: string, note: string) => {
    try {
      const v = validateScenario(await (await fetch(url)).json());
      if (!v.ok) throw new Error('シナリオの形式が正しくありません');
      open(v.scenario, note);
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scenario, null, 2) + '\n'], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.meta.id || 'scenario'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          SORCERIAN Text <small>Playground</small>
        </strong>
        <input
          className="pg-title"
          aria-label="シナリオのタイトル"
          value={scenario.meta.title}
          onChange={(e) =>
            store.update(
              { ...scenario, meta: { ...scenario.meta, title: e.target.value } },
              'meta.title',
            )
          }
        />
        <div className="pg-menu">
          <select
            aria-label="新しく始める"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'empty') open(emptyScenario(), '新しいシナリオを始めました');
              else if (v.startsWith('t:'))
                void openUrl(`${TEMPLATE_BASE}${v.slice(2)}.json`, 'テンプレートを開きました');
              else if (v.startsWith('s:'))
                void openUrl(
                  `${SCENARIO_BASE}${v.slice(2)}/scenario.json`,
                  '公開シナリオを開きました',
                );
            }}
          >
            <option value="">新規・テンプレート…</option>
            <option value="empty">新しいシナリオ</option>
            <optgroup label="テンプレート">
              {templates.map((t) => (
                <option key={t.id} value={`t:${t.id}`}>
                  {t.name}（{t.scenes} シーン）
                </option>
              ))}
            </optgroup>
            <optgroup label="公開シナリオ">
              {published.map((p) => (
                <option key={p.id} value={`s:${p.id}`}>
                  {p.title}
                </option>
              ))}
            </optgroup>
          </select>
          <label className="pg-button">
            開く…
            <input
              id="open-file"
              type="file"
              accept=".json,.xml"
              hidden
              onChange={(e) => void openFile(e.target.files?.[0])}
            />
          </label>
          <button type="button" onClick={download}>
            保存（JSON）
          </button>
          <select
            aria-label="マイストレージ"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'save') {
                const name = scenario.meta.title || '無題';
                setSlots(saveSlot(name, scenario));
                flash(`マイストレージに「${name}」を保存しました`);
              } else if (v.startsWith('load:')) {
                const slot = slots.find((s) => s.name === v.slice(5));
                if (slot) open(slot.scenario, `マイストレージの「${slot.name}」を開きました`);
              } else if (v.startsWith('del:')) {
                setSlots(deleteSlot(v.slice(4)));
                flash(`マイストレージから「${v.slice(4)}」を消しました`);
              }
            }}
          >
            <option value="">マイストレージ…</option>
            <option value="save">いまのシナリオを保存</option>
            {slots.length > 0 && (
              <optgroup label="開く">
                {slots.map((s) => (
                  <option key={s.name} value={`load:${s.name}`}>
                    {s.name}（{new Date(s.savedAt).toLocaleString('ja-JP')}）
                  </option>
                ))}
              </optgroup>
            )}
            {slots.length > 0 && (
              <optgroup label="消す">
                {slots.map((s) => (
                  <option key={s.name} value={`del:${s.name}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
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
        </div>
      </header>
      {message && (
        <div className="pg-message" role="status">
          {message}
        </div>
      )}
      <main className="pg-main">
        <section className="pg-flow-pane">
          <div className="pg-flow-tools">
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
            {tab === 'problems' && (
              <Problems
                problems={problems}
                onSelect={(id) => {
                  setSelected(id);
                  setTab('scene');
                }}
              />
            )}
            {tab === 'play' && <TestPlay scenario={scenario} startScene={selected} />}
          </div>
        </aside>
      </main>
    </div>
  );
}
