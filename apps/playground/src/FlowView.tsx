import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { DraftScenario as Scenario } from '@stext/schema';
import { useEffect, useMemo, useState } from 'react';
import { NODE_WIDTH } from './layout.js';
import { toGraph, type GraphNode } from './model.js';

type SceneNodeData = Record<string, unknown> &
  GraphNode & { selected: boolean; playing: boolean; problems: number };

const END_LABEL = { happy: 'HAPPY', bad: 'BAD', good: 'GOOD' } as const;

function SceneNode({ data }: NodeProps<Node<SceneNodeData>>) {
  return (
    <div
      className={`flow-node${data.end ? ` end-${data.end}` : ''}${data.selected ? ' is-selected' : ''}${data.playing ? ' is-playing' : ''}`}
      aria-current={data.playing ? 'step' : undefined}
      style={{ width: NODE_WIDTH, ...(data.color ? { borderLeftColor: data.color } : {}) }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flow-node-id">
        §{data.id}
        {data.end && <span className="flow-end">{END_LABEL[data.end]}</span>}
        {data.problems > 0 && (
          <span className="flow-problems" title="問題があります">
            {data.problems}
          </span>
        )}
      </div>
      <div className="flow-node-summary">{data.summary || '（サマリーなし）'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { scene: SceneNode };

export interface FlowViewProps {
  scenario: Scenario;
  selected: string | undefined;
  playingScene?: string | undefined;
  focusRequest?: { id: string } | undefined;
  /** シーン ID ごとの問題の数 */
  problems: ReadonlyMap<string, number>;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onConnect: (from: string, to: string) => void;
}

export function FlowView({
  scenario,
  selected,
  playingScene,
  focusRequest,
  problems,
  onSelect,
  onMove,
  onConnect,
}: FlowViewProps) {
  const [flow, setFlow] = useState<ReactFlowInstance<Node<SceneNodeData>, Edge> | null>(null);
  useEffect(() => {
    if (!flow || !focusRequest) return;
    const frame = requestAnimationFrame(() => {
      const node = flow.getInternalNode(focusRequest.id);
      if (!node) return;
      void flow.setCenter(
        node.internals.positionAbsolute.x + (node.measured.width ?? NODE_WIDTH) / 2,
        node.internals.positionAbsolute.y + (node.measured.height ?? 48) / 2,
        { zoom: flow.getZoom(), duration: 250 },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, focusRequest]);
  const [lightweight] = useState(() => {
    const ua = navigator.userAgent;
    return (
      /AppleWebKit\//.test(ua) &&
      /Version\/[\d.]+.*Safari\//.test(ua) &&
      !/(Chrome|Chromium|CriOS|FxiOS|Edg|EdgA|EdgiOS|OPR|OPiOS|SamsungBrowser)\//.test(ua)
    );
  });
  const graph = useMemo(() => toGraph(scenario), [scenario]);
  const toNodes = (): Node<SceneNodeData>[] =>
    graph.nodes.map((n, i) => ({
      id: n.id,
      type: 'scene',
      position: n.position ?? { x: (i % 6) * 220, y: Math.floor(i / 6) * 100 },
      data: {
        ...n,
        selected: n.id === selected,
        playing: n.id === playingScene,
        problems: problems.get(n.id) ?? 0,
      },
    }));
  const [nodes, setNodes] = useState(toNodes);
  // 大きなシナリオでも最初は読める大きさで始める（最初のシーンに近いものだけを画面に収める）
  const [fitNodes] = useState(() => {
    const xs = nodes.map((n) => n.position.x);
    const left = Math.min(...xs);
    return nodes.filter((n) => n.position.x < left + 1000).map((n) => ({ id: n.id }));
  });
  // シナリオが変わったら作り直す（ドラッグ中の位置はこのコンポーネントの中で持つ）
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNodes(toNodes()), [graph, playingScene, problems]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes((current) =>
      current.map((node) =>
        node.data.selected === (node.id === selected)
          ? node
          : { ...node, data: { ...node.data, selected: node.id === selected } },
      ),
    );
  }, [selected]);

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label.length > 14 ? e.label.slice(0, 14) + '…' : e.label,
        className: `flow-edge kind-${e.kind}${e.conditional ? ' conditional' : ''}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: !lightweight && e.kind === 'random',
      })),
    [graph, lightweight],
  );

  return (
    <div className="flow" aria-label="シナリオのフロー図">
      <ReactFlow
        onInit={setFlow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements={lightweight}
        onNodesChange={(changes: NodeChange<Node<SceneNodeData>>[]) =>
          setNodes((ns) => applyNodeChanges(changes, ns))
        }
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDragStop={(_, node) => onMove(node.id, node.position.x, node.position.y)}
        onConnect={(c: Connection) => c.source && c.target && onConnect(c.source, c.target)}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.15, nodes: fitNodes }}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
