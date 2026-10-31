import { createEngine, type GameState, type GlobalState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { BrandTitle } from '@stext/ui';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AudioDirector } from './audio.js';
import { loadScenario } from './data.js';
import { href, navigate, useRoute } from './router.js';
import { Create } from './screens/Create.js';
import { Library } from './screens/Library.js';
import { Play } from './screens/Play.js';
import { Records } from './screens/Records.js';
import {
  loadGame,
  loadGlobal,
  loadSettings,
  saveGame,
  saveGlobal,
  saveSettings,
  type Settings,
} from './storage.js';

// 変換所は変換器（XML パーサを含む）を使うので、開いたときに読み込む
const Convert = lazy(() => import('./screens/Convert.js').then((m) => ({ default: m.Convert })));

export function App() {
  const route = useRoute();
  const [global, setGlobal] = useState<GlobalState>(loadGlobal);
  const [settings, setSettingsRaw] = useState<Settings>(loadSettings);
  const audio = useMemo(() => new AudioDirector(global.bgm), []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSettings = (s: Settings) => {
    setSettingsRaw(s);
    saveSettings(s);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (route.name !== 'play') audio.stop();
  }, [route.name, audio]);

  const toggleSound = () => {
    const g = { ...global, bgm: !global.bgm };
    setGlobal(g);
    saveGlobal(g);
    audio.setEnabled(g.bgm);
  };
  const toggleTheme = () => {
    const dark =
      settings.theme === 'system'
        ? matchMedia('(prefers-color-scheme: dark)').matches
        : settings.theme === 'dark';
    setSettings({ ...settings, theme: dark ? 'light' : 'dark' });
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <a href={href({ name: 'library' })} style={{ textDecoration: 'none' }}>
            <BrandTitle note="v2" />
          </a>
          <nav className="screens" aria-label="画面">
            <a
              className="chip-btn"
              aria-current={route.name === 'library' ? 'page' : undefined}
              href={href({ name: 'library' })}
            >
              書庫
            </a>
            <a
              className="chip-btn"
              aria-current={route.name === 'records' ? 'page' : undefined}
              href={href({ name: 'records' })}
            >
              記録
            </a>
            <a
              className="chip-btn"
              aria-current={route.name === 'convert' ? 'page' : undefined}
              href={href({ name: 'convert' })}
            >
              変換所
            </a>
          </nav>
          <div className="tools">
            <button
              type="button"
              className="chip-btn"
              onClick={toggleSound}
              aria-pressed={global.bgm}
            >
              {global.bgm ? '音あり' : '音なし'}
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={toggleTheme}
              aria-label="昼と夜を切り替え"
            >
              昼／夜
            </button>
          </div>
        </div>
      </header>
      <main className="shell">
        {route.name === 'library' && <Library global={global} settings={settings} />}
        {route.name === 'records' && <Records global={global} onGlobal={setGlobal} />}
        {route.name === 'convert' && (
          <Suspense fallback={<p className="empty-state">変換所を開いています…</p>}>
            <Convert />
          </Suspense>
        )}
        {(route.name === 'create' || route.name === 'play') && (
          <ScenarioRoute
            key={`${route.name}:${route.id}`}
            id={route.id}
            mode={route.name}
            global={global}
            onGlobal={setGlobal}
            audio={audio}
            settings={settings}
            onSettings={setSettings}
          />
        )}
      </main>
    </>
  );
}

function ScenarioRoute({
  id,
  mode,
  global,
  onGlobal,
  audio,
  settings,
  onSettings,
}: {
  id: string;
  mode: 'create' | 'play';
  global: GlobalState;
  onGlobal: (g: GlobalState) => void;
  audio: AudioDirector;
  settings: Settings;
  onSettings: (s: Settings) => void;
}) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 遊ぶ画面では、開いた時点のセーブデータから始める（エンディング後に作成画面へ飛ばないよう、一度だけ読む）
  const [initial] = useState<GameState | undefined>(() =>
    mode === 'play' ? loadGame(id) : undefined,
  );

  useEffect(() => {
    loadScenario(id).then(setScenario, (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [id]);

  if (error) {
    return (
      <div className="error-box" role="alert">
        {error} <a href={href({ name: 'library' })}>書庫へ戻る</a>
      </div>
    );
  }
  if (!scenario) return <p className="empty-state">シナリオを開いています…</p>;

  if (mode === 'create') {
    return (
      <Create
        id={id}
        scenario={scenario}
        global={global}
        onStart={(character) => {
          const step = createEngine(scenario, { scenarioId: id }).begin(character, global);
          saveGame(id, step.state);
          saveGlobal(step.global);
          onGlobal(step.global);
          onSettings({ ...settings, recent: id });
          navigate({ name: 'play', id });
        }}
      />
    );
  }

  if (!initial || initial.isEnded) {
    // 遊んでいる冒険がなければ、キャラクター作成へ
    queueMicrotask(() => navigate({ name: 'create', id }));
    return null;
  }
  if (settings.recent !== id) queueMicrotask(() => onSettings({ ...settings, recent: id }));
  return (
    <Play
      id={id}
      scenario={scenario}
      initial={initial}
      global={global}
      onGlobal={onGlobal}
      audio={audio}
      settings={settings}
      onSettings={onSettings}
    />
  );
}
