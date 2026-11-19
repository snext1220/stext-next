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

function EditableChoiceSceneEditor({ initial }: { initial: DraftScenario }) {
  const [current, setCurrent] = useState(initial);
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
  it('sets one selected achievement and still allows manual editing and clearing', () => {
    const initial: DraftScenario = {
      ...scenario,
      results: [
        { id: 'r01', name: '冒険者', text: '冒険を始めた' },
        { id: 'r02', name: '達成' },
        { id: '', name: '作成途中' },
      ],
      scenes: [{ ...scenario.scenes[0]!, effects: { result: 'r02', hp: 5 } }],
    };
    const onChange = vi.fn();
    const scene = initial.scenes[0]!;
    const { unmount } = render(
      <SceneEditor
        scenario={initial}
        scene={scene}
        onChange={onChange}
        onRenamed={vi.fn()}
        onDelete={vi.fn()}
        onAddScene={vi.fn()}
      />,
    );
    const picker = screen.getByRole<HTMLSelectElement>('combobox', { name: '実績を効果に設定' });
    expect(screen.getByRole('option', { name: '冒険者（冒険を始めた）（r01）' })).toBeTruthy();
    expect(picker.options).toHaveLength(3);
    fireEvent.change(picker, { target: { value: 'r01' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scenes: [expect.objectContaining({ effects: { result: 'r01', hp: 5 } })],
      }),
      '0:effects.result',
    );
    unmount();

    render(<EditableChoiceSceneEditor initial={initial} />);
    const input = screen.getByLabelText<HTMLInputElement>('実績');
    fireEvent.change(screen.getByRole('combobox', { name: '実績を効果に設定' }), {
      target: { value: 'r01' },
    });
    expect(input.value).toBe('r01');
    fireEvent.change(input, { target: { value: 'r99' } });
    expect(input.value).toBe('r99');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('disables the achievement picker when no achievement ID is defined', () => {
    render(
      <EditableChoiceSceneEditor
        initial={{ ...scenario, results: [{ id: '', name: '作成途中' }] }}
      />,
    );
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: '実績を効果に設定' }).disabled,
    ).toBe(true);
  });

  it('inserts basic item, flag and parameter effects without replacing existing effects', () => {
    const effectScenario: DraftScenario = {
      ...scenario,
      items: [{ id: 'i01', name: '鍵', text: '古い鍵' }],
      flags: [{ id: 'f01', text: '扉を開いた' }],
      params: [{ id: 'p01', text: '得点' }],
      scenes: [
        {
          ...scenario.scenes[0]!,
          effects: { items: ['-i02'], flags: ['-f02'], params: ['p02:@5'] },
        },
      ],
    };
    render(<EditableChoiceSceneEditor initial={effectScenario} />);

    for (const [label, selected, expected] of [
      ['アイテム', 'i01', '-i02, i01'],
      ['フラグ', 'f01', '-f02, f01'],
      ['パラメーター', 'p01:1', 'p02:@5, p01:1'],
    ] as const) {
      const picker = screen.getByRole<HTMLSelectElement>('combobox', {
        name: `${label}を効果に追加`,
      });
      fireEvent.change(picker, { target: { value: selected } });
      expect(screen.getByLabelText<HTMLInputElement>(label).value).toBe(expected);
      expect(picker.value).toBe('');
    }

    expect(screen.getByRole('option', { name: 'p01（得点）（1増やす）' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('パラメーター'), {
      target: { value: 'p01:@10' },
    });
    expect(screen.getByLabelText<HTMLInputElement>('パラメーター').value).toBe('p01:@10');
  });

  it('disables effect pickers when definitions have no ID', () => {
    const draft: DraftScenario = {
      ...scenario,
      items: [{ id: '', name: '作成途中' }],
      flags: [{ id: '', text: '作成途中' }],
      params: [{ id: '', text: '作成途中' }],
    };
    render(<EditableChoiceSceneEditor initial={draft} />);

    for (const label of ['アイテム', 'フラグ', 'パラメーター']) {
      expect(
        screen.getByRole<HTMLSelectElement>('combobox', { name: `${label}を効果に追加` }).disabled,
      ).toBe(true);
    }
  });

  it('inserts selected enemy IDs while preserving existing and repeated enemies', () => {
    const enemyScenario: DraftScenario = {
      ...scenario,
      enemies: [{ id: 'm01', name: '森の狼', text: '森に住む狼' }],
      scenes: [{ ...scenario.scenes[0]!, enemies: ['m02'] }],
    };
    render(<EditableChoiceSceneEditor initial={enemyScenario} />);

    const enemyInput = screen.getByLabelText<HTMLInputElement>('敵');
    const enemyPicker = screen.getByRole<HTMLSelectElement>('combobox', { name: '敵を差し込む' });
    expect(Array.from(enemyPicker.options).map((option) => option.value)).toContain('m01');
    expect(screen.queryByText('定義済み：m01')).toBeNull();

    fireEvent.change(enemyPicker, { target: { value: 'm01' } });
    expect(enemyInput.value).toBe('m02, m01');

    fireEvent.change(enemyPicker, { target: { value: 'm01' } });
    expect(enemyInput.value).toBe('m02, m01, m01');
  });

  it('shows guidance when no enemies are defined', () => {
    render(<EditableChoiceSceneEditor initial={scenario} />);
    expect(screen.getByText('敵は「定義」の「敵」で作ります')).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '敵を差し込む' }).disabled).toBe(
      true,
    );
  });

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

