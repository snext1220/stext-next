import {
  applyDrop,
  attackEnemy,
  createEngine,
  dropFor,
  enemyHp,
  receiveAttack,
  rollDice,
  selectFunc,
  STATE_NAMES,
  type AttackResult,
  type GameEvent,
  type GameState,
  type GlobalState,
  type SceneView,
} from '@stext/core';
import type { Enemy, Scenario } from '@stext/schema';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { statusLabel } from './Panels.js';
import { SceneText } from './SceneText.js';
import { Die, EnemyCard } from './Battle.js';
import type { Toast } from './Toasts.js';

interface EnemyBattle {
  enemy: Enemy;
  func: string;
  displayOnly: boolean;
  hp: number | undefined;
  drop: { drop: string; name: string } | undefined;
  dropTaken: boolean;
  defeated: boolean;
}

interface BattleState {
  dice: number[];
  multiplier: number;
  enemies: EnemyBattle[];
}

export interface BattleFeedback {
  sound?: 'dice' | 'guard' | 'state' | 'damage' | 'drop';
  notice?: Pick<Toast, 'kind' | 'title' | 'message'>;
}

export interface BattlePanelProps {
  engine: ReturnType<typeof createEngine>;
  scenario: Scenario;
  state: GameState;
  global: GlobalState;
  view: SceneView;
  onStateChange: (state: GameState, events: GameEvent[], feedback?: BattleFeedback) => void;
  onFeedback: (feedback: BattleFeedback) => void;
  resolveImage?: (src: string) => string;
  sceneInputs?: ReactNode;
  inActionPanel?: boolean;
}

function initializeBattle(
  engine: ReturnType<typeof createEngine>,
  state: GameState,
  view: SceneView,
): BattleState {
  return {
    dice: rollDice(Math.random, view.dice).values,
    multiplier: 1,
    enemies: view.enemies.map((enemy) => {
      const selected = enemy.func
        ? selectFunc(Math.random, enemy.func)
        : { func: '', displayOnly: false };
      return {
        enemy,
        func: selected.func,
        displayOnly: selected.displayOnly,
        hp: enemyHp(enemy, (param) => engine.paramValue(state, param)),
        drop: dropFor(Math.random, enemy),
        dropTaken: false,
        defeated: false,
      };
    }),
  };
}

function copyState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function attackFeedback(
  result: AttackResult,
  state: GameState,
  scenario: Scenario,
): BattleFeedback | undefined {
  const label = (key: string) => statusLabel(scenario, key);
  if (result.kind === 'evaded')
    return {
      sound: 'guard',
      notice: { kind: 'info', title: '回避', message: '回避に成功した。' },
    };
  if (result.kind === 'stat')
    return {
      sound: 'state',
      notice: {
        kind: 'dmg',
        title: 'ステータス攻撃',
        message: `${label(result.stat)}が${result.amount}低下した！`,
      },
    };
  if (result.kind === 'state')
    return result.applied
      ? {
          sound: 'state',
          notice: {
            kind: 'dmg',
            title: '状態異常',
            message: `「${STATE_NAMES[result.state] ?? result.state}」を受けた！`,
          },
        }
      : undefined;
  if (result.kind === 'damage') {
    if (result.hp + result.mp + (result.target.startsWith('free') ? result.damage : 0) === 0)
      return {
        sound: 'guard',
        notice: { kind: 'info', title: '被ダメージ', message: '敵の攻撃を防ぎきった！' },
      };
    const message =
      result.target === 'hp'
        ? `${label('hp')}に${result.hp}のダメージ！（現在値：${state.chara.hp}）`
        : result.target === 'mp'
          ? `${label('mp')}に${result.mp}のダメージ！（現在値：${state.chara.mp}）`
          : result.target === 'both'
            ? `${label('hp')}/${label('mp')}に${result.hp}/${result.mp}のダメージ！`
            : `${label(result.target)}に${result.damage}のダメージ！`;
    return {
      sound: 'damage',
      notice: { kind: 'dmg', title: '被ダメージ', message },
    };
  }
  return undefined;
}

