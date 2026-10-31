/**
 * 中間形式 LegacyScenario を stext/2 のシナリオ JSON に変換する。
 */
import {
  MAGIC_NAMES,
  SCENARIO_FORMAT,
  checkScenario,
  parseCondition,
  validateScenario,
  walkCondition,
  type CheckIssue,
  type Choice,
  type Condition,
  type Effects,
  type Scenario,
  type Scene,
} from '@stext/schema';
import type { LegacyScenario } from './legacy.js';

export interface ConvertOptions {
  /** シナリオ ID（meta.id に入る。旧形式のディレクトリ名） */
  id?: string;
  /** 条件を条件 AST で出力する（既定は文字列のまま） */
  structureConditions?: boolean;
  /** 出力する $schema の値 */
  schemaUrl?: string;
}

export interface ConvertStats {
  scenes: number;
  choices: number;
  conditions: number;
  /** 条件 AST に変換した数（structureConditions のとき） */
  structuredConditions: number;
}

export interface ConvertResult {
  scenario: Scenario;
  /** 変換時の注意と、変換後の整合性検査の結果 */
  issues: CheckIssue[];
  stats: ConvertStats;
}

export const DEFAULT_SCHEMA_URL = 'https://snext1220.github.io/stext-next/schema/scenario.v2.json';

const MAGIC = new Set<string>(MAGIC_NAMES);

