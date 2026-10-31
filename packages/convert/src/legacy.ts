/**
 * 旧形式（scenario.xml / Playground の JSON）を、共通の中間形式 LegacyScenario に読み込む。
 * 属性は旧形式のまま文字列で持ち、stext/2 への変換は to-v2.ts で行う。
 */
import { XMLParser } from 'fast-xml-parser';

export interface LegacyNode {
  attrs: Record<string, string>;
  text: string;
}

export interface LegacyScenario {
  attrs: Record<string, string>;
  init: Record<string, Record<string, string>>;
  groups: LegacyNode[];
  items: LegacyNode[];
  flags: LegacyNode[];
  params: LegacyNode[];
  enemies: LegacyNode[];
  results: LegacyNode[];
  licence: LegacyNode[];
  scenes: LegacyNode[];
}

const LIST_TAGS = ['group', 'item', 'flag', 'param', 'enemy', 'result', 'work', 'scene'];

interface XmlElement {
  '@'?: Record<string, string>;
  '#text'?: string;
  [child: string]: unknown;
}

/** scenario.xml を読み込む */
export function readScenarioXml(xml: string): LegacyScenario {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    attributesGroupName: '@',
    textNodeName: '#text',
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    alwaysCreateTextNode: true,
    ignoreDeclaration: true,
    isArray: (name) => LIST_TAGS.includes(name),
  });
  const doc = parser.parse(xml) as { scenario?: XmlElement };
  const root = doc.scenario;
  if (!root) throw new Error('scenario 要素が見つかりません');

  const child = (el: XmlElement | undefined, name: string) => el?.[name] as XmlElement | undefined;
  const list = (container: string, tag: string): LegacyNode[] =>
    ((child(root, container)?.[tag] as XmlElement[] | undefined) ?? []).map(toNode);
  const init = child(root, 'init');
  const initAttrs = (name: string) => ({ ...child(init, name)?.['@'] });

  return {
    attrs: stripNamespaced(root['@'] ?? {}),
    init: {
      basic: initAttrs('basic'),
      constraint: initAttrs('constraint'),
      bgm: initAttrs('bgm'),
      label: initAttrs('label'),
      intro: initAttrs('intro'),
    },
    groups: list('groups', 'group'),
    items: list('items', 'item'),
    flags: list('flags', 'flag'),
    params: list('params', 'param'),
    enemies: list('enemies', 'enemy'),
    results: list('results', 'result'),
    licence: [...list('licence', 'work'), ...list('license', 'work')],
    scenes: ((root['scene'] as XmlElement[] | undefined) ?? []).map(toNode),
  };
}

function toNode(el: XmlElement): LegacyNode {
  return { attrs: { ...el['@'] }, text: el['#text'] ?? '' };
}

function stripNamespaced(attrs: Record<string, string>) {
  return Object.fromEntries(Object.entries(attrs).filter(([k]) => !k.includes(':')));
}

// ───── Playground の JSON ─────

interface PlaygroundEdge {
  from: string | number;
  to: string | number;
  label?: string;
  condition?: string;
  order?: string | number;
  /** Q（文字入力）、X（番号入力）、R（ランダム）、なし（通常） */
  type?: string;
  /** Q の正解 */
  correct?: string;
  /** R の結果を保持する日数 */
  cache?: string | number;
}

type Obj = Record<string, unknown>;

/**
 * Playground（開発環境）が保存する JSON を読み込む。
 * 選択肢（edges）は、Playground が scenario.xml を書き出すときと同じ規則で本文の末尾にリンクとして付ける。
 */
export function readPlaygroundJson(data: unknown): LegacyScenario {
  const json = data as Obj;
  if (!json || typeof json !== 'object' || !Array.isArray(json['scenes'])) {
    throw new Error('Playground の JSON ではありません（scenes がありません）');
  }
  const edges = ((json['edges'] as PlaygroundEdge[] | undefined) ?? []).map((e) => ({
    ...e,
    from: String(e.from),
    to: String(e.to),
  }));
  const init = (json['init'] as Record<string, Obj> | undefined) ?? {};
  const nodes = (key: string, drop: string[] = []) =>
    ((json[key] as Obj[] | undefined) ?? []).map((o) => objToNode(o, drop));

  return {
    attrs: stringify({ title: json['title'], author: json['author'] }),
    init: Object.fromEntries(
      ['basic', 'constraint', 'bgm', 'label', 'intro'].map((k) => [k, stringify(init[k] ?? {})]),
    ),
    groups: nodes('groups'),
    items: nodes('items'),
    flags: nodes('flags'),
    params: nodes('params'),
    enemies: nodes('enemies'),
    results: nodes('results'),
    licence: nodes('licence'),
    scenes: nodes('scenes', ['label']).map((scene) => ({
      attrs: scene.attrs,
      text: scene.text + '\n\n' + playgroundLinks(scene.attrs['id'] ?? '', edges),
    })),
  };
}

function objToNode(o: Obj, drop: string[]): LegacyNode {
  const { text, ...rest } = o;
  for (const k of drop) delete rest[k];
  return { attrs: stringify(rest), text: typeof text === 'string' ? text : '' };
}

function stringify(o: Obj): Record<string, string> {
  return Object.fromEntries(
    Object.entries(o)
      .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
      .map(([k, v]) => [k, String(v)]),
  );
}

/** Playground の createMoveButton と同じ規則でリンクを作る */
function playgroundLinks(id: string, edges: (PlaygroundEdge & { from: string; to: string })[]) {
  const groups: (typeof edges)[] = [];
  edges
    .filter((e) => e.from === id)
    .map((e) => ({ ...e, order: e.order ?? 0 }))
    .sort((a, b) => Number(a.order) - Number(b.order))
    .forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last[0]!.order === e.order) last.push(e);
      else groups.push([e]);
    });

  const lines: string[] = [];
  for (const group of groups) {
    const type = group[0]!.type;
    if (type === 'Q') {
      const correct = group.find((e) => e.correct);
      const wrong = group.find((e) => !e.correct);
      lines.push(`[${correct?.correct ?? ''},${correct?.to ?? ''},${wrong?.to ?? ''}](Q)`);
    } else if (type === 'X') {
      lines.push(`[${group.map((e) => e.to).join(',')}](X)`);
    } else if (type === 'R') {
      const label = group.find((e) => e.label)?.label ?? '';
      const condition = group.find((e) => e.condition)?.condition;
      const cache = group.find((e) => e.cache)?.cache;
      const to = group.map((e) => e.to).join(',') + (cache ? `;${cache}` : '');
      lines.push(condition ? `[${label}](${to} "${condition}")` : `[${label}](${to})`);
    } else {
      for (const e of group) {
        lines.push(
          e.condition
            ? `[${e.label ?? ''}](${e.to} "${e.condition}")`
            : `[${e.label ?? ''}](${e.to})`,
        );
      }
    }
  }
  return lines.join('\n');
}
