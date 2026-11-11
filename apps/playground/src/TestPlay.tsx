import {
  createEngine,
  emptyGlobalState,
  GLOBAL_SAVE_KEY,
  readLegacyGlobal,
  type GameEvent,
  type GameState,
  type GlobalState,
} from '@stext/core';
import type { DraftScenario, Scenario } from '@stext/schema';
import {
  BattlePanel,
  ChoiceList,
  HeroPanel,
  SceneText,
  createCookieRandomCache,
  type BattleFeedback,
} from '@stext/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bgmUrl, charaImageUrl, imageUrl, seUrl } from './config.js';
import { localAudioPath } from './resources.js';

const STAR_NAMES = ['月', '火星', '水星', '木星', '金星', '土星', '太陽'];

function usePreviewAudio(
  ref: React.RefObject<HTMLAudioElement | null>,
  url: string | undefined,
  enabled: boolean,
  trigger: unknown,
  loop: boolean,
) {
  const retry = useRef<(() => void) | null>(null);
  const lastTrigger = useRef(trigger);
  const [notice, setNotice] = useState<{ url: string; message: string } | null>(null);
  useEffect(() => {
    const changed = lastTrigger.current !== trigger;
    lastTrigger.current = trigger;
    const audio = ref.current;
    if (!audio || !url || !enabled || (!loop && !changed)) return;
    let active = true;
    let attempt = 0;
    const name = loop ? 'BGM' : '効果音';
    const play = () => {
      retry.current = null;
      const currentAttempt = ++attempt;
      void audio.play().then(
        () => {
          if (active && attempt === currentAttempt) setNotice(null);
        },
        (error: unknown) => {
          if (!active || attempt !== currentAttempt) return;
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            setNotice({
              url,
              message: `${name}の自動再生が制限されています。試遊内のクリックまたはキー操作で再生します。`,
            });
            retry.current = play;
          } else {
            setNotice({
              url,
              message: `${name}を再生できませんでした：${error instanceof Error ? error.message : String(error)}`,
            });
          }
        },
      );
    };
    audio.volume = loop ? 0.2 : 0.9;
    if (!loop) audio.currentTime = 0;
    play();
    return () => {
      active = false;
      retry.current = null;
      audio.pause();
      setNotice(null);
    };
  }, [ref, url, enabled, trigger, loop]);
  return {
    retry: () => retry.current?.(),
    cancelRetry: () => {
      retry.current = null;
    },
    message: enabled && notice && notice.url === url ? notice.message : null,
  };
}

export interface PreviewStartOverrides {
  items: string[];
  flags: string[];
  params: Record<string, string>;
  stars: string[];
  bgm: string;
}

interface PreviewSnapshot {
  state: GameState;
  global: GlobalState;
  log: string[];
}

export interface PreviewRun extends PreviewSnapshot {
  previous?: PreviewSnapshot;
}

export function emptyPreviewStartOverrides(scenario: DraftScenario): PreviewStartOverrides {
  return {
    items: [],
    flags: [],
    params: Object.fromEntries(
      scenario.params.map((param) => [
        param.id,
        param.initial === undefined ? '' : String(param.initial),
      ]),
    ),
    stars: Array(7).fill(''),
    bgm: '',
  };
}

/**
 * 試遊：進行状態は親画面に保持し、作品やプレイヤーのセーブデータには保存しない。
 */
