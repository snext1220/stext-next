// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restorePersistent } from './storage.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('restorePersistent', () => {
  it('rolls back earlier writes if a later one fails', () => {
    localStorage.setItem('first', 'old');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'second') throw new Error('容量不足');
      setItem.call(localStorage, key, value);
    });
    expect(() =>
      restorePersistent([
        { key: 'first', value: 'new' },
        { key: 'second', value: 'new' },
      ]),
    ).toThrow('容量不足');
    expect(localStorage.getItem('first')).toBe('old');
    expect(localStorage.getItem('second')).toBeNull();
  });
});
