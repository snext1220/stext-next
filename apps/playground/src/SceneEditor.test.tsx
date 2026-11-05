// @vitest-environment jsdom
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneEditor } from './SceneEditor.js';

afterEach(cleanup);

const scenario: Scenario = {
  format: 'stext/2',
  meta: { id: 'settings', title: '設定' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [{ id: '0', text: '開始', choices: [] }],
};

describe('SceneEditor settings', () => {
  it('edits and clears maximum and initial stat effects', () => {
    const onChange = vi.fn();
    const scene = scenario.scenes[0]!;
    const { rerender } = render(
      <SceneEditor
        scenario={scenario}
        scene={scene}
        onChange={onChange}
        onRenamed={vi.fn()}
        onDelete={vi.fn()}
        onAddScene={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('HP の最大値・初期値'), {
      target: { value: '10' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scenes: [expect.objectContaining({ effects: { max: { hp: 10 } } })],
      }),
      '0:effects.max.hp',
    );

    const populatedScene = { ...scene, effects: { max: { hp: 10 } } };
    rerender(
      <SceneEditor
        scenario={{ ...scenario, scenes: [populatedScene] }}
        scene={populatedScene}
        onChange={onChange}
        onRenamed={vi.fn()}
        onDelete={vi.fn()}
        onAddScene={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('HP の最大値・初期値'), { target: { value: '' } });
    expect(onChange.mock.lastCall?.[0].scenes[0]?.effects).toBeUndefined();
    expect(onChange.mock.lastCall?.[1]).toBe('0:effects.max.hp');
  });
});
