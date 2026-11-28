// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadPlaygroundSettings, savePlaygroundSettings } from './settings.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('uses automatic inspection by default and persists settings together', () => {
  expect(loadPlaygroundSettings()).toEqual({
    settings: { autoInspection: true },
    storageError: false,
  });

  expect(savePlaygroundSettings({ autoInspection: false })).toBe(true);
  expect(savePlaygroundSettings({ sideWidth: 480 })).toBe(true);
  expect(loadPlaygroundSettings()).toEqual({
    settings: { autoInspection: false, sideWidth: 480 },
    storageError: false,
  });
});

it('migrates the existing side panel width into the shared settings entry', () => {
  localStorage.setItem('stext-next:playground:side-width', '520');

  expect(loadPlaygroundSettings()).toEqual({
    settings: { autoInspection: true, sideWidth: 520 },
    storageError: false,
  });
  expect(localStorage.getItem('stext-next:playground:side-width')).toBeNull();
  expect(JSON.parse(localStorage.getItem('stext-next:playground:settings') ?? '{}')).toEqual({
    version: 1,
    autoInspection: true,
    sideWidth: 520,
  });
});

it('falls back to defaults for malformed settings and reports the storage problem', () => {
  localStorage.setItem('stext-next:playground:settings', '{');

  expect(loadPlaygroundSettings()).toEqual({
    settings: { autoInspection: true },
    storageError: true,
  });
});

it('continues with defaults when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError');
  });

  expect(loadPlaygroundSettings()).toEqual({
    settings: { autoInspection: true },
    storageError: true,
  });
  expect(savePlaygroundSettings({ autoInspection: false })).toBe(false);
});