describe('SceneEditor choice conditions', () => {
  it('offers the supported condition forms and inserts a valid expression', () => {
    const choice = { label: '次へ', to: ['0'], if: 'f01' };
    const scene = { ...scenario.scenes[0]!, choices: [choice] };
    const conditionScenario: Scenario = {
      ...scenario,
      params: [{ id: 'p01', text: 'ポイント' }],
      results: [{ id: 'r01', name: '達成' }],
      scenes: [scene],
    };
    render(<EditableChoiceSceneEditor initial={conditionScenario} />);

    const optionValues = (name: string) =>
      Array.from(screen.getByRole<HTMLSelectElement>('combobox', { name }).options).map(
        (option) => option.value,
      );
    expect(optionValues('実績を差し込む')).toContain('r01:settings');
    expect(optionValues('パラメーターを差し込む')).toEqual(
      expect.arrayContaining(['p01:@0', 'p01:0', 'p01:値']),
    );
    expect(optionValues('星を差し込む')).toEqual(expect.arrayContaining(['s10', 's1:0:0:0:0:0:0']));
    expect(optionValues('能力値を差し込む')).toEqual(
      expect.arrayContaining([
        'oHP10',
        'oHP10+',
        'oHP10-',
        'oHP11-',
        'oHP10&oHP11-',
        'oFREEII10',
        'oFREEIII10',
      ]),
    );
    expect(optionValues('基本情報を差し込む')).toEqual(
      expect.arrayContaining(['xFROZEN', 'xSTONE', 'xCURSE', 'xFORGET']),
    );
    expect(optionValues('経過シーン数を差し込む')).toContain('e30');
    expect(optionValues('その他を差し込む')).toContain('q01');

    fireEvent.change(screen.getByRole('combobox', { name: '能力値を差し込む' }), {
      target: { value: 'oFREEII10&oFREEII11-' },
    });
    const conditionInput = screen.getByLabelText<HTMLInputElement>('表示条件');
    expect(conditionInput.value).toBe('f01&oFREEII10&oFREEII11-');
    expect(screen.getByText('✓ 条件として読めます')).toBeTruthy();

    fireEvent.change(conditionInput, { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '経過シーン数を差し込む' }), {
      target: { value: 'e30' },
    });
    expect(conditionInput.value).toBe('e30');
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
