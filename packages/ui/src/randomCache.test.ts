// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createCookieRandomCache } from './randomCache.js';

afterEach(() => {
  document.cookie = 'stext_cache_random_preview0=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('createCookieRandomCache', () => {
  it('stores and reads an encoded transition result', () => {
    const cache = createCookieRandomCache();

    cache.set('random_preview0', 'scene;2', 7);

    expect(cache.get('random_preview0')).toBe('scene;2');
  });
});
