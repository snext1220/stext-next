import { createEngine, type GameState, type GlobalState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { BrandTitle } from '@stext/ui';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AudioDirector } from './audio.js';
import { loadScenario } from './data.js';
import { href, navigate, useRoute, type Route } from './router.js';
import { Create } from './screens/Create.js';
import { Footer } from './screens/Footer.js';
import { Library } from './screens/Library.js';
import { Menu } from './screens/Menu.js';
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
// 音楽室・案内所の読み物は遊ぶのに要らないので、開いたときに読み込む
const Music = lazy(() => import('./screens/Music.js').then((m) => ({ default: m.Music })));
const About = lazy(() => import('./screens/About.js').then((m) => ({ default: m.About })));
const Post = lazy(() => import('./screens/Post.js').then((m) => ({ default: m.Post })));
const Recruit = lazy(() => import('./screens/Recruit.js').then((m) => ({ default: m.Recruit })));
const Links = lazy(() => import('./screens/Links.js').then((m) => ({ default: m.Links })));
const Gallery = lazy(() => import('./screens/Gallery.js').then((m) => ({ default: m.Gallery })));
const Staff = lazy(() => import('./screens/Staff.js').then((m) => ({ default: m.Staff })));
const Materials = lazy(() =>
  import('./screens/Materials.js').then((m) => ({ default: m.Materials })),
);

/** 開いたときに読み込む画面（変換所を除く） */
const LAZY_PAGES: readonly Route['name'][] = [
  'music',
  'about',
  'post',
  'recruit',
  'links',
  'gallery',
  'staff',
  'materials',
];

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
          <Menu route={route} />
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
        {route.name === 'library' && (
          <Library
            key={route.quest ? 'quest' : 'all'}
            global={global}
            settings={settings}
            quest={route.quest}
          />
        )}
        {route.name === 'records' && <Records global={global} onGlobal={setGlobal} />}
        {LAZY_PAGES.includes(route.name) && (
          <Suspense fallback={<p className="empty-state">開いています…</p>}>
            {route.name === 'music' && <Music />}
            {route.name === 'about' && <About section={route.section} />}
            {route.name === 'post' && <Post section={route.section} />}
            {route.name === 'recruit' && <Recruit />}
            {route.name === 'links' && <Links />}
            {route.name === 'gallery' && <Gallery />}
            {route.name === 'staff' && <Staff />}
            {route.name === 'materials' && <Materials />}
          </Suspense>
        )}
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
      {route.name !== 'play' && <Footer />}
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
