import { newGameState } from '@stext/core';
import { describe, expect, it } from 'vitest';
import { ALL, backupFileName, createBackup, parseBackup, parseRestore } from './backup.js';
import { slotsKey } from './storage.js';

const save = JSON.stringify({
  chara: { name: 'クルトン' },
  stars: [0, 0, 0, 0, 0, 0, 0],
  items: [],
  flags: [],
  params: {},
  scene: '0',
});
const global = JSON.stringify({
  items: ['gi01'],
  results: { scepter: ['r01'] },
  bgm: true,
  panel: true,
});
describe('backup', () => {
  it('names backup files', () => {
    expect(backupFileName('all', 1700000000000)).toBe('all-1700000000000.stext');
  });

  it('reads both formats back', () => {
    expect(parseBackup('scepter-1700000000000.stext', save + '\n')).toEqual([
      { key: 'scepter', value: save },
    ]);
    expect(
      parseBackup('all-1.stext', `sorcerian_text\r\n${global}\r\nscepter\r\n${save}\r\n`),
    ).toEqual([
      { key: 'sorcerian_text', value: global },
      { key: 'scepter', value: save },
    ]);
  });

  it('rejects files that are not save data', () => {
    expect(() => parseBackup('scepter-1.stext', 'hello')).toThrow('scepter');
    expect(() => parseBackup('all-1.stext', '')).toThrow();
    expect(() => parseBackup('all-1.stext', 'sorcerian_text\n{"items":{}}\n')).toThrow();
    expect(() => parseBackup('all-1.stext', `scepter\n${save}\ndoll\n`)).toThrow();
    expect(() => parseBackup('all-1.stext', `scepter\n${save}\nscepter\n${save}\n`)).toThrow();
  });

  it('backs up and restores five slots including empty values and reads old backups', () => {
    const slots = JSON.stringify([
      { savedAt: '2026-11-07T00:00:00.000Z', state: newGameState(() => 0) },
      null,
      null,
      null,
      null,
    ]);
    const data: Record<string, string> = {
      scepter: save,
      [slotsKey('scepter')]: slots,
      sorcerian_text: global,
    };
    const content = createBackup(ALL, ['scepter', 'doll'], (key) => data[key] ?? null)!;
    expect(parseRestore('all-1.stext', content)).toEqual([
      { key: 'sorcerian_text', value: global },
      { key: 'scepter', value: save },
      { key: slotsKey('scepter'), value: slots },
      { key: 'doll', value: null },
      { key: slotsKey('doll'), value: null },
    ]);
    expect(parseRestore('scepter-1.stext', save)).toEqual([{ key: 'scepter', value: save }]);
    expect(parseRestore('custom-1.stext', save)).toEqual([{ key: 'custom', value: save }]);
    expect(() =>
      parseRestore('all-1.stext', content.replace('"id":"scepter"', '"id":"stext-next:settings"')),
    ).toThrow();
    expect(() =>
      parseRestore('all-1.stext', content.replace(slots.replaceAll('"', '\\"'), 'bad')),
    ).toThrow();
  });
});
