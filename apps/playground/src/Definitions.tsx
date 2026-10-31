import type { Scenario } from '@stext/schema';
import { useState } from 'react';
import { TextArea, TextField, fromList, toList } from './fields.js';
import { HelpButton } from './help/HelpPanel.js';
import { setList } from './model.js';

export type ListKey = 'items' | 'flags' | 'params' | 'enemies' | 'results' | 'groups' | 'licence';

interface Column {
  key: string;
  label: string;
  /** 数値として保存する */
  number?: boolean;
  /** チェックボックス */
  boolean?: boolean;
  placeholder?: string;
  wide?: boolean;
}

/** 旧 Playground の「アイテム」「フラグ」などのタブと同じ項目。ヘルプのキーは「表.列」（items.id など） */
export const TABLES: Record<
  ListKey,
  { label: string; columns: Column[]; newRow: (n: number) => Record<string, unknown> }
> = {
  items: {
    label: 'アイテム',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '名前' },
      { key: 'text', label: '説明', wide: true },
      {
        key: 'target',
        label: '使うと作用',
        placeholder: 'hp / mp / state / str / free1 / param / none',
      },
      { key: 'effect', label: '効果', placeholder: '10 / full / -poison / p01:1' },
      { key: 'shared', label: '続編に持ち越す', boolean: true },
    ],
    newRow: (n) => ({ id: `i${pad(n)}`, name: '新しいアイテム' }),
  },
  flags: {
    label: 'フラグ',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'text', label: '手記に書く文', wide: true },
      { key: 'hidden', label: '隠しフラグ', boolean: true },
    ],
    newRow: (n) => ({ id: `f${pad(n)}`, text: '' }),
  },
  params: {
    label: 'パラメーター',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'text', label: '説明', wide: true },
      { key: 'initial', label: '初期値' },
      { key: 'min', label: '最小', number: true },
      { key: 'max', label: '最大', number: true },
    ],
    newRow: (n) => ({ id: `p${pad(n)}`, initial: 0 }),
  },
  enemies: {
    label: '敵',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '名前' },
      { key: 'text', label: '説明', wide: true },
      { key: 'element', label: '属性', placeholder: 'earth / fire / water / wind / spirit' },
      { key: 'attack', label: '攻撃', placeholder: 'physics / magic / both / poison / str2' },
      { key: 'func', label: 'ダメージ式', placeholder: 'L+R-STR / DEX>2L' },
      { key: 'funcOpp', label: 'こちらの攻撃式', placeholder: 'L+R+STR' },
      { key: 'hp', label: 'HP', placeholder: '30 / p01' },
      { key: 'drop', label: '戦利品', placeholder: 'sun/5 / item/i01/名前' },
    ],
    newRow: (n) => ({ id: `m${pad(n)}`, name: '新しい敵', attack: 'physics', func: 'L-STR' }),
  },
  results: {
    label: '実績',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: '名前' },
      { key: 'text', label: '説明', wide: true },
      { key: 'level', label: 'レベル', number: true },
    ],
    newRow: (n) => ({ id: `r${pad(n)}`, name: '新しい実績', level: 1 }),
  },
  groups: {
    label: 'グループ',
    columns: [
      { key: 'title', label: '名前' },
      { key: 'start', label: '最初のシーン' },
      { key: 'end', label: '最後のシーン' },
      { key: 'rule', label: '戦闘ルールのシーン' },
    ],
    newRow: () => ({ title: '新しいグループ', start: '0', end: '0' }),
  },
  licence: {
    label: 'ライセンス',
    columns: [
      { key: 'name', label: '素材名' },
      { key: 'category', label: '種類', placeholder: 'bgm / picture / se' },
      { key: 'creator', label: '作者' },
      { key: 'url', label: 'URL', wide: true },
    ],
    newRow: () => ({ name: '' }),
  },
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function Definitions({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (next: Scenario, mergeKey?: string) => void;
}) {
  const [tab, setTab] = useState<'meta' | ListKey>('meta');
  return (
    <div className="pg-defs">
      <div className="pg-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'meta'}
          onClick={() => setTab('meta')}
        >
          基本
        </button>
        {(Object.keys(TABLES) as ListKey[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
          >
            {TABLES[k].label}
            <small>{(scenario[k] as unknown[]).length}</small>
          </button>
        ))}
        <HelpButton topic={tab === 'meta' ? 'scenario' : tab} />
      </div>
      {tab === 'meta' ? (
        <MetaEditor scenario={scenario} onChange={onChange} />
      ) : (
        <Table scenario={scenario} listKey={tab} onChange={onChange} />
      )}
    </div>
  );
}

