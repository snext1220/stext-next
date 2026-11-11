// @vitest-environment jsdom
import type { DraftScenario, Scenario } from '@stext/schema';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function EditableSceneEditor({ text }: { text: string }) {
  const [current, setCurrent] = useState<DraftScenario>({
    ...scenario,
    scenes: [{ ...scenario.scenes[0]!, text }],
  });
  const scene = current.scenes[0]!;
  return (
    <SceneEditor
      scenario={current}
      scene={scene}
      onChange={setCurrent}
      onRenamed={vi.fn()}
      onDelete={vi.fn()}
      onAddScene={vi.fn()}
    />
  );
}

describe('SceneEditor settings', () => {
  it('distinguishes restoring the normal BGM from clearing a scene override', () => {
    const onChange = vi.fn();
    const scene = scenario.scenes[0]!;
    const props = {
      scenario,
      scene,
      onChange,
      onRenamed: vi.fn(),
      onDelete: vi.fn(),
      onAddScene: vi.fn(),
    };
    const { rerender } = render(<SceneEditor {...props} />);
    const restore = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'シーンBGMを通常曲に戻す',
    });

    fireEvent.click(restore);
    expect(onChange.mock.lastCall?.[0].scenes[0]?.bgm).toBe('');

    const restoredScene = { ...scene, bgm: '' };
    rerender(
      <SceneEditor
        {...props}
        scenario={{ ...scenario, scenes: [restoredScene] }}
        scene={restoredScene}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'シーンBGMを通常曲に戻す' }));
    expect(onChange.mock.lastCall?.[0].scenes[0]?.bgm).toBeUndefined();
  });

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

describe('SceneEditor Markdown toolbar', () => {
  it('prefixes selected lines without changing an unselected next line', async () => {
    render(
      <EditableSceneEditor
        text={`森
道
帰る`}
      />,
    );
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('本文');
    textarea.focus();
    textarea.setSelectionRange(0, 4);

    fireEvent.click(screen.getByRole('button', { name: '箇条書き' }));

    await waitFor(() => {
      expect(textarea.value).toBe(`- 森
- 道
帰る`);
      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe(2);
      expect(textarea.selectionEnd).toBe(8);
    });
  });

  it('wraps selected text in italics and places an empty insertion between markers', async () => {
    const { unmount } = render(<EditableSceneEditor text="abcdef" />);
    let textarea = screen.getByLabelText<HTMLTextAreaElement>('本文');
    textarea.setSelectionRange(1, 4);
    fireEvent.click(screen.getByRole('button', { name: '斜体' }));

    await waitFor(() => {
      expect(textarea.value).toBe('a*bcd*ef');
      expect(textarea.selectionStart).toBe(2);
      expect(textarea.selectionEnd).toBe(5);
    });

    unmount();
    render(<EditableSceneEditor text="abcdef" />);
    textarea = screen.getByLabelText<HTMLTextAreaElement>('本文');
    textarea.setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole('button', { name: '斜体' }));

    await waitFor(() => {
      expect(textarea.value).toBe('abc**def');
      expect(textarea.selectionStart).toBe(4);
      expect(textarea.selectionEnd).toBe(4);
    });
  });

  it('creates a link and selects placeholder text when there is no selection', async () => {
    render(<EditableSceneEditor text="前後" />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('本文');
    textarea.setSelectionRange(1, 1);

    fireEvent.click(screen.getByRole('button', { name: 'リンク' }));

    await waitFor(() => {
      expect(textarea.value).toBe('前[リンク文字列](URL)後');
      expect(textarea.selectionStart).toBe(2);
      expect(textarea.selectionEnd).toBe(8);
    });
  });

  it('uses selected text as link text and keeps macro insertion available', async () => {
    const { unmount } = render(<EditableSceneEditor text="森の道" />);
    let textarea = screen.getByLabelText<HTMLTextAreaElement>('本文');
    textarea.setSelectionRange(0, 3);

    fireEvent.click(screen.getByRole('button', { name: 'リンク' }));

    await waitFor(() => {
      expect(textarea.value).toBe('[森の道](URL)');
      expect(textarea.selectionStart).toBe(1);
      expect(textarea.selectionEnd).toBe(4);
    });

    unmount();
    render(<EditableSceneEditor text="abc" />);
    textarea = screen.getByLabelText<HTMLTextAreaElement>('本文');
    textarea.setSelectionRange(1, 2);

    fireEvent.click(screen.getByRole('button', { name: '名前' }));

    await waitFor(() => {
      expect(textarea.value).toBe('a${name}bc');
      expect(textarea.selectionStart).toBe(8);
      expect(textarea.selectionEnd).toBe(9);
    });
  });
});
