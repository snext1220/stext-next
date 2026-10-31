// @vitest-environment jsdom
import { emptyGlobalState, newGameState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroPanel, ItemsPanel, MagicPanel, RecordPanel } from './Panels.js';

afterEach(cleanup);

const scenario: Scenario = {
  format: 'stext/2',
  meta: { title: 'デモ', labels: { free1: '所持金' } },
  items: [{ id: 'i01', name: 'こいし', text: 'ただの石' }],
  flags: [
    { id: 'f01', text: '扉を調べた。' },
    { id: 'f02', text: '秘密', hidden: true },
  ],
  params: [],
  enemies: [],
  results: [
    { id: 'r01', name: 'はじまり' },
    { id: 'r02', name: 'おわり' },
  ],
  groups: [],
  licence: [],
  scenes: [],
};

function state() {
  const s = newGameState(() => 0);
  s.items = ['i01'];
  s.flags = ['f01', 'f02'];
  s.chara.free1 = 50;
  s.stars = [0, 0, 0, 1, 0, 1, 0];
  return s;
}

describe('panels', () => {
  it('shows the character with the scenario labels', () => {
    const { getByText } = render(<HeroPanel scenario={scenario} state={state()} />);
    expect(getByText('所持金')).toBeTruthy();
    expect(getByText('50')).toBeTruthy();
  });

  it('lists items and only the visible flags', () => {
    const { getByText, queryByText } = render(<ItemsPanel scenario={scenario} state={state()} />);
    expect(getByText('こいし')).toBeTruthy();
    expect(getByText('扉を調べた。')).toBeTruthy();
    expect(queryByText('秘密')).toBeNull();
  });

  it('casts only the magic the stars allow', () => {
    const onCast = vi.fn();
    const { getAllByRole } = render(<MagicPanel state={state()} onCast={onCast} />);
    const buttons = getAllByRole('button', { name: '唱える' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(onCast).toHaveBeenCalledWith('HEAL');
  });

  it('hides the names of results not yet unlocked', () => {
    const global = { ...emptyGlobalState(), results: { demo: ['r01'] } };
    const { getByText, getAllByText } = render(
      <RecordPanel scenario={scenario} scenarioId="demo" global={global} history={[]} />,
    );
    expect(getByText('1 / 2')).toBeTruthy();
    expect(getByText('はじまり')).toBeTruthy();
    expect(getAllByText('？？？')).toHaveLength(1);
  });
});
