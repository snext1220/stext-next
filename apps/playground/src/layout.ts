/**
 * フロー図の自動レイアウト（左から右へ、選択肢の向きに並べる）。
 */
import dagre from '@dagrejs/dagre';
import type { Scenario } from '@stext/schema';
import { toGraph } from './model.js';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 64;

/** 位置のないシーン（all なら全シーン）を並べ直す */
export function autoLayout(s: Scenario, all = false): Scenario {
  const { nodes, edges } = toGraph(s);
  if (!all && nodes.every((n) => n.position)) return s;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) if (e.source !== e.target) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return {
    ...s,
    scenes: s.scenes.map((scene) => {
      if (!all && scene.editor?.x !== undefined && scene.editor.y !== undefined) return scene;
      const p = g.node(scene.id);
      return {
        ...scene,
        editor: {
          ...scene.editor,
          x: Math.round(p.x - NODE_WIDTH / 2),
          y: Math.round(p.y - NODE_HEIGHT / 2),
        },
      };
    }),
  };
}
