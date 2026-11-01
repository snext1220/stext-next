// @vitest-environment jsdom
import { emptyGlobalState, newGameState } from '@stext/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { bgmUrl, imageUrl, seUrl, siteImageUrl } from './config.js';
import type { ScenarioEntry } from './data.js';
import { BGM_GROUPS, bgmUsage } from './music.js';
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

  it('reads the toolbox and guide pages, with chapters on the guide and post pages', () => {
    expect(parseRoute('#/music')).toEqual({ name: 'music' });
    expect(parseRoute('#/records')).toEqual({ name: 'records' });
    for (const name of ['materials', 'recruit', 'links', 'gallery', 'staff'] as const) {
      expect(parseRoute(`#/${name}`)).toEqual({ name });
      expect(href({ name })).toBe(`#/${name}`);
    }
    expect(parseRoute('#/about')).toEqual({ name: 'about' });
    expect(parseRoute('#/about/sorcerian')).toEqual({ name: 'about', section: 'sorcerian' });
    expect(parseRoute('#/post/submit')).toEqual({ name: 'post', section: 'submit' });
    expect(href({ name: 'about', section: 'sorcerian' })).toBe('#/about/sorcerian');
    expect(href({ name: 'post' })).toBe('#/post');
  });

  it('sends the former chapter URLs to the pages they moved to', () => {
    expect(parseRoute('#/about/stext')).toEqual({ name: 'about' });
    expect(parseRoute('#/about/staff')).toEqual({ name: 'staff' });
    expect(parseRoute('#/about/gallery')).toEqual({ name: 'gallery' });
    expect(parseRoute('#/about/links')).toEqual({ name: 'links' });
    expect(parseRoute('#/post/recruit')).toEqual({ name: 'recruit' });
    expect(parseRoute('#/post/materials')).toEqual({ name: 'materials' });
  });

  it('opens the library narrowed to scenarios with a questionnaire', () => {
    expect(parseRoute('#/library/quest')).toEqual({ name: 'library', quest: true });
    expect(parseRoute('#/library/other')).toEqual({ name: 'library' });
    expect(href({ name: 'library', quest: true })).toBe('#/library/quest');
    expect(href({ name: 'library' })).toBe('#/library');
  });
});

describe('music room', () => {
  it('lists the listed scenarios that use each common BGM', () => {
    const entry = (id: string, listed: boolean, bgm?: string[]): ScenarioEntry => ({
      id,
      title: id,
      listed,
      scenes: 1,
      results: 0,
      ...(bgm ? { bgm } : {}),
    });
    const usage = bgmUsage([
      entry('a', true, ['field04', 'town01']),
      entry('b', true, ['town01']),
      entry('dev', false, ['town01']),
      entry('c', true),
    ]);
    expect(usage.get('town01')?.map((e) => e.id)).toEqual(['a', 'b']);
    expect(usage.get('field04')?.map((e) => e.id)).toEqual(['a']);
    expect(usage.has('field01')).toBe(false);
  });

  it('groups every common BGM file exactly once', () => {
    const tracks = BGM_GROUPS.flatMap((g) => g.tracks);
    expect(new Set(tracks).size).toBe(tracks.length);
    expect(tracks).toHaveLength(24);
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
    expect(imageUrl('scepter', 'scepter.png')).toBe('/scenarios/scepter/capture/scepter.png');
    expect(imageUrl('scepter', 'https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(bgmUrl('scepter', '@field05')).toBe('/assets/common/bgm/field05.mp3');
    expect(bgmUrl('hero', 'hero-room')).toBe('/scenarios/hero/bgm/hero-room.mp3');
    expect(seUrl('slayer', 'hit')).toBe('/scenarios/slayer/bgm/se/hit.mp3');
    expect(seUrl('slayer', 'dice', true)).toBe('/assets/common/se/dice.mp3');
    expect(siteImageUrl('gallery/cute.jpg')).toBe('/assets/site/gallery/cute.jpg');
  });
});