function Table({
  scenario,
  listKey,
  onChange,
}: {
  scenario: Scenario;
  listKey: ListKey;
  onChange: (next: Scenario, mergeKey?: string) => void;
}) {
  const def = TABLES[listKey];
  const rows = scenario[listKey] as Record<string, unknown>[];
  const set = (list: Record<string, unknown>[], key?: string) =>
    onChange(setList(scenario, listKey, list as never), key);
  const setCell = (i: number, col: Column, raw: string | boolean) => {
    const row = { ...rows[i]! };
    if (col.boolean) {
      if (raw) row[col.key] = true;
      else delete row[col.key];
    } else if (raw === '') delete row[col.key];
    else if (
      col.number ||
      (col.key === 'initial' && /^-?\d+$/.test(String(raw))) ||
      (col.key === 'hp' && /^\d+$/.test(String(raw)))
    )
      row[col.key] = Number(raw);
    else row[col.key] = raw;
    set(
      rows.map((r, k) => (k === i ? row : r)),
      `${listKey}:${i}:${col.key}`,
    );
  };
  return (
    <div className="pg-table-wrap">
      <table className="pg-table">
        <thead>
          <tr>
            {def.columns.map((c) => (
              <th key={c.key}>
                {c.label}
                <HelpButton topic={`${listKey}.${c.key}`} />
              </th>
            ))}
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {def.columns.map((c) => (
                <td key={c.key} className={c.wide ? 'wide' : ''}>
                  {c.boolean ? (
                    <input
                      type="checkbox"
                      checked={Boolean(row[c.key])}
                      onChange={(e) => setCell(i, c, e.target.checked)}
                      aria-label={`${c.label}（${i + 1}行目）`}
                    />
                  ) : (
                    <input
                      value={row[c.key] === undefined ? '' : String(row[c.key])}
                      placeholder={c.placeholder}
                      onChange={(e) => setCell(i, c, e.target.value)}
                      aria-label={`${c.label}（${i + 1}行目）`}
                    />
                  )}
                </td>
              ))}
              <td>
                <button
                  type="button"
                  onClick={() => set(rows.filter((_, k) => k !== i))}
                  aria-label={`${i + 1}行目を削除`}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="pg-add"
        onClick={() => set([...rows, def.newRow(rows.length + 1)])}
      >
        ＋ {def.label}を追加
      </button>
    </div>
  );
}

function MetaEditor({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (next: Scenario, mergeKey?: string) => void;
}) {
  const m = scenario.meta;
  const set = (patch: Partial<Scenario['meta']>, key: string) => {
    const meta = Object.fromEntries(
      Object.entries({ ...m, ...patch }).filter(([, v]) => v !== undefined && v !== ''),
    ) as Scenario['meta'];
    onChange({ ...scenario, meta: { ...meta, title: meta.title ?? '' } }, `meta.${key}`);
  };
  const c = m.constraint ?? {};
  const setConstraint = (patch: Partial<NonNullable<Scenario['meta']['constraint']>>) => {
    const next = Object.fromEntries(
      Object.entries({ ...c, ...patch }).filter(
        ([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0),
      ),
    );
    set({ constraint: Object.keys(next).length ? next : undefined }, 'constraint');
  };
  return (
    <div className="pg-editor">
      <div className="pg-grid">
        <TextField
          label="タイトル"
          help="meta.title"
          value={m.title}
          onChange={(v) => set({ title: v }, 'title')}
          wide
        />
        <TextField
          label="作者"
          help="meta.author"
          value={m.author}
          onChange={(v) => set({ author: v }, 'author')}
        />
        <TextField
          label="シナリオ ID"
          help="meta.id"
          value={m.id}
          onChange={(v) => set({ id: v }, 'id')}
          hint="試遊で画像を scenarios/<ID>/capture/ から読むときに使う"
        />
        <TextField
          label="キーワード"
          help="meta.keywords"
          value={fromList(m.keywords)}
          onChange={(v) => set({ keywords: toList(v).length ? toList(v) : undefined }, 'keywords')}
        />
        <TextField
          label="BGM（通常）"
          help="meta.bgm.main"
          value={m.bgm?.main}
          onChange={(v) => set({ bgm: { ...m.bgm, main: v || undefined } }, 'bgm.main')}
          placeholder="@field05"
        />
        <TextField
          label="BGM（ハッピー）"
          help="meta.bgm.happy"
          value={m.bgm?.happy}
          onChange={(v) => set({ bgm: { ...m.bgm, happy: v || undefined } }, 'bgm.happy')}
          placeholder="@field04"
        />
        <TextField
          label="BGM（バッド）"
          help="meta.bgm.bad"
          value={m.bgm?.bad}
          onChange={(v) => set({ bgm: { ...m.bgm, bad: v || undefined } }, 'bgm.bad')}
          placeholder="@town01"
        />
        <TextField
          label="選べる種族"
          help="meta.constraint.race"
          value={fromList(c.race)}
          onChange={(v) => setConstraint({ race: toList(v) as never })}
          placeholder="FIGHTER, WIZARD, DWARF, ELF"
        />
        <TextField
          label="選べる年齢"
          help="meta.constraint.age"
          value={fromList(c.age)}
          onChange={(v) => setConstraint({ age: toList(v) as never })}
          placeholder="YOUNG, ADULT, OLD"
        />
        <TextField
          label="性別"
          help="meta.constraint.sex"
          value={c.sex}
          onChange={(v) => setConstraint({ sex: (v || undefined) as never })}
          placeholder="MALE / FEMALE"
        />
        <TextField
          label="共通フッターのシーン"
          help="meta.footerScene"
          value={m.footerScene}
          onChange={(v) => set({ footerScene: v }, 'footerScene')}
          placeholder="99998"
        />
        {(['free1', 'free2', 'free3'] as const).map((k) => (
          <TextField
            key={k}
            label={`${k.toUpperCase()} の表示名`}
            help="meta.labels"
            value={m.labels?.[k]}
            onChange={(v) => {
              const labels = { ...m.labels, [k]: v };
              if (!v) delete labels[k];
              set({ labels: Object.keys(labels).length ? labels : undefined }, `labels.${k}`);
            }}
          />
        ))}
      </div>
      <TextArea
        label="紹介文"
        help="meta.description"
        value={m.description ?? ''}
        onChange={(v) => set({ description: v }, 'description')}
        rows={3}
      />
    </div>
  );
}