export function toV2(legacy: LegacyScenario, options: ConvertOptions = {}): ConvertResult {
  const issues: CheckIssue[] = [];
  const warn = (path: string, message: string) =>
    issues.push({ severity: 'warning', path, message });
  const stats: ConvertStats = { scenes: 0, choices: 0, conditions: 0, structuredConditions: 0 };
  legacy = dropEntriesWithoutId(legacy, warn);
  const flagIds = legacy.flags.map((f) => f.attrs['id'] ?? '');
  const itemIds = legacy.items.map((i) => i.attrs['id'] ?? '');

  const condition = (raw: string): Condition => {
    stats.conditions++;
    if (!options.structureConditions) return raw;
    const r = parseCondition(raw, { flags: flagIds, items: itemIds });
    if (!r.ok) return raw; // 解釈できない条件は文字列のまま残す（checkScenario が報告する）
    stats.structuredConditions++;
    return r.node;
  };

  const scenes = legacy.scenes.map((node, i): Scene => {
    stats.scenes++;
    const path = `scenes[${i}]`;
    const { text, afterText, choices } = extractChoices(trimText(node.text), path, warn, condition);
    stats.choices += choices.length;
    // 旧エンジンは属性値を読むときに空白をすべて取り除いていた（nsAttr）。表示用の summary 以外は同じにする
    const a = { ...stripSpaces(node.attrs), summary: node.attrs['summary'] } as Record<
      string,
      string
    >;
    if (a['summary'] === undefined) delete a['summary'];
    const scene: Scene = { id: a['id'] ?? '', text, choices };
    setIf(scene, 'summary', a['summary']);
    setIf(scene, 'afterText', afterText);
    const effects = sceneEffects(a, `${path}.effects`, warn);
    if (Object.keys(effects).length > 0) scene.effects = effects;
    if (a['enemies']) scene.enemies = splitList(a['enemies']);
    if (a['end']) {
      if (a['end'] === 'happy' || a['end'] === 'bad' || a['end'] === 'good') scene.end = a['end'];
      else warn(path, `不明な end「${a['end']}」は無視しました`);
    }
    if (a['nexts']) scene.nexts = splitList(a['nexts']);
    // bgm="" はメインテーマに戻す指定なので、空文字も残す
    if (a['bgm'] !== undefined) scene.bgm = a['bgm'];
    setIf(scene, 'se', a['se']);
    setIf(scene, 'rule', a['rule']);
    setIf(scene, 'dice', a['dice']);
    if (a['exclude'] === 'true') scene.excludeFooter = true;
    const editor: NonNullable<Scene['editor']> = {};
    for (const k of ['x', 'y', 'level'] as const) {
      if (a[k] !== undefined && a[k] !== '' && !Number.isNaN(Number(a[k])))
        editor[k] = Number(a[k]);
    }
    setIf(editor, 'color', a['color']);
    setIf(editor, 'group', a['group']);
    if (Object.keys(editor).length > 0) scene.editor = editor;
    return scene;
  });

  const init = legacy.init;
  const meta: Scenario['meta'] = { title: legacy.attrs['title'] ?? '' };
  setIf(meta, 'id', options.id);
  setIf(meta, 'author', legacy.attrs['author']);
  setIf(meta, 'description', init['intro']?.['description']);
  if (init['intro']?.['keywords']) meta.keywords = splitList(init['intro']['keywords']);
  const c = init['constraint'] ?? {};
  if (c['race'] || c['age'] || c['sex']) {
    meta.constraint = {};
    if (c['race']) meta.constraint.race = splitList(c['race']) as never;
    if (c['age']) meta.constraint.age = splitList(c['age']) as never;
    if (c['sex']) meta.constraint.sex = c['sex'] as never;
  }
  const bgm = init['bgm'] ?? {};
  if (Object.keys(bgm).length > 0) meta.bgm = pick(bgm, ['main', 'happy', 'bad']);
  if (init['label'] && Object.keys(init['label']).length > 0) meta.labels = { ...init['label'] };
  setIf(meta, 'imageSet', init['basic']?.['imgset']);
  if (init['basic']?.['summary'] === 'true') meta.showSummary = true;
  if (scenes.some((s) => s.id === '99998')) meta.footerScene = '99998';

  const scenario: Scenario = {
    $schema: options.schemaUrl ?? DEFAULT_SCHEMA_URL,
    format: SCENARIO_FORMAT,
    meta,
    items: legacy.items.map((n) => {
      const item: Scenario['items'][number] = {
        id: n.attrs['id'] ?? '',
        name: n.attrs['name'] ?? '',
      };
      setIf(item, 'text', trimBlock(n.text));
      setIf(item, 'target', n.attrs['target']?.replace(/\s+/g, ''));
      setIf(item, 'effect', n.attrs['effect']?.replace(/\s+/g, ''));
      if (n.attrs['shared'] === 'true') item.shared = true;
      return item;
    }),
    flags: legacy.flags.map((n) => {
      const text = trimBlock(n.text) ?? '';
      return text.startsWith('*')
        ? { id: n.attrs['id'] ?? '', text: text.slice(1), hidden: true }
        : { id: n.attrs['id'] ?? '', text };
    }),
    params: legacy.params.map((n) => {
      const param: Scenario['params'][number] = { id: n.attrs['id'] ?? '' };
      setIf(param, 'text', trimBlock(n.text));
      const initial = n.attrs['initial'];
      if (initial !== undefined) param.initial = isNumber(initial) ? Number(initial) : initial;
      for (const k of ['min', 'max'] as const) {
        if (n.attrs[k] !== undefined && isNumber(n.attrs[k]!)) param[k] = Number(n.attrs[k]);
      }
      return param;
    }),
    enemies: legacy.enemies.map((n) => {
      const a = { ...stripSpaces(n.attrs), name: n.attrs['name'] } as Record<string, string>;
      const enemy: Scenario['enemies'][number] = { id: a['id'] ?? '', name: a['name'] ?? '' };
      setIf(enemy, 'text', trimBlock(n.text));
      setIf(enemy, 'element', a['element']);
      setIf(enemy, 'attack', a['attack']);
      setIf(enemy, 'func', a['func']);
      setIf(enemy, 'funcOpp', a['func_opp']);
      if (a['hp'] !== undefined && isNumber(a['hp'])) enemy.hp = Number(a['hp']);
      else if (a['hp']?.startsWith('p')) enemy.hp = a['hp'];
      setIf(enemy, 'drop', a['drop']);
      return enemy;
    }),
    results: legacy.results.map((n) => {
      const result: Scenario['results'][number] = {
        id: n.attrs['id'] ?? '',
        name: n.attrs['name'] ?? '',
      };
      setIf(result, 'text', trimBlock(n.text));
      if (n.attrs['level'] !== undefined && isNumber(n.attrs['level']))
        result.level = Number(n.attrs['level']);
      return result;
    }),
    groups: legacy.groups.map((n) => {
      const group: Scenario['groups'][number] = {
        title: n.attrs['title'] ?? '',
        start: n.attrs['start'] ?? '',
        end: n.attrs['end'] ?? '',
      };
      setIf(group, 'rule', n.attrs['rule']);
      setIf(group, 'text', trimBlock(n.text));
      return group;
    }),
    licence: legacy.licence.map((n) => {
      const work: Scenario['licence'][number] = { name: n.attrs['name'] ?? '' };
      setIf(work, 'category', n.attrs['category']);
      setIf(work, 'creator', n.attrs['creator']);
      setIf(work, 'url', n.attrs['url']);
      return work;
    }),
    scenes,
  };

  const valid = validateScenario(scenario);
  if (!valid.ok) {
    for (const i of valid.issues) issues.push({ severity: 'error', ...i });
  }
  issues.push(...checkScenario(scenario));
  return { scenario, issues, stats };
}

