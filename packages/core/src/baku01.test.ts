import { readFileSync } from 'node:fs';
import { checkScenario, validateScenario } from '@stext/schema';
import { describe, expect, it } from 'vitest';
import { createEngine } from './engine.js';
import { emptyGlobalState } from './state.js';

const data: unknown = JSON.parse(
  readFileSync(new URL('../../../scenarios/baku01/scenario.json', import.meta.url), 'utf8'),
);
const validated = validateScenario(data);
if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
const scenario = validated.scenario;

describe('序：黒船来航', () => {
  it('covers every scene with one non-overlapping group', () => {
    expect(checkScenario(scenario).filter((issue) => issue.severity === 'error')).toEqual([]);
    for (const scene of scenario.scenes) {
      expect(
        scenario.groups.filter(
          (group) =>
            Number(group.start) <= Number(scene.id) && Number(scene.id) <= Number(group.end),
        ),
        scene.id,
      ).toHaveLength(1);
    }
  });

  it('uses the section BGM while preserving scene overrides and bad-ending music', () => {
    const engine = createEngine(scenario, { random: () => 0 });
    expect(engine.bgmMode).toBe('group');
    const start = engine.start(emptyGlobalState());
    const expected: [string, string, string][] = [
      ['10', 'prologue', 'group'],
      ['110', 'main', 'group'],
      ['380', 'bad', 'implicit'],
      ['1610', 'boss', 'group'],
      ['1800', 'battle', 'scene'],
      ['1950', 'bad', 'implicit'],
      ['2010', 'rest', 'group'],
      ['2150', 'daemon', 'group'],
      ['2580', 'blood', 'group'],
      ['2870', 'blood', 'group'],
      ['3320', 'core', 'group'],
      ['3350', 'bad', 'implicit'],
      ['3370', 'boss', 'group'],
      ['3420', '@n30j001', 'scene'],
      ['9010', 'help', 'group'],
    ];

    for (const [id, bgm, bgmSource] of expected) {
      const step = engine.enterScene(start.state, start.global, id);
      expect(engine.view(step.state, step.global), id).toMatchObject({ bgm, bgmSource });
    }
  });
});
