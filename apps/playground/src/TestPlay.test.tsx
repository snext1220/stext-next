// @vitest-environment jsdom
import { emptyGlobalState, GLOBAL_SAVE_KEY } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPreviewStartOverrides, TestPlay, type PreviewRun } from './TestPlay.js';

const scenario: Scenario = {
  format: 'stext/2',
  meta: { id: 'preview', title: 'Preview' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [{ id: '0', text: '${result?past}:${result_rate?past}', choices: [] }],
};

const stateScenario: Scenario = {
  format: 'stext/2',
  meta: { id: 'state-preview', title: 'State preview' },
  items: [{ id: 'i01', name: '鍵' }],
  flags: [{ id: 'f01', text: '扉を調べた' }],
  params: [{ id: 'p01', text: '暗号', initial: 0 }],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [
    {
      id: '0',
      text: '開始',
      choices: [
        {
          label: '条件を満たした分岐',
          to: ['1'],
          if: {
            all: [{ item: 'i01' }, { flag: 'f01' }, { param: 'p01', eq: 7 }, { stars: [1] }],
          },
        },
      ],
    },
    { id: '1', text: '成功', choices: [] },
  ],
};

function playProps(scenario: Scenario) {
  return {
    scenario,
    startScene: undefined,
    onSceneChange: vi.fn(),
    startOverrides: emptyPreviewStartOverrides(scenario),
    onStartOverridesChange: vi.fn(),
    onClearStartOverrides: vi.fn(),
    resourceUrls: {},
    scenarioResultTotals: new Map<string, number>(),
    scenarioIndexError: null,
    initialRun: null,
    onRunChange: vi.fn(),
  };
}

const progressScenario: Scenario = {
  ...stateScenario,
  scenes: [
    { id: '0', text: '開始', choices: [{ label: '次へ', to: ['1'] }] },
    {
      id: '1',
      text: '到着',
      bgm: 'forest',
      effects: {
        items: ['i01'],
        flags: ['f01'],
        params: ['p01:1'],
        stars: [2, 0, 0, 0, 0, 0, 0],
        hp: -1,
      },
      choices: [],
    },
    { id: '2', text: '寄り道', choices: [] },
    { id: '3', text: '街', bgm: '@town01', choices: [] },
    { id: '4', text: '終わり', end: 'happy', choices: [] },
  ],
};

function RetainedPreview({
  startScene,
  onRunChange = () => {},
  playable = progressScenario,
}: {
  startScene?: string;
  onRunChange?: (run: PreviewRun) => void;
  playable?: Scenario;
}) {
  const [run, setRun] = useState<PreviewRun | null>(null);
  const [overrides, setOverrides] = useState(() => emptyPreviewStartOverrides(playable));
  const [visible, setVisible] = useState(true);
  const [callbacks] = useState(() => playProps(progressScenario));
  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        試遊タブ切り替え
      </button>
      {visible && (
        <TestPlay
          {...callbacks}
          scenario={playable}
          initialRun={run}
          onRunChange={(next) => {
            setRun(next);
            onRunChange(next);
          }}
          startScene={startScene}
          startOverrides={overrides}
          onStartOverridesChange={setOverrides}
          onClearStartOverrides={() => setOverrides(emptyPreviewStartOverrides(playable))}
        />
      )}
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TestPlay', () => {
  it('offers referenced and registered BGM without effects or duplicate resource paths', () => {
    const configuredScenario: Scenario = {
      ...progressScenario,
      meta: { ...progressScenario.meta, bgm: { main: '@field01' } },
    };
    const { rerender } = render(
      <TestPlay
        {...playProps(configuredScenario)}
        resourceUrls={{
          'bgm/forest.mp3': 'blob:forest',
          'bgm/unused.ogg': 'blob:unused',
          'bgm/se/click.mp3': 'blob:effect',
          'capture/image.png': 'blob:image',
        }}
      />,
    );
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: '試遊の開始BGM' });
    expect(Array.from(select.options, (option) => option.value)).toEqual([
      '',
      '@none',
      '@field01',
      'forest',
      '@town01',
      'unused.ogg',
    ]);
    rerender(
      <TestPlay
        {...playProps(configuredScenario)}
        startOverrides={{ ...emptyPreviewStartOverrides(configuredScenario), bgm: 'previous' }}
      />,
    );
    expect(select.value).toBe('previous');
    expect(Array.from(select.options, (option) => option.value)).not.toContain('unused.ogg');
  });

  it('restores all progress and BGM without repeating scene effects or saving it', () => {
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    const { container } = render(<RetainedPreview startScene="2" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    const run = onRunChange.mock.lastCall![0];
    expect(run.state).toMatchObject({
      scene: '1',
      ellapsed_scene: 2,
      items: ['i01'],
      flags: ['f01'],
      params: { p01: 1 },
      stars: [2, 0, 0, 0, 0, 0, 0],
      bgm: 'forest',
    });
    onRunChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    expect(screen.getByText('到着')).toBeTruthy();
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
    expect(onRunChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>('試遊アイテム 鍵').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('試遊フラグ f01').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('1');
    expect(screen.getByLabelText<HTMLInputElement>('試遊の星 月').value).toBe('2');
    expect(screen.getByLabelText<HTMLInputElement>('試遊の開始BGM').value).toBe('forest');
    fireEvent.click(screen.getByRole('button', { name: '状態をクリア' }));
    expect(screen.getByLabelText<HTMLInputElement>('試遊の開始BGM').value).toBe('');
    expect(screen.getByText('到着')).toBeTruthy();
    expect(onRunChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    expect(screen.getByLabelText<HTMLSelectElement>('試遊の開始BGM').value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '現在の状態で§2へ移動' }));
    expect(onRunChange.mock.lastCall![0]).toEqual({
      global: run.global,
      log: run.log,
      state: { ...run.state, scene: '2', ellapsed_scene: 3 },
      previous: { state: run.state, global: run.global, log: run.log },
    });
    expect(localStorage.getItem(GLOBAL_SAVE_KEY)).toBeNull();
    expect(localStorage.getItem('state-preview')).toBeNull();
  });

  it('automatically reflects ending effects and restores the entire pre-ending snapshot once', () => {
    const playable: Scenario = {
      ...progressScenario,
      results: [{ id: 'r01', name: '失敗', level: 1 }],
      scenes: [
        ...progressScenario.scenes.map((scene) =>
          scene.id === '1'
            ? {
                ...scene,
                choices: [
                  { label: '危険な道', to: ['5'] },
                  { label: '安全な道', to: ['2'] },
                ],
              }
            : scene,
        ),
        {
          id: '5',
          text: '失敗した',
          end: 'bad',
          effects: {
            items: ['-i01'],
            params: ['p01:3'],
            hp: -5,
            stars: [-1, 0, 0, 0, 0, 0, 0],
            result: 'r01',
          },
          choices: [],
        },
      ],
    };
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    const { container } = render(<RetainedPreview playable={playable} onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    expect(screen.queryByRole('button', { name: '直前のシーンからやり直す' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    const beforeEnding = onRunChange.mock.lastCall![0];
    fireEvent.click(screen.getByRole('button', { name: /危険な道/ }));
    expect(onRunChange.mock.lastCall![0].state.isEnded).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('試遊アイテム 鍵').checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('4');
    expect(screen.getByLabelText<HTMLInputElement>('試遊の星 月').value).toBe('1');
    expect(screen.getByLabelText<HTMLSelectElement>('試遊の開始BGM').value).toBe('bad');
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    fireEvent.click(screen.getByRole('button', { name: '直前のシーンからやり直す' }));
    const restored = onRunChange.mock.lastCall![0];
    expect(restored).toEqual({
      state: beforeEnding.state,
      global: beforeEnding.global,
      log: beforeEnding.log,
    });
    expect(screen.getByLabelText<HTMLInputElement>('試遊アイテム 鍵').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('1');
    expect(screen.getByLabelText<HTMLInputElement>('試遊の星 月').value).toBe('2');
    expect(screen.getByLabelText<HTMLSelectElement>('試遊の開始BGM').value).toBe('forest');
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
    expect(screen.queryByRole('button', { name: '直前のシーンからやり直す' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /危険な道/ }));
    fireEvent.click(screen.getByRole('button', { name: '直前のシーンからやり直す' }));
    expect(onRunChange.mock.lastCall![0]).toEqual(restored);
    fireEvent.click(screen.getByRole('button', { name: /安全な道/ }));
    expect(screen.getByText('寄り道')).toBeTruthy();
    expect(onRunChange.mock.lastCall![0].state.isEnded).toBe(false);
    expect(localStorage.getItem(GLOBAL_SAVE_KEY)).toBeNull();
  });

  it('uses manually edited start settings and resets retry history on a fresh start', () => {
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    render(<RetainedPreview onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    fireEvent.change(screen.getByLabelText('試遊パラメーター p01'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('7');
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    expect(onRunChange.mock.lastCall![0].state.params.p01).toBe(7);
    expect(screen.queryByRole('button', { name: '直前のシーンからやり直す' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '状態をクリア' }));
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    expect(onRunChange.mock.lastCall![0].state).toMatchObject({
      items: [],
      flags: [],
      params: {},
      bgm: '',
    });
  });

  it('does not overwrite manual settings or retry history after a rejected choice', () => {
    const playable: Scenario = {
      ...progressScenario,
      scenes: progressScenario.scenes.map((scene) =>
        scene.id === '1'
          ? { ...scene, choices: [{ label: '存在しない道', to: ['missing'] }] }
          : scene,
      ),
    };
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    render(<RetainedPreview playable={playable} onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    const start = onRunChange.mock.lastCall![0];
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    fireEvent.change(screen.getByLabelText('試遊パラメーター p01'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: /存在しない道/ }));
    expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('7');
    expect(onRunChange.mock.lastCall![0].state.scene).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: '直前のシーンからやり直す' }));
    expect(onRunChange.mock.lastCall![0]).toEqual(start);
    expect(screen.getByLabelText<HTMLInputElement>('試遊パラメーター p01').value).toBe('0');
  });

  it('reports a deleted previous scene and preserves the current progress', () => {
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    const { rerender } = render(<RetainedPreview startScene="2" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    fireEvent.click(screen.getByRole('button', { name: '現在の状態で§2へ移動' }));
    const current = onRunChange.mock.lastCall![0];
    rerender(
      <RetainedPreview
        startScene="2"
        onRunChange={onRunChange}
        playable={{
          ...progressScenario,
          scenes: progressScenario.scenes.filter((scene) => scene.id !== '1'),
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '直前のシーンからやり直す' }));
    expect(screen.getByRole('alert').textContent).toContain('直前のシーン「1」がない');
    expect(screen.getByText('寄り道')).toBeTruthy();
    expect(onRunChange.mock.lastCall![0]).toBe(current);
  });

  it('can retry scene zero after starting directly at an intermediate scene', () => {
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    render(<RetainedPreview startScene="1" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '§1 から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: '直前のシーンからやり直す' }));
    expect(onRunChange.mock.lastCall![0].state).toMatchObject({
      scene: '0',
      ellapsed_scene: 1,
      items: [],
      flags: [],
      bgm: '',
    });
    expect(screen.queryByRole('button', { name: '直前のシーンからやり直す' })).toBeNull();
  });

  it('keeps character and BGM when moving with current state and honors destination BGM', () => {
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    const { container, rerender } = render(<RetainedPreview onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    const previous = onRunChange.mock.lastCall![0];
    rerender(<RetainedPreview startScene="2" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '現在の状態で§2へ移動' }));
    const next = onRunChange.mock.lastCall![0];
    expect(next.state).toEqual({ ...previous.state, scene: '2', ellapsed_scene: 3 });
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
    rerender(<RetainedPreview startScene="3" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '現在の状態で§3へ移動' }));
    expect(onRunChange.mock.lastCall![0].state.bgm).toBe('@town01');
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/town01.mp3');
    rerender(<RetainedPreview startScene="4" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '現在の状態で§4へ移動' }));
    rerender(<RetainedPreview startScene="2" onRunChange={onRunChange} />);
    expect(screen.queryByRole('button', { name: '現在の状態で§2へ移動' })).toBeNull();
  });

  it('starts fresh using the configured BGM, including silence, and applies scene BGM', () => {
    const { container, rerender } = render(<RetainedPreview startScene="2" />);
    fireEvent.change(screen.getByLabelText('試遊の開始BGM'), {
      target: { value: 'forest' },
    });
    fireEvent.click(screen.getByRole('button', { name: '§2 から試遊' }));
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
    fireEvent.change(screen.getByLabelText('試遊の開始BGM'), {
      target: { value: '@none' },
    });
    fireEvent.click(screen.getByRole('button', { name: '§2 から試遊' }));
    expect(container.querySelector('audio')).toBeNull();
    rerender(<RetainedPreview startScene="1" />);
    fireEvent.click(screen.getByRole('button', { name: '§1 から試遊' }));
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/forest.mp3');
    fireEvent.click(screen.getByRole('button', { name: '状態をクリア' }));
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    expect(container.querySelector('audio')?.getAttribute('src')).toContain('/bgm/main.mp3');
  });

  it('reports invalid state-preserving destinations without losing the current run', () => {
    const onRunChange = vi.fn<(run: PreviewRun) => void>();
    const { rerender } = render(<RetainedPreview onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    const previous = onRunChange.mock.lastCall![0];
    rerender(<RetainedPreview startScene="missing" onRunChange={onRunChange} />);
    fireEvent.click(screen.getByRole('button', { name: '現在の状態で§missingへ移動' }));
    expect(screen.getByRole('alert').textContent).toContain('missing');
    expect(screen.getByText('開始')).toBeTruthy();
    expect(onRunChange.mock.lastCall![0]).toBe(previous);
  });

  it('uses saved player achievements without persisting preview progress', async () => {
    const savedGlobal = {
      ...emptyGlobalState(),
      results: { past: ['r01', 'r02'] },
    };
    const saved = JSON.stringify(savedGlobal);
    localStorage.setItem(GLOBAL_SAVE_KEY, saved);

    render(<TestPlay {...playProps(scenario)} scenarioResultTotals={new Map([['past', 4]])} />);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));

    await waitFor(() => expect(screen.getByText('2:50')).toBeTruthy());
    expect(localStorage.getItem(GLOBAL_SAVE_KEY)).toBe(saved);
  });

  it('uses the selected items, flags, parameters, and stars when starting a preview', () => {
    function StatefulTestPlay() {
      const [startOverrides, setStartOverrides] = useState(() =>
        emptyPreviewStartOverrides(stateScenario),
      );
      const [callbacks] = useState(() => playProps(stateScenario));
      return (
        <TestPlay
          {...callbacks}
          startOverrides={startOverrides}
          onStartOverridesChange={setStartOverrides}
          onClearStartOverrides={() => setStartOverrides(emptyPreviewStartOverrides(stateScenario))}
        />
      );
    }
    render(<StatefulTestPlay />);
    fireEvent.click(screen.getByLabelText('試遊アイテム 鍵'));
    fireEvent.click(screen.getByLabelText('試遊フラグ f01'));
    fireEvent.change(screen.getByLabelText('試遊パラメーター p01'), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByLabelText('試遊の星 月'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));

    expect(screen.getByRole('button', { name: /条件を満たした分岐/ })).toBeTruthy();
  });

  it('keeps start overrides across preview unmounts and clears them on request', () => {
    function StatefulPreview() {
      const [startOverrides, setStartOverrides] = useState(() =>
        emptyPreviewStartOverrides(stateScenario),
      );
      const [visible, setVisible] = useState(true);
      const [callbacks] = useState(() => playProps(stateScenario));
      return (
        <>
          <button type="button" onClick={() => setVisible((current) => !current)}>
            試遊タブ切り替え
          </button>
          {visible && (
            <TestPlay
              {...callbacks}
              startOverrides={startOverrides}
              onStartOverridesChange={setStartOverrides}
              onClearStartOverrides={() =>
                setStartOverrides(emptyPreviewStartOverrides(stateScenario))
              }
            />
          )}
        </>
      );
    }

    render(<StatefulPreview />);
    fireEvent.click(screen.getByLabelText('試遊アイテム 鍵'));
    fireEvent.change(screen.getByLabelText('試遊パラメーター p01'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));
    fireEvent.click(screen.getByRole('button', { name: '試遊タブ切り替え' }));

    expect((screen.getByLabelText('試遊アイテム 鍵') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('試遊パラメーター p01') as HTMLInputElement).value).toBe('7');

    fireEvent.click(screen.getByText('試遊の開始状態を指定'));
    fireEvent.click(screen.getByRole('button', { name: '状態をクリア' }));

    expect((screen.getByLabelText('試遊アイテム 鍵') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('試遊パラメーター p01') as HTMLInputElement).value).toBe('0');
  });

  it('shows scene summaries and custom character images in the preview', () => {
    const summaryScenario: Scenario = {
      ...scenario,
      meta: {
        ...scenario.meta,
        showSummary: true,
        imageSet: 'custom',
        constraint: { race: ['FIGHTER'], sex: 'MALE', age: ['ADULT'] },
      },
      scenes: [{ id: '0', summary: '冒険の始まり', text: '開始', choices: [] }],
    };
    const { container } = render(
      <TestPlay
        {...playProps(summaryScenario)}
        resourceUrls={{ 'chara/male_adult_fighter.png': 'blob:custom-portrait' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));

    expect(screen.getByText('冒険の始まり')).toBeTruthy();
    expect(container.querySelector('img.portrait')?.getAttribute('src')).toBe(
      'blob:custom-portrait',
    );
  });

  it('keeps random destinations in cookies between preview runs', () => {
    const randomScenario: Scenario = {
      ...scenario,
      scenes: [
        {
          id: '0',
          text: '開始',
          choices: [{ label: '運試し', to: ['1', '2'], randomCacheDays: 7 }],
        },
        { id: '1', text: '分岐1', choices: [] },
        { id: '2', text: '分岐2', choices: [] },
      ],
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(<TestPlay {...playProps(randomScenario)} />);

    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /運試し/ }));
    expect(screen.getByText('分岐2')).toBeTruthy();

    random.mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /運試し/ }));
    expect(screen.getByText('分岐2')).toBeTruthy();
  });

  it('reports the current scene while playing', async () => {
    const onSceneChange = vi.fn();
    const playableScenario: Scenario = {
      ...stateScenario,
      scenes: [
        { id: '0', text: '開始', choices: [{ label: '次へ', to: ['1'] }] },
        { id: '1', text: '到着', choices: [] },
      ],
    };
    render(<TestPlay {...playProps(playableScenario)} onSceneChange={onSceneChange} />);

    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    await waitFor(() => expect(onSceneChange).toHaveBeenLastCalledWith('0'));

    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    await waitFor(() => expect(onSceneChange).toHaveBeenLastCalledWith('1'));
  });

  it('scrolls to the top after moving to the next scene', () => {
    const scrollTo = vi.mocked(window.scrollTo);
    const playableScenario: Scenario = {
      ...stateScenario,
      scenes: [
        { id: '0', text: '開始', choices: [{ label: '次へ', to: ['1'] }] },
        { id: '1', text: '到着', choices: [] },
      ],
    };
    const { container } = render(
      <div className="pg-side-body">
        <TestPlay {...playProps(playableScenario)} />
      </div>,
    );
    const panel = container.querySelector<HTMLElement>('.pg-side-body')!;
    panel.scrollTop = 120;

    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(panel.scrollTop).toBe(0);
  });
});
