import { existsSync, readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { scenarioIndexJsonSchema } from './scenario-index.js';

const root = new URL('../../../', import.meta.url);
const published = JSON.parse(
  readFileSync(new URL('schema/scenario-index.v1.json', root), 'utf8'),
);
const entries = JSON.parse(readFileSync(new URL('scenarios/index.json', root), 'utf8')) as {
  id: string;
}[];

describe('Scenario index JSON Schema', () => {
  it('is up to date (run `npm run schema` after changing the schema)', () => {
    expect(published).toEqual(scenarioIndexJsonSchema());
  });

  it('accepts the committed index and its IDs are unique', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(published);

    expect(validate(entries), ajv.errorsText(validate.errors)).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const { id } of entries)
      expect(existsSync(new URL(`scenarios/${id}/scenario.json`, root)), id).toBe(true);
  });

  it('rejects missing required fields and unknown fields', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(published);

    expect(validate([{ id: 'demo', title: 'Demo', listed: true, scenes: 1 }])).toBe(false);
    expect(
      validate([{ id: 'demo', title: 'Demo', listed: true, scenes: 1, results: 0, typo: true }]),
    ).toBe(false);
  });

  it('limits level to integers from 1 to 5', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(published);
    const entry = { id: 'demo', title: 'Demo', listed: true, scenes: 1, results: 0 };

    expect(validate([{ ...entry, level: 1 }])).toBe(true);
    expect(validate([{ ...entry, level: 5 }])).toBe(true);
    expect(validate([{ ...entry, level: 0 }])).toBe(false);
    expect(validate([{ ...entry, level: 6 }])).toBe(false);
    expect(validate([{ ...entry, level: 1.5 }])).toBe(false);
  });
});