/** ID が空の定義（旧形式で書きかけのまま残っていたもの）を取り除く */
function dropEntriesWithoutId(
  legacy: LegacyScenario,
  warn: (path: string, message: string) => void,
): LegacyScenario {
  const out = { ...legacy };
  for (const key of ['items', 'flags', 'params', 'enemies', 'results', 'scenes'] as const) {
    out[key] = legacy[key].filter((n, i) => {
      if ((n.attrs['id'] ?? '').trim() !== '') return true;
      warn(`${key}[${i}]`, 'ID が空の定義を取り除きました');
      return false;
    });
  }
  return out;
}

// ───── 選択肢 ─────

/** 本文中のリンク [ラベル](遷移先 "条件")。画像 ![..](..) は除く */
const LINK = /(?<!!)\[([^\]\n]*)\]\(\s*([^\s)"]+)(?:\s+"([^"]*)")?\s*\)/g;
const SCENE_HREF = /^[\d\s,]+(;\d+)?$/;

function extractChoices(
  source: string,
  path: string,
  warn: (path: string, message: string) => void,
  condition: (raw: string) => Condition,
): { text: string; afterText?: string; choices: Choice[] } {
  const choices: Choice[] = [];
  let cursor = 0;
  let pending: string | undefined;
  let bodyEnd: string | undefined;

  for (const m of source.matchAll(LINK)) {
    const [whole, label = '', href = '', cond] = m;
    const isChoice = SCENE_HREF.test(href) || href === 'X' || href === 'Q';
    if (!isChoice) continue; // 外部リンクなどは本文に残す
    const between = source.slice(cursor, m.index);
    if (choices.length === 0) bodyEnd = between;
    else if (between.trim() !== '') pending = (pending ? pending + '\n' : '') + between.trim();
    cursor = m.index + whole.length;
    const cp = `${path}.choices[${choices.length}]`;

    let choice: Choice;
    if (href === 'X') {
      choice = { kind: 'jump', allow: splitList(label) };
    } else if (href === 'Q') {
      const [answer = '', to = '', otherwise = ''] = label.split(',');
      choice = { kind: 'answer', answer, to: to.trim(), else: otherwise.trim() };
    } else {
      const [targets = '', cache] = href.split(';');
      const go: Choice = { label, to: splitList(targets) };
      if (cache) go.randomCacheDays = Number(cache);
      if (cond !== undefined && cond.trim() !== '') {
        go.if = condition(cond);
        const cast = magicToCast(cond);
        if (cast.length > 0) go.cast = cast as never;
        else if (castIgnored(cond)) {
          warn(
            `${cp}.if`,
            cond.trim().startsWith('m')
              ? '& | を使う条件が魔法で始まっています。旧エンジンではこの選択肢を選ぶと常に「星が不足」になっていました'
              : '& | を使う条件に魔法が含まれています。旧エンジンでは選んでも星を消費していませんでした（cast は付けていません）',
          );
        }
      }
      choice = go;
    }
    if (pending) {
      choice.before = pending;
      pending = undefined;
    }
    choices.push(choice);
  }
  if (choices.length === 0) return { text: source.trimEnd(), choices };
  const rest = source.slice(cursor);
  const afterText =
    [pending, rest.trim()].filter((s) => s && s.trim() !== '').join('\n') || undefined;
  if (afterText) warn(path, '選択肢の後ろにある文章を afterText に移しました');
  const text = (bodyEnd ?? '').trimEnd();
  return afterText ? { text, afterText, choices } : { text, choices };
}

/** 旧エンジンが選択時に星を消費した魔法（カンマ区切りで、先頭が - でない条件の m で始まる項） */
function magicToCast(cond: string): string[] {
  if (cond.startsWith('-') || /[&|!()]|#(AND|OR|NOT|L|R)#|fn:/i.test(cond)) return [];
  return cond
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.startsWith('m') && MAGIC.has(c.slice(1)))
    .map((c) => c.slice(1));
}

function castIgnored(cond: string): boolean {
  if (cond.startsWith('-')) return false;
  const r = parseCondition(cond);
  return r.ok && [...walkCondition(r.node)].some((n) => 'magic' in n);
}

// ───── 効果 ─────

const INT = /^[+-]?\d+$/;
const RANGE = /^-?\d+\.\.-?\d+$/;
const SET = /^@-?\d+$/;

function sceneEffects(
  a: Record<string, string>,
  path: string,
  warn: (path: string, message: string) => void,
) {
  const e: Effects = {};
  const bad = (key: string) =>
    warn(`${path}.${key}`, `「${a[key]}」は解釈できないため無視しました`);
  for (const k of ['items', 'flags', 'params'] as const) if (a[k]) e[k] = splitList(a[k]);
  if (a['stars']) {
    if (a['stars'].includes(',')) {
      const stars = splitList(a['stars']).map(Number);
      if (stars.length > 7)
        warn(`${path}.stars`, `星が${stars.length}個指定されています。8個目以降は無視しました`);
      e.stars = stars.slice(0, 7);
    } else if (/^div\d+(\.\d+)?$/.test(a['stars'])) e.stars = a['stars'];
    else bad('stars');
  }
  for (const k of ['hp', 'mp'] as const) {
    const v = a[k];
    if (v === undefined || v === '') continue;
    if (INT.test(v)) e[k] = Number(v);
    else if (v === 'full' || v === 'half' || RANGE.test(v)) e[k] = v as never;
    else bad(k);
  }
  for (const k of ['str', 'int', 'dex', 'krm'] as const) {
    const v = a[k];
    if (v === undefined || v === '') continue;
    if (INT.test(v)) e[k] = Number(v);
    else if (v === 'full' || SET.test(v)) e[k] = v as never;
    else bad(k);
  }
  for (const k of ['free1', 'free2', 'free3'] as const) {
    const v = a[k];
    if (v === undefined || v === '') continue;
    if (INT.test(v)) e[k] = Number(v);
    else if (SET.test(v) || RANGE.test(v)) e[k] = v as never;
    else bad(k);
  }
  const max: NonNullable<Effects['max']> = {};
  for (const k of ['hp', 'mp', 'str', 'int', 'dex', 'krm'] as const) {
    const v = a[`${k}_max`];
    if (v === undefined || v === '') continue;
    if (INT.test(v)) max[k] = Number(v);
    else if (RANGE.test(v)) max[k] = v;
    else bad(`${k}_max`);
  }
  if (Object.keys(max).length > 0) e.max = max;
  if (a['state']) e.state = a['state'];
  if (a['result']) e.result = a['result'];
  return e;
}

// ───── 小物 ─────

function stripSpaces(attrs: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v.replace(/\s+/g, '')]));
}

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function isNumber(v: string) {
  return v.trim() !== '' && !Number.isNaN(Number(v));
}

/** シーン本文：先頭の空行と末尾の空白を取り除く */
function trimText(v: string) {
  return v.replace(/^\s*\n/, '').trimEnd();
}

/** 説明文：前後の空白を取り除き、空なら undefined */
function trimBlock(v: string) {
  const t = v.trim();
  return t === '' ? undefined : t;
}

function setIf<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined) {
  if (value !== undefined && value !== '') obj[key] = value;
}

function pick(o: Record<string, string>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
}
