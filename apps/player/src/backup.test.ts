import { describe, expect, it } from 'vitest';
import { ALL, backupContent, backupFileName, parseBackup } from './backup.js';

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
const store: Record<string, string> = { scepter: save, sorcerian_text: global };
const get = (k: string) => store[k] ?? null;

describe('backup', () => {
  it('writes the legacy .stext formats', () => {
    expect(backupContent('scepter', [], get)).toBe(save);
    expect(backupContent(ALL, ['scepter', 'doll'], get)).toBe(
      `sorcerian_text\n${global}\nscepter\n${save}\n`,
    );
    expect(backupContent('doll', [], get)).toBeNull();
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
  });
});
