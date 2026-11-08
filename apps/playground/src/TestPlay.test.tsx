// @vitest-environment jsdom
import { emptyGlobalState, GLOBAL_SAVE_KEY } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPreviewStartOverrides, TestPlay } from './TestPlay.js';

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
  };
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
