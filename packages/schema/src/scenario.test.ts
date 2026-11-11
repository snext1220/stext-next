import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { checkScenario } from './check.js';
import { scenarioJsonSchema, validateScenario } from './scenario.js';

const root = new URL('../../../', import.meta.url);
const published = JSON.parse(readFileSync(new URL('schema/scenario.v2.json', root), 'utf8'));
const scenarioDir = new URL('scenarios/', root);
const scenarios = readdirSync(scenarioDir)
  .filter((id) => existsSync(new URL(`${id}/scenario.json`, scenarioDir)))
  .map((id) => [id, JSON.parse(readFileSync(new URL(`${id}/scenario.json`, scenarioDir), 'utf8'))] as const);

describe('JSON Schema', () => {
  it('is up to date (run `npm run schema` after changing the schema)', () => {
    expect(published).toEqual(scenarioJsonSchema());
  });

  it('accepts every converted scenario, like validateScenario does', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(published);
    expect(scenarios.length).toBeGreaterThan(40);
    for (const [id, data] of scenarios) {
      expect(validate(data), `${id}: ${ajv.errorsText(validate.errors)}`).toBe(true);
    }
  });
});

describe('validateScenario', () => {
  it('accepts every converted scenario', () => {
    for (const [id, data] of scenarios) expect(validateScenario(data).ok, id).toBe(true);
  });

  it('reports where the data is wrong', () => {
    const [, data] = scenarios.find(([id]) => id === 'scepter')!;
    const broken = structuredClone(data);
    broken.scenes[1].choices[0].to = '1010';
    broken.scenes[2].choices[0].if = { flag: 1 };
    const r = validateScenario(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.path)).toEqual(['scenes[1].choices[0]', 'scenes[2].choices[0]']);
    }
  });

  it('accepts optional group BGM while preserving existing group fields', () => {
    const [, data] = scenarios.find(([id]) => id === 'scepter')!;
    const updated = structuredClone(data);
    updated.groups = [{ title: '森', start: '100', end: '199', bgm: '@field01' }];

    expect(validateScenario(updated).ok).toBe(true);
  });
});

describe('checkScenario', () => {
  it('finds no errors in a clean scenario', () => {
    const [, data] = scenarios.find(([id]) => id === 'scepter')!;
    const r = validateScenario(data);
    expect(r.ok && checkScenario(r.scenario)).toEqual([]);
  });

  it('rejects overlapping group ranges including shared endpoints', () => {
    const [, data] = scenarios.find(([id]) => id === 'scepter')!;
    const parsed = validateScenario(data);
    if (!parsed.ok) throw new Error('Expected the converted scenario to be valid');
    const scenario = structuredClone(parsed.scenario);
    scenario.groups = [
      { title: '一つ目', start: '100', end: '200' },
      { title: '二つ目', start: '200', end: '300', bgm: '@none' },
    ];

    expect(checkScenario(scenario)).toContainEqual({
      severity: 'error',
      path: 'groups[1]',
      message: 'シーン範囲がグループ 1 と重複しています',
    });
  });

  it('reports unfinished and invalid group ranges', () => {
    const [, data] = scenarios.find(([id]) => id === 'scepter')!;
    const parsed = validateScenario(data);
    if (!parsed.ok) throw new Error('Expected the converted scenario to be valid');
    const scenario = structuredClone(parsed.scenario);
    scenario.groups = [{ title: '不正', start: '', end: 'abc' }];

    expect(checkScenario(scenario)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'groups[0].start' }),
        expect.objectContaining({ path: 'groups[0].end' }),
      ]),
    );
  });
});
