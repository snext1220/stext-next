import type { RandomCache } from '@stext/core';

const COOKIE_PREFIX = 'stext_cache_';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function createCookieRandomCache(): RandomCache {
  return {
    get(key) {
      const name = encodeURIComponent(`${COOKIE_PREFIX}${key}`);
      const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
      if (!cookie) return undefined;
      try {
        return decodeURIComponent(cookie.slice(name.length + 1));
      } catch (error) {
        if (error instanceof URIError) return undefined;
        throw error;
      }
    },
    set(key, value, days) {
      const name = encodeURIComponent(`${COOKIE_PREFIX}${key}`);
      const expires = new Date(Date.now() + days * DAY_IN_MS).toUTCString();
      document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    },
  };
}
