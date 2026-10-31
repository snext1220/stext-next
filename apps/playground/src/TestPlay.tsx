import {
  createEngine,
  emptyGlobalState,
  type GameEvent,
  type GameState,
  type GlobalState,
} from '@stext/core';
import type { Scenario } from '@stext/schema';
import { ChoiceList, HeroPanel, SceneText } from '@stext/ui';
import { useCallback, useMemo, useState } from 'react';
import { imageUrl } from './config.js';

/**
 * 試遊：編集中のシナリオをその場で遊ぶ。保存はせず、この画面の中だけで進む。
 */
export function TestPlay({
  scenario,
  startScene,
}: {
  scenario: Scenario;
  startScene: string | undefined;
}) {
  const engine = useMemo(
    () => createEngine(scenario, { scenarioId: scenario.meta.id ?? 'playground' }),
    [scenario],
  );
  const [run, setRun] = useState<{ state: GameState; global: GlobalState; log: string[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

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
      let step = engine.start(emptyGlobalState());
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

  const choose = (index: number, input?: string) => {
    if (!run) return;
    const r = engine.choose(run.state, run.global, index, input);
    if (r.kind === 'moved')
      setRun({
        state: r.state,
        global: r.global,
        log: [...describe(r.events), ...run.log].slice(0, 30),
      });
    else if (r.kind === 'back')
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
    <div className="pg-play">
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
      {(error ?? shown.error) && <p className="pg-error">{error ?? shown.error}</p>}
      {!run && !error && (
        <p className="pg-hint">
          新しいキャラクターで、編集中のシナリオを遊べます。セーブデータには残りません。
        </p>
      )}
      {run && view && (
        <>
          <div className="pg-play-page page">
            <div className="page-head">
              <span className="title">{scenario.meta.title}</span>
              <span className="para">
                <small>{view.end ? `${view.end} end` : '節'}</small>
                {view.id}
              </span>
            </div>
            <SceneText
              className="prose"
              markdown={view.markdown}
              resolveImage={(src) => imageUrl(scenario.meta.id, src)}
            />
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
            <HeroPanel scenario={scenario} state={run.state} />
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
