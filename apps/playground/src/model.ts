/**
 * シナリオの編集操作。どれも元のシナリオを書き換えず、新しいシナリオを返す。
 */
import { SCENARIO_FORMAT, type Choice, type Scenario, type Scene } from '@stext/schema';

export const SCHEMA_URL = 'https://snext1220.github.io/stext-next/schema/scenario.v2.json';

/** 新しい空のシナリオ（シーン 0 だけ） */
export function emptyScenario(title = '新しいシナリオ'): Scenario {
  return {
    $schema: SCHEMA_URL,
    format: SCENARIO_FORMAT,
    meta: { title, author: '' },
    items: [],
    flags: [],
    params: [],
    enemies: [],
    results: [],
    groups: [],
    licence: [],
    scenes: [{ id: '0', summary: 'プロローグ', text: 'ここにプロローグを書きます。', choices: [] }],
  };
}

export function findScene(s: Scenario, id: string): Scene | undefined {
  return s.scenes.find((x) => x.id === id);
}

function mapScenes(s: Scenario, fn: (scene: Scene) => Scene): Scenario {
  return { ...s, scenes: s.scenes.map(fn) };
}

/** 使われていない次のシーン ID（数値の ID の最大値の次の10の倍数） */
export function nextSceneId(s: Scenario): string {
  const numbers = s.scenes.map((x) => Number(x.id)).filter((n) => Number.isInteger(n) && n < 90000);
  const max = numbers.length ? Math.max(...numbers) : -10;
  let id = Math.floor(max / 10) * 10 + 10;
  while (findScene(s, String(id))) id += 10;
  return String(id);
}

export interface AddSceneOptions {
  id?: string;
  summary?: string;
  /** このシーンから新しいシーンへの選択肢も作る */
  from?: string;
  label?: string;
  position?: { x: number; y: number };
}

export function addScene(
  s: Scenario,
  opts: AddSceneOptions = {},
): { scenario: Scenario; id: string } {
  const id = opts.id ?? nextSceneId(s);
  if (findScene(s, id)) throw new Error(`シーン「${id}」はすでにあります`);
  const fromScene = opts.from ? findScene(s, opts.from) : undefined;
  const position =
    opts.position ??
    (fromScene?.editor?.x !== undefined && fromScene.editor.y !== undefined
      ? { x: fromScene.editor.x + 260, y: fromScene.editor.y }
      : undefined);
  const scene: Scene = { id, summary: opts.summary ?? '新しいシーン', text: '', choices: [] };
  if (position) scene.editor = { x: position.x, y: position.y };
  let next: Scenario = { ...s, scenes: [...s.scenes, scene] };
  if (opts.from) next = addChoice(next, opts.from, id, opts.label);
  return { scenario: next, id };
}

/** シーンを消す。そのシーンへの選択肢も取り除く */
export function deleteScene(s: Scenario, id: string): Scenario {
  const scenes = s.scenes
    .filter((x) => x.id !== id)
    .map((scene) => ({
      ...scene,
      choices: scene.choices.flatMap((c): Choice[] => {
        if ('kind' in c && c.kind === 'jump') {
          const allow = c.allow.filter((t) => t !== id);
          return allow.length ? [{ ...c, allow }] : [];
        }
        if ('kind' in c && c.kind === 'answer') return c.to === id || c.else === id ? [] : [c];
        const to = c.to.filter((t) => t !== id);
        return to.length ? [{ ...c, to }] : [];
      }),
    }));
  const meta = s.meta.footerScene === id ? omit(s.meta, 'footerScene') : s.meta;
  return { ...s, meta, scenes };
}

/** シーン ID を変える。選択肢の遷移先・ルール・共通フッター・${import} の参照も直す */
export function renameScene(s: Scenario, from: string, to: string): Scenario {
  const id = to.trim();
  if (id === '') throw new Error('シーン ID が空です');
  if (id === from) return s;
  if (findScene(s, id)) throw new Error(`シーン「${id}」はすでにあります`);
  const r = (t: string) => (t === from ? id : t);
  const importRe = new RegExp(`\\$\\{import[\\s]+${escapeRe(from)}\\}`, 'g');
  const next = mapScenes(s, (scene) => {
    const updated: Scene = {
      ...scene,
      id: r(scene.id),
      text: scene.text.replace(importRe, `\${import ${id}}`),
      choices: scene.choices.map((c): Choice => {
        if ('kind' in c && c.kind === 'jump') return { ...c, allow: c.allow.map(r) };
        if ('kind' in c && c.kind === 'answer') return { ...c, to: r(c.to), else: r(c.else) };
        return { ...c, to: c.to.map(r) };
      }),
    };
    if (scene.rule) updated.rule = r(scene.rule);
    return updated;
  });
  const meta = s.meta.footerScene === from ? { ...s.meta, footerScene: id } : s.meta;
  return { ...next, meta };
}

