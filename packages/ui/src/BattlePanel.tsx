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
import { useEffect, useRef, useState } from 'react';
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
}: BattlePanelProps) {
  const [battle, setBattle] = useState(() => initializeBattle(engine, state, view));
  const [rolling, setRolling] = useState(false);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEnemies = battle.enemies.length > 0;

  useEffect(
    () => () => {
      if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    },
    [],
  );

  if (!hasEnemies && !view.dice) return null;

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
    onStateChange(next, events, attackFeedback(result, next, scenario));
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
    onStateChange(next, events, {
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
    onStateChange(next, events, {
      sound: 'drop',
      notice: { kind: 'item', title: '戦利品', message: `${target.drop.name}を手に入れた。` },
    });
  };

  const ruleText = view.rule ? engine.sceneText(state, global, view.rule) : '';

  return (
    <>
      {hasEnemies && ruleText && (
        <details className="rule-box">
          <summary>この戦闘のルール</summary>
          <SceneText className="prose" markdown={ruleText} resolveImage={resolveImage} />
        </details>
      )}
      <div className="battle-controls" style={{ marginBottom: 12 }}>
        <div
          className="dice"
          onClick={roll}
          role="button"
          tabIndex={0}
          title="ダイスを振る"
          onKeyDown={(event) => event.key === 'Enter' && roll()}
        >
          {battle.dice.map((value, index) => (
            <Die key={index} value={value} rolling={rolling} first={index === 0} />
          ))}
        </div>
        <button type="button" className="btn" onClick={roll}>
          ダイスを振る
        </button>
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
      </div>
      {battle.enemies.map((enemy, index) => (
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
      ))}
    </>
  );
}
