import { describe, expect, it } from 'vitest';
import { SOURCE_FORMATS, TARGET_FORMAT } from './index.js';

describe('@stext/convert', () => {
  it('converts the legacy formats into stext/2', () => {
    expect(SOURCE_FORMATS).toContain('scenario-xml');
    expect(TARGET_FORMAT).toBe('stext/2');
  });
});
