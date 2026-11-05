// @vitest-environment jsdom
import { emptyGlobalState, GLOBAL_SAVE_KEY } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestPlay } from './TestPlay.js';

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

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('TestPlay', () => {
  it('uses saved player achievements without persisting preview progress', async () => {
    const savedGlobal = {
      ...emptyGlobalState(),
      results: { past: ['r01', 'r02'] },
    };
    const saved = JSON.stringify(savedGlobal);
    localStorage.setItem(GLOBAL_SAVE_KEY, saved);

    render(
      <TestPlay
        scenario={scenario}
        startScene={undefined}
        resourceUrls={{}}
        scenarioResultTotals={new Map([['past', 4]])}
        scenarioIndexError={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));

    await waitFor(() => expect(screen.getByText('2:50')).toBeTruthy());
    expect(localStorage.getItem(GLOBAL_SAVE_KEY)).toBe(saved);
  });

  it('uses the selected items, flags, parameters, and stars when starting a preview', () => {
    render(
      <TestPlay
        scenario={stateScenario}
        startScene={undefined}
        resourceUrls={{}}
        scenarioResultTotals={new Map()}
        scenarioIndexError={null}
      />,
    );
    fireEvent.click(screen.getByLabelText('試遊アイテム 鍵'));
    fireEvent.click(screen.getByLabelText('試遊フラグ f01'));
    fireEvent.change(screen.getByLabelText('試遊パラメーター p01'), {
      target: { value: '7' },
    });
    fireEvent.change(screen.getByLabelText('試遊の星 月'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));

    expect(screen.getByRole('button', { name: /条件を満たした分岐/ })).toBeTruthy();
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
        scenario={summaryScenario}
        startScene={undefined}
        resourceUrls={{ 'chara/male_adult_fighter.png': 'blob:custom-portrait' }}
        scenarioResultTotals={new Map()}
        scenarioIndexError={null}
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
    render(
      <TestPlay
        scenario={randomScenario}
        startScene={undefined}
        resourceUrls={{}}
        scenarioResultTotals={new Map()}
        scenarioIndexError={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /運試し/ }));
    expect(screen.getByText('分岐2')).toBeTruthy();

    random.mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: '最初から試遊' }));
    fireEvent.click(screen.getByRole('button', { name: /運試し/ }));
    expect(screen.getByText('分岐2')).toBeTruthy();
  });
});
