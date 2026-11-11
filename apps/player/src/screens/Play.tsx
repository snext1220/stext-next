import {
  bonusItem,
  createEngine,
  type GameEvent,
  type GameState,
  type GlobalState,
  type MagicName,
} from '@stext/core';
import type { Scenario } from '@stext/schema';
import {
  BattlePanel,
  ChoiceList,
  HeroPanel,
  ItemsPanel,
  MagicPanel,
  Parchment,
  RecordPanel,
  SceneText,
  StatusEditor,
  Toasts,
  createCookieRandomCache,
  type BattleFeedback,
  type HistoryEntry,
  type Toast,
} from '@stext/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AudioDirector } from '../audio.js';
import { bgmUrl, charaImageUrl, imageUrl, seUrl, trophyUrl } from '../config.js';
import { loadIndex } from '../data.js';
import { SaveDialog } from '../SaveDialog.js';
import { href } from '../router.js';
import { saveGame, saveGlobal, writePersistent, type Settings } from '../storage.js';

const PANEL_TABS = [
  {
    id: 'hero',
    ja: '冒険者',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  },
  {
    id: 'magic',
    ja: '魔法',
    icon: 'M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.5-4 6-.6z',
  },
  { id: 'items', ja: '持ち物', icon: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2' },
  {
    id: 'record',
    ja: '記録',
    icon: 'M7 4h11v13a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2v-1h11M7 4a2 2 0 0 0-2 2v11',
  },
] as const;
type PanelTab = (typeof PANEL_TABS)[number]['id'];

const FONT_SIZES = { small: '0.9375rem', medium: '1.0625rem', large: '1.25rem' } as const;

export interface PlayProps {
  id: string;
  scenario: Scenario;
  initial: GameState;
  global: GlobalState;
  onGlobal: (g: GlobalState) => void;
  audio: AudioDirector;
  settings: Settings;
  onSettings: (s: Settings) => void;
}

export function Play({
  id,
  scenario,
  initial,
  global,
  onGlobal,
  audio,
  settings,
  onSettings,
}: PlayProps) {
  const [scenarioResultTotals, setScenarioResultTotals] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [scenarioIndexError, setScenarioIndexError] = useState<string | null>(null);
  const [state, setStateRaw] = useState(initial);
  const [history, setHistory] = useState<{ state: GameState; entry: HistoryEntry }[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tab, setTab] = useState<PanelTab>('hero');
  const [sheet, setSheet] = useState<PanelTab | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const closeSaveDialog = useCallback(() => setSaveDialog(false), []);
  const toastId = useRef(0);
  const pendingSceneScroll = useRef(false);

  useEffect(() => {
    loadIndex().then(
      (entries) =>
        setScenarioResultTotals(new Map(entries.map((entry) => [entry.id, entry.results]))),
      (e: unknown) =>
        setScenarioIndexError(
          e instanceof Error ? e.message : 'シナリオ一覧を読み込めませんでした',
        ),
    );
  }, []);

  const engine = useMemo(
    () =>
      createEngine(scenario, {
        scenarioId: id,
        cache: createCookieRandomCache(),
        scenarioResults: (otherId) => {
          const all = scenarioResultTotals.get(otherId);
          if (all === undefined) return undefined;
          return { count: global.results[otherId]?.length ?? 0, all };
        },
      }),
    [scenario, id, global, scenarioResultTotals],
  );

  useLayoutEffect(() => {
    if (!pendingSceneScroll.current) return;
    pendingSceneScroll.current = false;
    // シーンのDOM更新後に移動し、描画更新とスムーズスクロールの競合を避ける。
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [state]);

  const toast = useCallback((kind: Toast['kind'], title: string, message: string) => {
    const t = { id: ++toastId.current, kind, title, message };
    setToasts((list) => [...list.slice(-2), t]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 3600);
  }, []);

  /** 状態を変えて保存する。saved を渡すと、表示とは別の内容を保存する */
  const setState = useCallback(
    (s: GameState, g: GlobalState = global, saved: GameState = s) => {
      setStateRaw(s);
      saveGame(id, saved);
      if (g !== global) {
        saveGlobal(g);
        onGlobal(g);
      }
    },
    [id, global, onGlobal],
  );

  const view = useMemo(() => engine.view(state, global), [engine, state, global]);
  const itemName = (iid: string) => scenario.items.find((i) => i.id === iid)?.name ?? iid;
  const resultName = (rid: string) => scenario.results.find((r) => r.id === rid)?.name ?? rid;

  const showEvents = useCallback(
    (events: GameEvent[]) => {
      for (const e of events) {
        if (e.type === 'itemGained') toast('item', 'アイテム獲得', itemName(e.id));
        else if (e.type === 'itemLost') toast('info', 'アイテム消失', itemName(e.id));
        else if (e.type === 'resultUnlocked') toast('result', '実績獲得', resultName(e.id));
        else if (e.type === 'bonusAwarded') {
          const item = bonusItem(e.id);
          toast('result', 'ボーナスアイテム', item ? `${item.name}：${item.desc}` : e.id);
        } else if (e.type === 'stateGuarded')
          toast('info', 'シナリオボーナス', `${e.state} を防いだ！`);
        else if (e.type === 'stoneDeath')
          toast('dmg', 'あなたは死んでしまった', '石化から30シーンが経過した');
        else if (e.type === 'forgetCured')
          toast('info', '忘却解除', '20シーン経過で忘却が解消された');
        else if (e.type === 'notEnoughStars') toast('warn', '魔法', '星が不足しているようだ。');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast, scenario],
  );

  // ───── BGM・効果音 ─────
  useEffect(() => {
    if (view.bgm === '@none') {
      audio.stopBgm();
      return;
    }
    const name = view.bgm || scenario.meta.bgm?.main || 'main';
    audio.playBgm(bgmUrl(id, name));
  }, [audio, id, view.bgm, scenario]);
  useEffect(() => {
    if (view.se) audio.playSe(seUrl(id, view.se));
  }, [audio, id, view.id, view.se, history.length]);

  const sceneKey = `${view.id}:${state.ellapsed_scene}:${loadVersion}`;
  const handleBattleFeedback = (feedback: BattleFeedback) => {
    if (feedback.sound) audio.playSe(seUrl(id, feedback.sound, true));
    if (feedback.notice)
      toast(feedback.notice.kind, feedback.notice.title, feedback.notice.message);
  };

  // ───── 選択・戻る・魔法 ─────
  const choose = (index: number, input?: string) => {
    const label = view.choices.find((c) => c.index === index)?.label ?? '';
    const r = engine.choose(state, global, index, input);
    if (r.kind === 'moved') {
      setHistory((h) => [
        ...h.slice(-49),
        { state, entry: { id: String(r.state.scene), label: plainLabel(label) || '（入力）' } },
      ]);
      for (const [next, s] of Object.entries(r.carryOver ?? {})) if (next !== id) saveGame(next, s);
      // 続編が同じシナリオなら、旧エンジンと同じく引き継ぎ用のデータで保存を上書きする（表示はエンディングのまま）
      pendingSceneScroll.current = true;
      setState(r.state, r.global, r.carryOver?.[id] ?? r.state);
      showEvents(r.events);
    } else if (r.kind === 'back') {
      back();
    } else {
      toast(
        'warn',
        '選択',
        {
          notEnoughStars: '星が不足しているようだ。',
          notAllowed: '指定された番号には移動できないようだ。',
          hidden: 'その選択肢は選べません。',
          missingScene: '移動先のシーンがありません。',
        }[r.reason],
      );
    }
  };
  const back = () => {
    const prev = history[history.length - 1];
    if (!prev || state.isEnded) return;
    setHistory((h) => h.slice(0, -1));
    pendingSceneScroll.current = true;
    setState(prev.state);
  };
  const cast = (name: MagicName) => {
    const r = engine.castMagic(state, global, name);
    if (r.events.some((e) => e.type === 'notEnoughStars')) return showEvents(r.events);
    setState(r.state, r.global);
    toast('result', '魔法の行使', `${name} を唱えた。`);
    setSheet(null);
  };
  const consumeItem = (itemId: string) => {
    const r = engine.useItem(state, global, itemId);
    const item = scenario.items.find((i) => i.id === itemId);
    if (r.events.some((e) => e.type === 'itemNotUsable')) {
      toast('warn', `${item?.name ?? itemId}を使った。`, '...しかし、なにも起こらなかった...');
      return;
    }
    setState(r.state, r.global);
    toast('item', `${item?.name ?? itemId}を使った。`, item?.text ?? '');
    showEvents(r.events);
  };
  const onParamChange = useCallback(
    (pid: string, value: string) => setState(engine.setParam(state, pid, value)),
    [engine, state, setState],
  );

  // ───── 数字キーで選ぶ ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveDialog) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      const go = view.choices.filter((c) => c.kind === 'go');
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && go[n - 1]) choose(go[n - 1]!.index);
      if (e.key === 'Backspace' && history.length) back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const resolveImage = useCallback((src: string) => imageUrl(id, src), [id]);
  const fontSize = FONT_SIZES[settings.fontSize];
  const endLabel =
    view.end === 'happy'
      ? 'Happy End'
      : view.end === 'bad'
        ? 'Bad End'
        : view.end === 'good'
          ? 'Good End'
          : null;

  const shareUrl = shareLink(view.tweet ?? scenario.meta.description ?? DEFAULT_SHARE_TEXT);

  const panelBody = (t: PanelTab) =>
    t === 'magic' ? (
      <MagicPanel state={state} onCast={cast} />
    ) : t === 'items' ? (
      <ItemsPanel scenario={scenario} state={state} onUse={consumeItem} />
    ) : t === 'record' ? (
      <RecordPanel
        scenario={scenario}
        scenarioId={id}
        global={global}
        history={history.map((h) => h.entry)}
        trophyUrl={trophyUrl}
      />
    ) : editing ? (
      <StatusEditor
        scenario={scenario}
        state={state}
        onSave={(s) => {
          setState(s);
          setEditing(false);
          toast('info', 'ステータス', '変更を反映しました。');
        }}
        onCancel={() => setEditing(false)}
      />
    ) : (
      <div>
        <HeroPanel
          scenario={scenario}
          state={state}
          portraitUrl={charaImageUrl(id, scenario.meta.imageSet, state.chara)}
        />
        <label className="section-h" htmlFor="memo" style={{ marginTop: 14 }}>
          <span>冒険メモ</span>
        </label>
        <textarea
          id="memo"
          className="memo"
          placeholder="君は冒険中のメモをここに記録しておいても構わないし、脳裏に留めておいても構わない。"
          value={state.memos}
          onChange={(e) => setState({ ...state, memos: e.target.value })}
        />
        <button
          type="button"
          className="chip-btn"
          style={{ marginTop: 10 }}
          onClick={() => setEditing(true)}
        >
          ステータスを編集
        </button>
      </div>
    );

  return (
    <div className="play">
      {scenarioIndexError && (
        <p className="error-box" role="alert">
          他シナリオの実績数を読み込めませんでした: {scenarioIndexError}
        </p>
      )}
      <Parchment
        as="article"
        seed={7}
        style={{
          ['--book-size' as string]: fontSize,
          // ゴシックのときは本文の中だけ --f-book を差し替える（冒険者パネルや他の画面は明朝のまま）
          ...(settings.fontFamily === 'gothic' ? { ['--f-book' as string]: 'var(--f-ui)' } : {}),
        }}
      >
        <header className="page-head">
          <span className="title">
            {scenario.meta.title}
            {history.length > 0 && !state.isEnded && (
              <button
                type="button"
                className="mini-btn"
                style={{ marginLeft: 10 }}
                onClick={back}
                title="直前の節に戻る（Backspace）"
              >
                ← 戻る
              </button>
            )}
          </span>
          <span className="para">
            <small>{endLabel ?? (scenario.meta.showSummary ? '' : '節')}</small>
            {scenario.meta.showSummary && view.summary ? view.summary : view.id}
          </span>
        </header>
        <button type="button" className="chip-btn" onClick={() => setSaveDialog(true)}>
          セーブ／ロード
        </button>
        <SceneText
          className="prose"
          markdown={view.markdown}
          resolveImage={resolveImage}
          onParamChange={onParamChange}
        />
        <BattlePanel
          key={sceneKey}
          engine={engine}
          scenario={scenario}
          state={state}
          global={global}
          view={view}
          onStateChange={(next, events, feedback) => {
            setState(next);
            showEvents(events);
            if (feedback) handleBattleFeedback(feedback);
          }}
          onFeedback={handleBattleFeedback}
          resolveImage={resolveImage}
        />
        <div className="rule" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="M10 1 12.4 7.6 19 10 12.4 12.4 10 19 7.6 12.4 1 10 7.6 7.6z" />
          </svg>
        </div>
        <ChoiceList choices={view.choices} onChoose={choose} />
        {view.afterText && (
          <SceneText
            className="prose after-text"
            markdown={view.afterText}
            resolveImage={resolveImage}
          />
        )}
        <div className="end-actions" style={{ marginTop: 16 }}>
          <a
            className="chip-btn share-link"
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            𝕏 でポスト
          </a>
        </div>
        {view.end && (
          <div className="end-actions">
            <a className="btn" href={href({ name: 'create', id })}>
              {view.end === 'bad' ? '最初から冒険に挑戦する' : 'もう一度冒険する'}
            </a>
            <a className="btn ghost" href={href({ name: 'library' })}>
              ペンタウァに帰還する
            </a>
          </div>
        )}
      </Parchment>

      <aside className="panel" aria-label="冒険者パネル">
        <div className="tabs" role="tablist">
          {PANEL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.ja}
            </button>
          ))}
        </div>
        <div className="card">{panelBody(tab)}</div>
        <ReadingSettings settings={settings} onSettings={onSettings} />
      </aside>

      <nav className="mtabs" aria-label="冒険者メニュー">
        {PANEL_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setSheet(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            {t.id === 'hero' ? <b>HP {state.chara.hp}</b> : <span>{t.ja}</span>}
          </button>
        ))}
      </nav>
      {sheet && (
        <div>
          <div className="sheet-backdrop" onClick={() => setSheet(null)} />
          <div
            className="sheet"
            role="dialog"
            aria-label={PANEL_TABS.find((t) => t.id === sheet)!.ja}
          >
            <div className="grab" />
            <div className="tabs" role="tablist" style={{ marginBottom: 14 }}>
              {PANEL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={sheet === t.id}
                  onClick={() => setSheet(t.id)}
                >
                  {t.ja}
                </button>
              ))}
            </div>
            {panelBody(sheet)}
            {sheet === 'hero' && !editing && (
              <section className="mobile-readset">
                <h3>表示設定</h3>
                <ReadingSettings settings={settings} onSettings={onSettings} />
              </section>
            )}
          </div>
        </div>
      )}

      <Toasts toasts={toasts} />
      {saveDialog && (
        <SaveDialog
          id={id}
          state={state}
          onClose={closeSaveDialog}
          onLoad={(loaded) => {
            if (!scenario.scenes.some((scene) => String(scene.id) === String(loaded.scene)))
              throw new Error('保存されたシーンがシナリオにありません');
            writePersistent(id, JSON.stringify(loaded));
            setHistory([]);
            setEditing(false);
            setSheet(null);
            setToasts([]);
            pendingSceneScroll.current = true;
            setStateRaw(loaded);
            setLoadVersion((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function ReadingSettings({ settings, onSettings }: Pick<PlayProps, 'settings' | 'onSettings'>) {
  return (
    <div className="readset">
      <span className="readset-group">
        <span>文字</span>
        <span className="seg">
          {(['small', 'medium', 'large'] as const).map((k, i) => (
            <button
              key={k}
              type="button"
              aria-pressed={settings.fontSize === k}
              onClick={() => onSettings({ ...settings, fontSize: k })}
            >
              {['小', '中', '大'][i]}
            </button>
          ))}
        </span>
      </span>
      <span className="readset-group">
        <span>書体</span>
        <span className="seg">
          {(['mincho', 'gothic'] as const).map((k, i) => (
            <button
              key={k}
              type="button"
              aria-pressed={settings.fontFamily === k}
              onClick={() => onSettings({ ...settings, fontFamily: k })}
            >
              {['明朝', 'ゴシック'][i]}
            </button>
          ))}
        </span>
      </span>
      <span>· 数字キーで選択、Backspace で戻る</span>
    </div>
  );
}

function plainLabel(markdown: string) {
  return markdown.replace(/<rt>.*?<\/rt>|<rp>.*?<\/rp>|<[^>]+>|[*_]/g, '');
}

const DEFAULT_SHARE_TEXT =
  '原作30周年記念企画「SORCERIAN Text」ユーザー参加型のゲームブック版ソーサリアン';

/** X（旧 Twitter）の投稿画面へのリンク（旧エンジンのツイートボタンと同じ文・ハッシュタグ・via） */
function shareLink(text: string) {
  const params = new URLSearchParams({
    text,
    url: location.href.split('#')[0] ?? '',
    hashtags: 'falcom,stext',
    via: 'snext1220',
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
