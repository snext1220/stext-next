import {
  createEngine,
  emptyGlobalState,
  GLOBAL_SAVE_KEY,
  readLegacyGlobal,
  type GameEvent,
  type GameState,
  type GlobalState,
} from '@stext/core';
import type { Scenario } from '@stext/schema';
import { ChoiceList, HeroPanel, SceneText, createCookieRandomCache } from '@stext/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bgmUrl, charaImageUrl, imageUrl, seUrl } from './config.js';
import { localAudioPath } from './resources.js';

const STAR_NAMES = ['月', '火星', '水星', '木星', '金星', '土星', '太陽'];

export interface PreviewStartOverrides {
  items: string[];
  flags: string[];
  params: Record<string, string>;
  stars: string[];
}

export function emptyPreviewStartOverrides(scenario: Scenario): PreviewStartOverrides {
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
  };
}

/**
 * 試遊：編集中のシナリオをその場で遊ぶ。保存はせず、この画面の中だけで進む。
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
}) {
  const [playerGlobal, setPlayerGlobal] = useState<GlobalState>(() => emptyGlobalState());
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
  const [run, setRun] = useState<{ state: GameState; global: GlobalState; log: string[] } | null>(
    null,
  );
  const playRef = useRef<HTMLDivElement>(null);
  const pendingSceneScroll = useRef(false);
  const [error, setError] = useState<string | null>(null);

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
      setPlayerGlobal(global);
      const character = engine.newCharacter(global);
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
      if (from && from !== '0') step = engine.enterScene(step.state, step.global, from);
      setRun({ state: step.state, global: step.global, log: describe(step.events) });
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
  const music = view ? view.bgm || scenario.meta.bgm?.main || 'main' : undefined;
  const musicPath = music ? localAudioPath('bgm', music) : undefined;
  const musicUrl =
    music && musicPath
      ? (resourceUrls[musicPath] ?? bgmUrl(scenario.meta.id ?? 'playground', music))
      : undefined;
  const soundName = view?.se;
  const soundPath = soundName ? localAudioPath('se', soundName) : undefined;
  const soundUrl =
    soundName && soundPath
      ? (resourceUrls[soundPath] ?? seUrl(scenario.meta.id ?? 'playground', soundName))
      : undefined;
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
      });
    } else if (r.kind === 'back')
      setRun({ ...run, log: ['「戻る」：試遊では直前に戻れません', ...run.log] });
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

  return (
    <div ref={playRef} className="pg-play">
      <div className="pg-toolbar">
        <button type="button" onClick={() => start()}>
          最初から試遊
        </button>
        {startScene && startScene !== '0' && (
          <button type="button" onClick={() => start(startScene)}>
            §{startScene} から試遊
          </button>
        )}
      </div>
      <details className="pg-play-setup">
        <summary>試遊の開始状態を指定</summary>
        <div className="pg-play-setup-head">
          <p className="pg-hint">
            ここで指定した状態でシーン0から開始し、選択中のシーンがあれば続けて移動します。
          </p>
          <button type="button" onClick={onClearStartOverrides}>
            状態をクリア
          </button>
        </div>
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
            {musicUrl && (
              <label className="pg-play-audio">
                BGM
                <audio key={musicUrl} controls loop preload="none" src={musicUrl} />
              </label>
            )}
            {soundUrl && (
              <label className="pg-play-audio">
                効果音
                <audio key={soundUrl} controls preload="none" src={soundUrl} />
              </label>
            )}
            {view.enemies.length > 0 && (
              <p className="pg-hint">
                敵：{view.enemies.map((e) => e.name).join('、')}
                （戦闘はプレイヤーで確かめてください）
              </p>
            )}
            <ChoiceList choices={view.choices} onChoose={choose} />
            {view.afterText && <SceneText className="prose" markdown={view.afterText} />}
          </div>
          <details className="pg-play-status">
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
