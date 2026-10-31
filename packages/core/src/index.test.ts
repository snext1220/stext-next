import { describe, expect, it } from 'vitest';
import { canLoad } from './index.js';

describe('canLoad', () => {
  it('loads stext/2 scenarios only', () => {
    expect(canLoad({ format: 'stext/2' })).toBe(true);
    expect(canLoad({ format: 'stext/1' })).toBe(false);
    expect(canLoad({})).toBe(false);
  });
});