export function updateScene(s: Scenario, id: string, patch: Partial<Scene>): Scenario {
  return mapScenes(s, (scene) => (scene.id === id ? clean({ ...scene, ...patch }) : scene));
}

export function addChoice(s: Scenario, from: string, to: string, label = '次へ'): Scenario {
  return mapScenes(s, (scene) =>
    scene.id === from ? { ...scene, choices: [...scene.choices, { label, to: [to] }] } : scene,
  );
}

export function updateChoice(
  s: Scenario,
  sceneId: string,
  index: number,
  choice: Choice,
): Scenario {
  return mapScenes(s, (scene) =>
    scene.id === sceneId
      ? { ...scene, choices: scene.choices.map((c, i) => (i === index ? clean(choice) : c)) }
      : scene,
  );
}

export function removeChoice(s: Scenario, sceneId: string, index: number): Scenario {
  return mapScenes(s, (scene) =>
    scene.id === sceneId
      ? { ...scene, choices: scene.choices.filter((_, i) => i !== index) }
      : scene,
  );
}

/** 選択肢の並びを入れ替える（delta は -1 で上へ、1 で下へ） */
export function moveChoice(s: Scenario, sceneId: string, index: number, delta: number): Scenario {
  return mapScenes(s, (scene) => {
    if (scene.id !== sceneId) return scene;
    const j = index + delta;
    if (j < 0 || j >= scene.choices.length) return scene;
    const choices = [...scene.choices];
    [choices[index], choices[j]] = [choices[j]!, choices[index]!];
    return { ...scene, choices };
  });
}

export function setPosition(s: Scenario, id: string, x: number, y: number): Scenario {
  return mapScenes(s, (scene) =>
    scene.id === id
      ? { ...scene, editor: { ...scene.editor, x: Math.round(x), y: Math.round(y) } }
      : scene,
  );
}

/** 定義（アイテム・フラグなど）の一覧を差し替える */
export function setList<
  K extends 'items' | 'flags' | 'params' | 'enemies' | 'results' | 'groups' | 'licence',
>(s: Scenario, key: K, list: Scenario[K]): Scenario {
  return { ...s, [key]: list };
}

export interface GraphNode {
  id: string;
  summary: string;
  end?: 'happy' | 'bad' | 'good';
  position?: { x: number; y: number };
  color?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  /** 条件付きの選択肢 */
  conditional: boolean;
  kind: 'go' | 'random' | 'jump' | 'answer';
  /** 元のシーンの choices の位置 */
  index: number;
}

/** フロー図に描くシーンと選択肢 */
export function toGraph(s: Scenario): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const ids = new Set(s.scenes.map((x) => x.id));
  const nodes = s.scenes.map((scene): GraphNode => {
    const n: GraphNode = { id: scene.id, summary: scene.summary ?? firstLine(scene.text) };
    if (scene.end) n.end = scene.end;
    if (scene.editor?.x !== undefined && scene.editor.y !== undefined)
      n.position = { x: scene.editor.x, y: scene.editor.y };
    if (scene.editor?.color) n.color = scene.editor.color;
    return n;
  });
  const edges: GraphEdge[] = [];
  for (const scene of s.scenes) {
    scene.choices.forEach((c, index) => {
      const push = (
        target: string,
        label: string,
        kind: GraphEdge['kind'],
        conditional = false,
      ) => {
        if (!ids.has(target)) return;
        edges.push({
          id: `${scene.id}:${index}:${target}:${edges.length}`,
          source: scene.id,
          target,
          label,
          conditional,
          kind,
          index,
        });
      };
      if ('kind' in c && c.kind === 'jump') c.allow.forEach((t) => push(t, '番号入力', 'jump'));
      else if ('kind' in c && c.kind === 'answer') {
        push(c.to, `「${c.answer}」`, 'answer');
        push(c.else, 'それ以外', 'answer');
      } else {
        const targets = [...new Set(c.to)];
        targets.forEach((t) =>
          push(t, c.label, targets.length > 1 ? 'random' : 'go', c.if !== undefined),
        );
      }
    });
  }
  return { nodes, edges };
}

function firstLine(text: string) {
  return (
    text
      .split('\n')
      .find((l) => l.trim() !== '')
      ?.slice(0, 20) ?? ''
  );
}

/** undefined と空文字の項目を取り除く（スキーマの optional に合わせる） */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}

function omit<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