export function TestPlay({
  scenario,
  startScene,
  onSceneChange,
  startOverrides,
  onStartOverridesChange,
  onClearStartOverrides,
  resourceUrls,
  scenarioResultTotals,
  scenarioIndexError,
  initialRun,
  onRunChange,
  audioEnabled,
  onAudioEnabledChange,
}: {
  scenario: Scenario;
  startScene: string | undefined;
  onSceneChange: (scene: string | undefined) => void;
  startOverrides: PreviewStartOverrides;
  onStartOverridesChange: (overrides: PreviewStartOverrides) => void;
  onClearStartOverrides: () => void;
  resourceUrls: Readonly<Record<string, string>>;
  scenarioResultTotals: ReadonlyMap<string, number> | null;
  scenarioIndexError: string | null;
  initialRun: PreviewRun | null;
  onRunChange: (run: PreviewRun) => void;
  audioEnabled: boolean;
  onAudioEnabledChange: (enabled: boolean) => void;
}) {
  const [playerGlobal, setPlayerGlobal] = useState<GlobalState>(
    () => initialRun?.global ?? emptyGlobalState(),
  );
  const engine = useMemo(
    () =>
      createEngine(scenario, {
        scenarioId: scenario.meta.id ?? 'playground',
        cache: createCookieRandomCache(),
        scenarioResults: (id) => {
          const all = scenarioResultTotals?.get(id);
          if (all === undefined) return undefined;
          return { count: playerGlobal.results[id]?.length ?? 0, all };
        },
      }),
    [scenario, scenarioResultTotals, playerGlobal],
  );
  const groupMode = engine.bgmMode === 'group';
  const [run, setLocalRun] = useState<PreviewRun | null>(initialRun);
  const [error, setError] = useState<string | null>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const seRef = useRef<HTMLAudioElement>(null);
  const battleSeRef = useRef<HTMLAudioElement>(null);
  const [sceneSoundVersion, setSceneSoundVersion] = useState(0);
  const [battleSound, setBattleSound] = useState<{ name: string; version: number } | null>(null);
  const [battleResetId, setBattleResetId] = useState(0);
  const setRun = (next: PreviewRun, replaySceneSound = false) => {
    if (next.state !== run?.state) {
      seAudio.cancelRetry();
      battleSeAudio.cancelRetry();
    }
    const previousSceneKey = run ? `${run.state.scene}:${run.state.ellapsed_scene}` : undefined;
    const nextSceneKey = `${next.state.scene}:${next.state.ellapsed_scene}`;
    if (replaySceneSound || previousSceneKey !== nextSceneKey)
      setSceneSoundVersion((version) => version + 1);
    setLocalRun(next);
    setPlayerGlobal(next.global);
    onRunChange(next);
  };
  const lastSyncedState = useRef(initialRun?.state);
  const playRef = useRef<HTMLDivElement>(null);
  const pendingSceneScroll = useRef(false);
  const bgmCandidates = useMemo(() => {
    const candidates = new Map<string, string>();
    const add = (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === '@none') return;
      const key = localAudioPath('bgm', trimmed) ?? trimmed;
      if (!candidates.has(key)) candidates.set(key, trimmed);
    };
    for (const name of Object.values(scenario.meta.bgm ?? {})) {
      if (name) add(name);
    }
    for (const scene of scenario.scenes) {
      if (scene.bgm) add(scene.bgm);
    }
    for (const group of scenario.groups) {
      if (group.bgm) add(group.bgm);
    }
    for (const path of Object.keys(resourceUrls)) {
      if (/^bgm\/(?!se\/).+\.(mp3|ogg|wav|m4a|aac)$/i.test(path)) {
        add(path.slice(4).replace(/\.mp3$/i, ''));
      }
    }
    const names = [...candidates.values()];
    if (startOverrides.bgm && startOverrides.bgm !== '@none' && !names.includes(startOverrides.bgm))
      names.push(startOverrides.bgm);
    return names;
  }, [scenario, resourceUrls, startOverrides.bgm]);

  useLayoutEffect(() => {
    if (!pendingSceneScroll.current) return;
    pendingSceneScroll.current = false;
    const scrollPanel = playRef.current?.closest<HTMLElement>('.pg-side-body');
    if (scrollPanel) scrollPanel.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [run]);

  useEffect(() => {
    const scene = run?.state.scene;
    onSceneChange(scene === undefined ? undefined : String(scene));
  }, [onSceneChange, run?.state.scene]);
  useEffect(() => () => onSceneChange(undefined), [onSceneChange]);

  const describe = useCallback(
    (events: GameEvent[]) =>
      events.flatMap((e) => {
        if (e.type === 'itemGained')
          return [`アイテム入手：${scenario.items.find((i) => i.id === e.id)?.name ?? e.id}`];
        if (e.type === 'resultUnlocked')
          return [`実績獲得：${scenario.results.find((r) => r.id === e.id)?.name ?? e.id}`];
        if (e.type === 'notEnoughStars') return ['星が不足している'];
        if (e.type === 'warning') return [`注意：${e.message}`];
        return [];
      }),
    [scenario],
  );

  const start = (from?: string) => {
    try {
      const rawGlobal = localStorage.getItem(GLOBAL_SAVE_KEY);
      const global = rawGlobal ? readLegacyGlobal(rawGlobal) : emptyGlobalState();
      const character = engine.newCharacter(global);
      if (!groupMode) character.bgm = startOverrides.bgm.trim();
      const itemIds = new Set(scenario.items.map((item) => item.id));
      const flagIds = new Set(scenario.flags.map((flag) => flag.id));
      character.items = startOverrides.items.filter((id) => itemIds.has(id));
      character.flags = startOverrides.flags.filter((id) => flagIds.has(id));
      for (const param of scenario.params) {
        const value = startOverrides.params[param.id]?.trim() ?? '';
        if (!value) continue;
        if (
          typeof param.initial === 'number' ||
          param.min !== undefined ||
          param.max !== undefined
        ) {
          const number = Number(value);
          if (!Number.isFinite(number))
            throw new Error(`パラメーター「${param.id}」は数値で入力してください`);
          character.params[param.id] = number;
        } else {
          character.params[param.id] = value;
        }
      }
      character.stars = character.stars.map((initial, index) => {
        const value = startOverrides.stars[index]?.trim() ?? '';
        if (!value) return initial;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0)
          throw new Error(`${STAR_NAMES[index]}の星は0以上の数値で入力してください`);
        return number;
      });
      let step = engine.begin(character, global);
      let previous: PreviewSnapshot | undefined;
      if (from && from !== '0') {
        previous = { state: step.state, global: step.global, log: describe(step.events) };
        step = engine.enterScene(step.state, step.global, from);
      }
      setRun(
        {
          state: step.state,
          global: step.global,
          log: describe(step.events),
          ...(previous ? { previous } : {}),
        },
        true,
      );
      setBattleResetId((version) => version + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // シーンを組み立てられないとき（編集中で遷移先がないなど）は、その理由を出す
  const shown = useMemo(() => {
    if (!run) return { view: null, error: null };
    try {
      return { view: engine.view(run.state, run.global), error: null };
    } catch (e) {
      return { view: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [engine, run]);
  const view = shown.view;
  useEffect(() => {
    // 再表示やログ更新では、手入力・クリアした開始設定を上書きしない。
    if (!run || lastSyncedState.current === run.state) return;
    lastSyncedState.current = run.state;
    onStartOverridesChange({
      items: [...run.state.items],
      flags: [...run.state.flags],
      params: Object.fromEntries(
        scenario.params.map((param) => [
          param.id,
          String(run.state.params[param.id] ?? param.initial ?? ''),
        ]),
      ),
      stars: run.state.stars.map(String),
      bgm: groupMode ? '' : (view?.bgm ?? run.state.bgm),
    });
  }, [run, view?.bgm, scenario.params, onStartOverridesChange, groupMode]);
  const music = view ? view.bgm || scenario.meta.bgm?.main || 'main' : undefined;
  const musicPath = music ? localAudioPath('bgm', music) : undefined;
  const musicUrl =
    music && music !== '@none'
      ? ((musicPath ? resourceUrls[musicPath] : undefined) ??
        bgmUrl(scenario.meta.id ?? 'playground', music))
      : undefined;
  const soundName = view?.se;
  const soundPath = soundName ? localAudioPath('se', soundName) : undefined;
  const soundUrl =
    soundName && soundPath
      ? (resourceUrls[soundPath] ?? seUrl(scenario.meta.id ?? 'playground', soundName))
      : undefined;
  const battleSoundPath = battleSound ? localAudioPath('se', battleSound.name) : undefined;
  const battleSoundUrl =
    battleSound && battleSoundPath
      ? (resourceUrls[battleSoundPath] ??
        seUrl(scenario.meta.id ?? 'playground', battleSound.name, true))
      : undefined;
  const bgmAudio = usePreviewAudio(bgmRef, musicUrl, audioEnabled, musicUrl, true);
  const seAudio = usePreviewAudio(seRef, soundUrl, audioEnabled, sceneSoundVersion, false);
  const battleSeAudio = usePreviewAudio(
    battleSeRef,
    battleSoundUrl,
    audioEnabled,
    battleSound?.version,
    false,
  );
  const handleBattleFeedback = (feedback: BattleFeedback) => {
    if (feedback.sound) {
      setBattleSound((current) => ({
        name: feedback.sound!,
        version: (current?.version ?? 0) + 1,
      }));
    }
  };
  const portraitPath = run
    ? `chara/${run.state.chara.sex}_${run.state.chara.age}_${run.state.chara.race}.png`.toLowerCase()
    : undefined;
  const portraitUrl = run
    ? scenario.meta.imageSet === 'custom' && portraitPath
      ? (resourceUrls[portraitPath] ??
        charaImageUrl(scenario.meta.id ?? 'playground', scenario.meta.imageSet, run.state.chara))
      : charaImageUrl(scenario.meta.id ?? 'playground', scenario.meta.imageSet, run.state.chara)
    : undefined;

  const choose = (index: number, input?: string) => {
    if (!run) return;
    const r = engine.choose(run.state, run.global, index, input);
    if (r.kind === 'moved') {
      pendingSceneScroll.current = true;
      setRun({
        state: r.state,
        global: r.global,
        log: [...describe(r.events), ...run.log].slice(0, 30),
        previous: { state: run.state, global: run.global, log: run.log },
      });
    } else if (r.kind === 'back')
      setRun({
        ...run,
        log: [
          '「戻る」の選択肢は試遊では使えません。移動のやり直しは［直前のシーンからやり直す］を使ってください',
          ...run.log,
        ],
      });
    else
      setRun({
        ...run,
        log: [
          {
            notEnoughStars: '星が不足しているようだ',
            notAllowed: 'その番号には移動できない',
            hidden: '条件を満たしていない',
            missingScene: '遷移先のシーンがない',
          }[r.reason],
          ...run.log,
        ],
      });
  };

  const moveToSelected = () => {
    if (!run || !startScene) return;
    try {
      const step = engine.enterScene(run.state, run.global, startScene);
      pendingSceneScroll.current = true;
      setRun({
        state: step.state,
        global: step.global,
        log: [...describe(step.events), ...run.log].slice(0, 30),
        previous: { state: run.state, global: run.global, log: run.log },
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const retryPrevious = () => {
    if (!run?.previous) return;
    if (!scenario.scenes.some((scene) => scene.id === String(run.previous?.state.scene))) {
      setError(`直前のシーン「${run.previous.state.scene}」がないため戻れません`);
      return;
    }
    pendingSceneScroll.current = true;
    setRun(run.previous);
    setError(null);
  };

  return (
    <div
      ref={playRef}
      className="pg-play"
      onClick={() => {
        bgmAudio.retry();
        seAudio.retry();
        battleSeAudio.retry();
      }}
      onKeyDown={() => {
        bgmAudio.retry();
        seAudio.retry();
        battleSeAudio.retry();
      }}
    >
      <div className="pg-toolbar">
        <label
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(event) => onAudioEnabledChange(event.target.checked)}
          />
          音声を再生
        </label>
        <button type="button" onClick={() => start()}>
          最初から試遊
        </button>
        {run?.previous && (
          <button type="button" onClick={retryPrevious}>
            直前のシーンからやり直す
          </button>
        )}
        {startScene && startScene !== '0' && (
          <button type="button" onClick={() => start(startScene)}>
            §{startScene} から試遊
          </button>
        )}
        {run && !run.state.isEnded && startScene && startScene !== String(run.state.scene) && (
          <button type="button" onClick={moveToSelected}>
            現在の状態で§{startScene}へ移動
          </button>
        )}
      </div>
      <details className="pg-play-setup">
        <summary>試遊の開始状態を指定</summary>
        <div className="pg-play-setup-head">
          <p className="pg-hint">
            ここで指定した状態でシーン0から開始し、選択中のシーンがあれば続けて移動します。
            シーンに入ると効果が適用され、BGMの指定があれば切り替わります。
            開始設定は試遊の進行・やり直しに合わせて自動更新します。
            手入力やクリアした値は、次の開始に使用します。
          </p>
          <button type="button" onClick={onClearStartOverrides}>
            状態をクリア
          </button>
        </div>
        <label className="pg-play-setup-field">
          開始時のBGM
          <select
            aria-label="試遊の開始BGM"
            value={groupMode ? '' : startOverrides.bgm}
            disabled={groupMode}
            onChange={(event) =>
              onStartOverridesChange({ ...startOverrides, bgm: event.target.value })
            }
          >
            <option value="">メインBGM</option>
            <option value="@none">無音</option>
            {bgmCandidates.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {groupMode && (
            <small>グループモードではシーンごとにBGMが決まるため、開始BGMは使いません。</small>
          )}
        </label>
        {scenario.items.length > 0 && (
          <fieldset>
            <legend>アイテム</legend>
            {scenario.items.map((item) => (
              <label key={item.id} className="pg-check">
                <input
                  type="checkbox"
                  aria-label={`試遊アイテム ${item.name}`}
                  checked={startOverrides.items.includes(item.id)}
                  onChange={(event) =>
                    onStartOverridesChange({
                      ...startOverrides,
                      items: event.target.checked
                        ? [...startOverrides.items, item.id]
                        : startOverrides.items.filter((id) => id !== item.id),
                    })
                  }
                />
                {item.name}
              </label>
            ))}
          </fieldset>
        )}
        {scenario.flags.length > 0 && (
          <fieldset>
            <legend>フラグ</legend>
            {scenario.flags.map((flag) => (
              <label key={flag.id} className="pg-check">
                <input
                  type="checkbox"
                  aria-label={`試遊フラグ ${flag.id}`}
                  checked={startOverrides.flags.includes(flag.id)}
                  onChange={(event) =>
                    onStartOverridesChange({
                      ...startOverrides,
                      flags: event.target.checked
                        ? [...startOverrides.flags, flag.id]
                        : startOverrides.flags.filter((id) => id !== flag.id),
                    })
                  }
                />
                {flag.text || flag.id}（{flag.id}）
              </label>
            ))}
          </fieldset>
        )}
        {scenario.params.length > 0 && (
          <fieldset>
            <legend>パラメーター</legend>
            {scenario.params.map((param) => (
              <label key={param.id} className="pg-play-setup-field">
                {param.text || param.id}（{param.id}）
                <input
                  type={
                    typeof param.initial === 'number' ||
                    param.min !== undefined ||
                    param.max !== undefined
                      ? 'number'
                      : 'text'
                  }
                  step="any"
                  aria-label={`試遊パラメーター ${param.id}`}
                  value={startOverrides.params[param.id] ?? ''}
                  onChange={(event) =>
                    onStartOverridesChange({
                      ...startOverrides,
                      params: { ...startOverrides.params, [param.id]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
        )}
        <fieldset>
          <legend>星</legend>
          {STAR_NAMES.map((name, index) => (
            <label key={name} className="pg-play-setup-field">
              {name}
              <input
                type="number"
                min="0"
                step="any"
                aria-label={`試遊の星 ${name}`}
                value={startOverrides.stars[index] ?? ''}
                onChange={(event) =>
                  onStartOverridesChange({
                    ...startOverrides,
                    stars: startOverrides.stars.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      </details>
      {scenarioIndexError && (
        <p className="pg-error" role="alert">
          他シナリオの実績数を読み込めませんでした: {scenarioIndexError}
        </p>
      )}
      {!scenarioResultTotals && !scenarioIndexError && (
        <p className="pg-hint" role="status">
          他シナリオの実績数を読み込んでいます…
        </p>
      )}
      {(error ?? shown.error) && (
        <p className="pg-error" role="alert">
          {error ?? shown.error}
        </p>
      )}
      {!run && !error && (
        <p className="pg-hint">
          新しいキャラクターで、編集中のシナリオを遊べます。プレイヤーに保存済みの実績を参照しますが、試遊の結果は保存しません。
        </p>
      )}
      {run && (
        <p className="pg-hint">
          試遊の進行状態はタブを切り替えても保持されます。作品の切替や再読み込みで消えます。
          ［最初から試遊］と［§…から試遊］は、開始設定を使って新しく始めます。
        </p>
      )}
      {run && view && (
        <>
          <div className="pg-play-page page">
            <div className="page-head">
              <span className="title">{scenario.meta.title}</span>
              <span className="para">
                <small>
                  {view.end ? `${view.end} end` : scenario.meta.showSummary ? '' : '節'}
                </small>
                {scenario.meta.showSummary && view.summary ? view.summary : view.id}
              </span>
            </div>
            <SceneText
              className="prose"
              markdown={view.markdown}
              resolveImage={(src) => {
                const path = src.startsWith('capture/') ? src : `capture/${src}`;
                return resourceUrls[path] ?? imageUrl(scenario.meta.id, src);
              }}
            />
            {musicUrl && <audio ref={bgmRef} loop preload="none" src={musicUrl} />}
            {bgmAudio.message && (
              <p className="pg-hint" role="status">
                {bgmAudio.message}
              </p>
            )}
            {groupMode && (
              <p className="pg-hint" role="status">
                現在のBGM：{music === '@none' ? '無音' : music}（
                {
                  {
                    scene: 'シーンの指定',
                    group: '所属グループの指定',
                    main: 'シナリオの通常曲',
                    ending: 'シナリオの終了曲',
                    implicit: '既定のファイル名',
                    legacy: '従来の再生状態',
                  }[view.bgmSource]
                }
                ）
              </p>
            )}
            {soundUrl && <audio ref={seRef} preload="none" src={soundUrl} />}
            {battleSoundUrl && <audio ref={battleSeRef} preload="none" src={battleSoundUrl} />}
            {(seAudio.message ?? battleSeAudio.message) && (
              <p className="pg-hint" role="status">
                {seAudio.message ?? battleSeAudio.message}
              </p>
            )}
            <BattlePanel
              key={`${run.state.scene}:${run.state.ellapsed_scene}:${battleResetId}`}
              engine={engine}
              scenario={scenario}
              state={run.state}
              global={run.global}
              view={view}
              onStateChange={(state, events, feedback) => {
                setRun({
                  ...run,
                  state,
                  log: [
                    ...(feedback?.notice ? [feedback.notice.message] : []),
                    ...describe(events),
                    ...run.log,
                  ].slice(0, 30),
                });
                if (feedback) handleBattleFeedback(feedback);
              }}
              onFeedback={handleBattleFeedback}
              resolveImage={(src) => {
                const path = src.startsWith('capture/') ? src : `capture/${src}`;
                return resourceUrls[path] ?? imageUrl(scenario.meta.id, src);
              }}
            />
            <ChoiceList choices={view.choices} onChoose={choose} />
            {view.afterText && <SceneText className="prose" markdown={view.afterText} />}
          </div>
          <details className="pg-play-status card">
            <summary>状態</summary>
            <HeroPanel scenario={scenario} state={run.state} portraitUrl={portraitUrl} />
            <p className="pg-hint">
              アイテム：{run.state.items.join(', ') || 'なし'} ／ フラグ：
              {run.state.flags.join(', ') || 'なし'} ／ 星：{run.state.stars.join(' ')}
            </p>
          </details>
          {run.log.length > 0 && (
            <ul className="pg-log">
              {run.log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