export function BattlePanel({
  engine,
  scenario,
  state,
  global,
  view,
  onStateChange,
  onFeedback,
  resolveImage,
  sceneInputs,
  inActionPanel = false,
}: BattlePanelProps) {
  const [battle, setBattle] = useState(() => initializeBattle(engine, state, view));
  const [rolling, setRolling] = useState(false);
  const [notice, setNotice] = useState<BattleFeedback['notice']>();
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEnemies = battle.enemies.length > 0;
  const sceneDiceOnly = !hasEnemies && Boolean(view.dice);
  const hasBattleControls = hasEnemies || Boolean(view.dice);
  const ruleText = view.rule ? engine.sceneText(state, global, view.rule) : '';
  const ruleBox = ruleText ? (
    <details className="rule-box">
      <summary>{hasEnemies ? 'この戦闘のルール' : 'このシーンのルール'}</summary>
      <SceneText className="prose" markdown={ruleText} resolveImage={resolveImage} />
    </details>
  ) : null;

  useEffect(
    () => () => {
      if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    },
    [],
  );

  if (!hasBattleControls) return ruleBox;

  const roll = () => {
    if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    setBattle((current) => ({ ...current, dice: rollDice(Math.random, view.dice).values }));
    setRolling(true);
    rollTimer.current = setTimeout(() => {
      rollTimer.current = null;
      setRolling(false);
    }, 450);
    onFeedback({ sound: 'dice' });
  };

  const report = (next: GameState, events: GameEvent[], feedback?: BattleFeedback) => {
    if (inActionPanel) setNotice(feedback?.notice);
    onStateChange(next, events, feedback);
  };
  const receive = (index: number) => {
    const target = battle.enemies[index]!;
    const next = copyState(state);
    const events: GameEvent[] = [];
    const context = engine.effectContext(next, global, events);
    const result = receiveAttack(
      context,
      target.enemy.attack ?? '',
      target.func,
      battle.dice,
      battle.multiplier,
    );
    report(next, events, attackFeedback(result, next, scenario));
  };

  const attack = (index: number) => {
    const target = battle.enemies[index]!;
    const next = copyState(state);
    const events: GameEvent[] = [];
    const context = engine.effectContext(next, global, events);
    const result = attackEnemy(
      context,
      target.enemy,
      target.hp ?? 0,
      battle.dice,
      battle.multiplier,
    );
    setBattle((current) => ({
      ...current,
      enemies: current.enemies.map((enemy, i) =>
        i === index ? { ...enemy, hp: result.hp } : enemy,
      ),
    }));
    report(next, events, {
      sound: 'damage',
      notice: { kind: 'info', title: '敵へのダメージ', message: `${result.damage} Hit!` },
    });
  };

  const takeDrop = (index: number) => {
    const target = battle.enemies[index]!;
    if (!target.drop || target.dropTaken) return;
    const next = copyState(state);
    const events: GameEvent[] = [];
    const context = engine.effectContext(next, global, events);
    applyDrop(context, target.drop.drop);
    setBattle((current) => ({
      ...current,
      enemies: current.enemies.map((enemy, i) =>
        i === index ? { ...enemy, dropTaken: true } : enemy,
      ),
    }));
    report(next, events, {
      sound: 'drop',
      notice: { kind: 'item', title: '戦利品', message: `${target.drop.name}を手に入れた。` },
    });
  };

  const diceControls = (
    <div className={`battle-controls battle-dice${hasEnemies || sceneDiceOnly ? ' sticky' : ''}`}>
      <div
        className="dice"
        onClick={roll}
        role="button"
        tabIndex={0}
        title="ダイスを振る"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            roll();
          }
        }}
      >
        {battle.dice.map((value, index) => (
          <Die key={index} value={value} rolling={rolling} first={index === 0} />
        ))}
      </div>
      <button type="button" className="btn" onClick={roll}>
        ダイスを振る
      </button>
      {inActionPanel && (
        <span aria-live="polite">合計 {battle.dice.reduce((sum, die) => sum + die, 0)}</span>
      )}
      {hasEnemies && (
        <label className="verdict">
          ダメージ倍率{' '}
          <select
            value={battle.multiplier}
            onChange={(event) =>
              setBattle((current) => ({ ...current, multiplier: Number(event.target.value) }))
            }
          >
            <option value={2}>×2</option>
            <option value={1}>×1</option>
            <option value={0.5}>×1/2</option>
            <option value={0.25}>×1/4</option>
          </select>
        </label>
      )}
      {inActionPanel && (
        <div className="battle-status" role="group" aria-label="簡易ステータス">
          {(['hp', 'mp', 'str', 'int', 'dex', 'krm', 'free1', 'free2', 'free3'] as const).map(
            (key) => (
              <span className="battle-status-item" key={key}>
                <span>{statusLabel(scenario, key)}</span> <b>{state.chara[key]}</b>
              </span>
            ),
          )}
          <span className="battle-status-item">
            <span>{statusLabel(scenario, 'state')}</span>{' '}
            <b>{STATE_NAMES[state.chara.state] ?? state.chara.state}</b>
          </span>
        </div>
      )}
      {inActionPanel && (
        <div className="scene-action-notice" role="status">
          {notice && `${notice.title}：${notice.message}`}
        </div>
      )}
    </div>
  );
  const enemyCards = battle.enemies.map((enemy, index) => (
    <EnemyCard
      key={index}
      enemy={enemy.enemy}
      func={enemy.func}
      funcDisplayOnly={enemy.displayOnly}
      {...(enemy.hp !== undefined ? { hp: enemy.hp } : {})}
      {...(enemy.drop ? { dropName: enemy.drop.name } : {})}
      dropTaken={enemy.dropTaken}
      onReceive={() => receive(index)}
      onAttack={() => attack(index)}
      onDrop={() => takeDrop(index)}
      defeatedChecked={enemy.defeated}
      {...(battle.enemies.length > 1
        ? {
            onToggleDefeated: (checked: boolean) =>
              setBattle((current) => ({
                ...current,
                enemies: current.enemies.map((entry, i) =>
                  i === index ? { ...entry, defeated: checked } : entry,
                ),
              })),
          }
        : {})}
      {...(enemy.enemy.attack?.startsWith('free')
        ? { attackLabel: statusLabel(scenario, enemy.enemy.attack) }
        : {})}
    />
  ));

  if (inActionPanel) {
    return (
      <>
        {diceControls}
        {sceneInputs}
        {ruleBox}
        {enemyCards}
      </>
    );
  }

  return (
    <>
      {ruleBox}
      {hasEnemies ? (
        <div className="battle-sheet">
          {diceControls}
          {enemyCards}
        </div>
      ) : (
        diceControls
      )}
    </>
  );
}
