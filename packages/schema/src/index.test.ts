import { describe, expect, it } from 'vitest';
import { SCENARIO_FORMAT, isScenarioFormat } from './index.js';

describe('isScenarioFormat', () => {
  it('accepts stext/2', () => {
    expect(isScenarioFormat(SCENARIO_FORMAT)).toBe(true);
  });

  it('rejects other values', () => {
    expect(isScenarioFormat('stext/1')).toBe(false);
    expect(isScenarioFormat(undefined)).toBe(false);
  });
});
