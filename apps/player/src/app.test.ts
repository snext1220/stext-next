// @vitest-environment jsdom
import { emptyGlobalState, newGameState } from '@stext/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { bgmUrl, imageUrl, seUrl } from './config.js';
import { href, parseRoute } from './router.js';
import { loadGame, loadGlobal, saveGame, saveGlobal } from './storage.js';

describe('router', () => {
  it('reads and writes hash routes', () => {
    expect(parseRoute('#/play/scepter')).toEqual({ name: 'play', id: 'scepter' });
    expect(parseRoute('#/create/baku01')).toEqual({ name: 'create', id: 'baku01' });
    expect(parseRoute('#/convert')).toEqual({ name: 'convert' });
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(href({ name: 'play', id: 'local-a b' })).toBe('#/play/local-a%20b');
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('saves under the same keys as the legacy engine', () => {
    const s = newGameState(() => 0);
    saveGame('scepter', s);
    saveGlobal({ ...emptyGlobalState(), items: ['gi01'] });
    expect(JSON.parse(localStorage.getItem('scepter')!)).toEqual(s);
    expect(JSON.parse(localStorage.getItem('sorcerian_text')!).items).toEqual(['gi01']);
    expect(loadGame('scepter')).toEqual(s);
    expect(loadGlobal().items).toEqual(['gi01']);
  });

  it('ignores broken save data', () => {
    localStorage.setItem('scepter', '{broken');
    localStorage.setItem('sorcerian_text', '{broken');
    expect(loadGame('scepter')).toBeUndefined();
    expect(loadGlobal()).toEqual(emptyGlobalState());
  });
});

describe('asset paths', () => {
  it('follows the legacy directory layout', () => {
    expect(imageUrl('scepter', 'scepter.png')).toBe('/assets/scepter/capture/scepter.png');
    expect(imageUrl('scepter', 'https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(bgmUrl('scepter', '@field05')).toBe('/assets/common/bgm/field05.mp3');
    expect(bgmUrl('hero', 'hero-room')).toBe('/assets/hero/bgm/hero-room.mp3');
    expect(seUrl('slayer', 'hit')).toBe('/assets/slayer/bgm/se/hit.mp3');
    expect(seUrl('slayer', 'dice', true)).toBe('/assets/common/se/dice.mp3');
  });
});
