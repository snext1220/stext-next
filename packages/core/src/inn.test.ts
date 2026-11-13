import { readFileSync } from 'node:fs';
import { checkScenario, validateScenario } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { getBgmMode } from './bgm.js';
import { createEngine, type Engine, type Step } from './engine.js';
import { emptyGlobalState } from './state.js';

const data: unknown = JSON.parse(
  readFileSync(new URL('../../../scenarios/inn/scenario.json', import.meta.url), 'utf8'),
);
const validated = validateScenario(data);
if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
const scenario = validated.scenario;

function choose(engine: Engine, step: Step, label: string): Step {
  const choice = engine.view(step.state, step.global).choices.find((c) => c.label === label);
  if (!choice) throw new Error(`選択肢がありません: ${label}`);
  const result = engine.choose(step.state, step.global, choice.index);
  if (result.kind !== 'moved') throw new Error(result.kind);
  return result;
}

describe('トラベラーズ☆イン v2', () => {
  it('organizes every scene with a summary and one non-overlapping group', () => {
    expect(scenario.scenes).toHaveLength(31);
    expect(scenario.groups).toHaveLength(8);
    for (const [index, group] of scenario.groups.entries()) {
      expect(Object.keys(group).sort()).toEqual(['end', 'start', 'title']);
      expect(Number(group.start)).toBeLessThanOrEqual(Number(group.end));
      for (const other of scenario.groups.slice(index + 1)) {
        expect(
          Number(group.end) < Number(other.start) || Number(other.end) < Number(group.start),
        ).toBe(true);
      }
    }
    for (const scene of scenario.scenes) {
      expect(scene.summary?.trim()).toBeTruthy();
      expect(
        scenario.groups.filter(
          (group) =>
            Number(group.start) <= Number(scene.id) && Number(scene.id) <= Number(group.end),
        ),
      ).toHaveLength(1);
    }
    expect(scenario.meta.showSummary).not.toBe(true);
    expect(getBgmMode(scenario)).toBe('legacy');
  });

  it('validates references and identifies money without changing internal names', () => {
    expect(checkScenario(scenario).filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(scenario.meta.labels?.free1).toBe('所持金');
    expect(scenario.enemies.find((enemy) => enemy.id === 'm14')?.drop).toBe('free1/70/70Gold');
  });

  it.each([
    ['1000', 'krm', -1],
    ['3250', 'mp', -10],
    ['2200', 'free1', -50],
    ['2300', 'free1', -50],
    ['4200', 'free1', -50],
    ['4300', 'free1', -50],
  ] as const)('applies the fixed effect on entering %s', (id, stat, delta) => {
    const engine = createEngine(scenario, { random: () => 0 });
    const start = engine.start(emptyGlobalState());
    start.state.chara.mp_m = 100;
    start.state.chara[stat] = 100;
    const step = engine.enterScene(start.state, start.global, id);
    expect(step.state.chara[stat]).toBe(100 + delta);
  });

  it('charges and heals only after choosing an affordable night', () => {
    const engine = createEngine(scenario, { random: () => 0 });
    const start = engine.start(emptyGlobalState());
    start.state.chara.free1 = 20;
    start.state.chara.hp = 1;
    start.state.chara.mp = 1;
    start.state.chara.state = 'poison';
    const room = engine.enterScene(start.state, start.global, '6000');
    expect(room.state.chara.free1).toBe(20);
    const paid = choose(engine, room, '（脳内で）フェードアウト／インして次へ');
    expect(paid.state.chara.free1).toBe(0);
    expect(paid.state.chara.hp).toBe(Math.min(room.state.chara.hp + 15, paid.state.chara.hp_m));
    expect(paid.state.chara.mp).toBe(Math.min(room.state.chara.mp + 15, paid.state.chara.mp_m));
    expect(paid.state.chara.state).toBe('');
    expect(choose(engine, paid, '次へ').state.scene).toBe('6100');
  });

  it('sends an unaffordable stay to exchange without deducting or healing', () => {
    const engine = createEngine(scenario, { random: () => 0 });
    const start = engine.start(emptyGlobalState());
    start.state.chara.free1 = 19;
    start.state.chara.hp = 1;
    const room = engine.enterScene(start.state, start.global, '6000');
    expect(
      engine.view(room.state, room.global).choices.map((choice) => choice.label),
    ).not.toContain('（脳内で）フェードアウト／インして次へ');
    const exchange = choose(engine, room, 'Goldが足りないので、戦果を換金しに行く');
    expect(exchange.state.chara.free1).toBe(19);
    expect(exchange.state.chara.hp).toBe(1);
    expect(exchange.state.scene).toBe('7000');
  });

  it('keeps exchange manual without adding sale scenes', () => {
    const exchange = scenario.scenes.find((scene) => scene.id === '7000');
    expect(exchange?.choices).toEqual([{ label: 'HIT ANY KEY...', to: ['7100'] }]);
    expect(scenario.scenes.some((scene) => /^700[1-5]$/.test(scene.id))).toBe(false);
  });

  it.each([
    ['beef/cake', '2200'],
    ['wrong', '2300'],
  ])('charges for an order answered %s', (answer, destination) => {
    const engine = createEngine(scenario, { random: () => 0 });
    const start = engine.start(emptyGlobalState());
    start.state.chara.free1 = 100;
    const order = engine.enterScene(start.state, start.global, '2100');
    const choice = engine.view(order.state, order.global).choices.find((c) => c.kind === 'answer');
    if (!choice) throw new Error('注文の入力欄がありません');
    const result = engine.choose(order.state, order.global, choice.index, answer);
    if (result.kind !== 'moved') throw new Error(result.kind);
    expect(result.state.scene).toBe(destination);
    expect(result.state.chara.free1).toBe(50);
  });
});
