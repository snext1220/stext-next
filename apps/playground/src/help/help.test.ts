import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLES, type ListKey } from '../Definitions.js';
import { HELP, parseHelp, searchHelp } from './help.js';

/** 旧 Playground の lib/reference.xml の全項目（移行漏れの確認用） */
const LEGACY_PATHS = [
  'scenario',
  'title',
  'author',
  'init',
  'init/basic',
  'init/basic/summary',
  'init/basic/imgset',
  'init/constraint',
  'init/constraint/race',
  'init/constraint/sex',
  'init/constraint/age',
  'init/bgm',
  'init/bgm/main',
  'init/bgm/happy',
  'init/bgm/bad',
  'init/bgm/common',
  'init/label',
  'init/label/status',
  'init/label/free',
  'init/intro',
  'init/intro/keywords',
  'init/intro/description',
  'groups',
  'groups/group',
  'groups/group/start',
  'groups/group/end',
  'groups/group/title',
  'groups/group/rule',
  'items',
  'items/item',
  'items/item/id',
  'items/item/name',
  'items/item/target',
  'items/item/effect',
  'items/item/shared',
  'items/item/text',
  'flags',
  'flags/flag',
  'flags/flag/id',
  'flags/flag/text',
  'params',
  'params/param',
  'params/param/id',
  'params/param/min',
  'params/param/max',
  'params/param/initial',
  'params/param/text',
  'enemies',
  'enemies/enemy',
  'enemies/enemy/id',
  'enemies/enemy/name',
  'enemies/enemy/element',
  'enemies/enemy/attack',
  'enemies/enemy/func',
  'enemies/enemy/hp',
  'enemies/enemy/func_opp',
  'enemies/enemy/drop',
  'enemies/enemy/text',
  'results',
  'results/result',
  'results/result/id',
  'results/result/name',
  'results/result/level',
  'results/result/text',
  'licence',
  'licence/work',
  'licence/work/name',
  'licence/work/category',
  'licence/work/creator',
  'licence/work/url',
  'scene',
  'scene/id',
  'scene/summary',
  'scene/items',
  'scene/flags',
  'scene/params',
  'scene/enemies',
  'scene/dice',
  'scene/stars',
  'scene/hp_mp',
  'scene/state',
  'scene/status',
  'scene/free',
  'scene/result',
  'scene/bgm',
  'scene/se',
  'scene/rule',
  'scene/end',
  'scene/nexts',
  'scene/exclude',
  'scene/fixed',
  'scene/color',
  'scene/text',
  'scene/edge',
  'scene/edge_flow',
  'scene/edge_common',
];

/** ソースの help="…" / topic="…" で参照しているキー */
function keysInSource(): string[] {
  const dir = join(import.meta.dirname, '..');
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
    f.endsWith('.tsx'),
  );
  return files.flatMap((f) =>
    [...readFileSync(join(dir, f), 'utf8').matchAll(/\b(?:help|topic)="([^"]+)"/g)].map(
      (m) => m[1]!,
    ),
  );
}

describe('ダイナミックヘルプ', () => {
  it('reference.md を読める', () => {
    expect(HELP.entries.length).toBeGreaterThan(90);
    for (const e of HELP.entries) {
      expect(e.body, e.key).not.toBe('');
      expect(e.category, e.key).not.toBe('');
    }
  });

  it('関連する項目と本文のリンクは、どれも存在する', () => {
    for (const e of HELP.entries) {
      for (const k of e.related) expect(HELP.get(k), `${e.key} → ${k}`).toBeDefined();
      const text = [e.body, ...e.marks.map((m) => m.text)].join('\n');
      for (const m of text.matchAll(/\(#help\/([^)\s]+)\)/g))
        expect(HELP.get(m[1]!), `${e.key} → ${m[1]}`).toBeDefined();
    }
  });

  it('フォームから参照しているキーは、どれも存在する', () => {
    const keys = keysInSource();
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) expect(HELP.get(k), k).toBeDefined();
    for (const k of ['str', 'int', 'dex', 'krm', 'free1', 'free2', 'free3'])
      expect(HELP.get(`effects.${k}`), k).toBeDefined();
    for (const [table, def] of Object.entries(TABLES) as [ListKey, (typeof TABLES)[ListKey]][]) {
      expect(HELP.get(table), table).toBeDefined();
      for (const c of def.columns)
        expect(HELP.get(`${table}.${c.key}`), `${table}.${c.key}`).toBeDefined();
    }
  });

  it('旧 reference.xml のすべての項目を移している', () => {
    const migrated = new Set(HELP.entries.flatMap((e) => e.legacy));
    expect(LEGACY_PATHS.filter((p) => !migrated.has(p))).toEqual([]);
    expect([...migrated].filter((p) => !LEGACY_PATHS.includes(p))).toEqual([]);
  });

  it('移行メモの種別を読み取る', () => {
    const book = parseHelp(
      [
        '# 分類',
        '## a, b | 見出し',
        '@legacy x/y',
        '@related b',
        '@mark 要確認: 確かめる',
        '',
        '本文',
        '```',
        '## コードの中は見出しにしない',
        '```',
      ].join('\n'),
    );
    const e = book.get('b');
    expect(e?.key).toBe('a');
    expect(e?.marks).toEqual([{ kind: '要確認', text: '確かめる' }]);
    expect(e?.body).toContain('## コードの中は見出しにしない');
    expect(() => parseHelp('## a | x\n@mark 不明: x')).toThrow(/@mark/);
    expect(() => parseHelp('## a | x\n\n本文\n## a | y')).toThrow(/重複/);
  });

  it('見出し・キー・本文で検索できる', () => {
    expect(searchHelp(HELP, 'BGM').some((e) => e.key === 'common.bgm')).toBe(true);
    expect(searchHelp(HELP, '${if').some((e) => e.key === 'text.if')).toBe(true);
    expect(searchHelp(HELP, '')).toHaveLength(HELP.entries.length);
  });
});
