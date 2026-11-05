// @vitest-environment jsdom
import { emptyGlobalState, GLOBAL_SAVE_KEY } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
