// @vitest-environment jsdom
import { ReactFlow, MarkerType, type ReactFlowProps } from '@xyflow/react';
import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowView } from './FlowView.js';
import { emptyScenario, toGraph } from './model.js';

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  ReactFlow: vi.fn<(props: ReactFlowProps) => null>(() => null),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const chromium = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

describe('FlowView', () => {
  it.each([
    ['macOS Safari', `${mac} (KHTML, like Gecko) Version/18.0 Safari/605.1.15`, true],
    ['iOS Safari', `${ios} (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`, true],
    ['Chrome', `${chromium} (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`, false],
    ['Edge', `${chromium} Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0`, false],
    [
      'Firefox',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/132.0',
      false,
    ],
    ['iOS Chrome', `${ios} CriOS/130.0.0.0 Mobile/15E148 Safari/604.1`, false],
    ['iOS Firefox', `${ios} FxiOS/132.0 Mobile/15E148 Safari/605.1.15`, false],
    ['iOS Edge', `${ios} Version/18.0 EdgiOS/130.0 Mobile/15E148 Safari/605.1.15`, false],
    ['Opera', `${chromium} Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0`, false],
    ['WebView', `${ios} (KHTML, like Gecko) Mobile/15E148`, false],
    ['unknown browser', '', false],
  ])(
    'uses the expected rendering mode for %s and preserves branches',
    (_, userAgent, lightweight) => {
      vi.stubGlobal('navigator', { userAgent });
      const scenario = emptyScenario();
      scenario.scenes = [
        {
          id: '0',
          text: '',
          choices: [
            { label: '次へ', to: ['10'], if: 'f01' },
            { label: '運試し', to: ['10', '20'] },
            { kind: 'jump', allow: ['10', '20'] },
            { kind: 'answer', answer: 'はい', to: '10', else: '20' },
          ],
        },
        { id: '10', text: '', choices: [] },
        { id: '20', text: '', choices: [] },
      ];
      const graph = toGraph(scenario);

      renderToStaticMarkup(
        <FlowView
          scenario={scenario}
          selected="0"
          playingScene="10"
          problems={new Map()}
          onSelect={vi.fn()}
          onMove={vi.fn()}
          onConnect={vi.fn()}
        />,
      );

      const props = vi.mocked(ReactFlow).mock.calls.at(-1)![0];
      expect(props.nodes).toHaveLength(3);
      expect(props.nodes?.find((node) => node.id === '10')?.data.playing).toBe(true);
      expect(props.nodes?.find((node) => node.id === '0')?.data.playing).toBe(false);
      expect(props.edges).toHaveLength(7);
      for (const [index, edge] of props.edges!.entries()) {
        const original = graph.edges[index]!;
        expect(edge.animated).toBe(!lightweight && original.kind === 'random');
        expect(edge).toMatchObject({
          id: original.id,
          source: original.source,
          target: original.target,
          label: original.label,
          className: `flow-edge kind-${original.kind}${original.conditional ? ' conditional' : ''}`,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
      expect(props.onlyRenderVisibleElements).toBe(lightweight);
    },
  );

  it('centers the requested scene after initialization and scene changes', () => {
    let frameCallback: FrameRequestCallback | undefined;
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) => ((frameCallback = callback), 1),
    );
    const flow = {
      getInternalNode: vi.fn((id: string) => ({
        internals: { positionAbsolute: { x: id === '10' ? 100 : 400, y: 500 } },
        measured: { width: 200, height: 60 },
      })),
      getZoom: vi.fn(() => 0.75),
      setCenter: vi.fn(),
      fitView: vi.fn(),
    };
    const scenario = emptyScenario();
    scenario.scenes = [
      { id: '10', text: '', choices: [] },
      { id: '20', text: '', choices: [] },
    ];

    const { rerender } = render(
      <FlowView
        scenario={scenario}
        selected="10"
        focusRequest={{ id: '10' }}
        problems={new Map()}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onConnect={vi.fn()}
      />,
    );

    const props = vi.mocked(ReactFlow).mock.calls.at(-1)![0];
    act(() => props.onInit?.(flow as never));
    act(() => frameCallback?.(0));
    expect(flow.setCenter).toHaveBeenLastCalledWith(200, 530, { zoom: 0.75, duration: 250 });

    rerender(
      <FlowView
        scenario={scenario}
        selected="20"
        focusRequest={{ id: '20' }}
        problems={new Map()}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onConnect={vi.fn()}
      />,
    );
    act(() => frameCallback?.(0));

    expect(flow.setCenter).toHaveBeenLastCalledWith(500, 530, { zoom: 0.75, duration: 250 });
  });
});
