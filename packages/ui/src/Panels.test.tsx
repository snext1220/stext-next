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
    { id: 'r01', name: 'はじまり', text: '冒険を始めた', level: 3 },
    { id: 'r02', name: 'おわり', text: '冒険を終えた', level: 5 },
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

  it('shows the applied bonus item with its effect', () => {
    const s = state();
    s.bonus = 'gi23';
    const { getByText } = render(<HeroPanel scenario={scenario} state={s} />);
    expect(getByText('D・スレイヤー')).toBeTruthy();
    expect(getByText('すべての星を1個所有した状態で冒険を開始する')).toBeTruthy();
  });

  it('shows the portrait and falls back to the race sigil when it cannot be loaded', () => {
    const { container } = render(
      <HeroPanel scenario={scenario} state={state()} portraitUrl="/chara.png" />,
    );
    const img = container.querySelector('img.portrait')!;
    expect(img.getAttribute('src')).toBe('/chara.png');
    fireEvent.error(img);
    expect(container.querySelector('img.portrait')).toBeNull();
    expect(container.querySelector('.sigil')).toBeTruthy();
  });

  it('lists items and only the visible flags', () => {
    const { getByText, queryByText } = render(<ItemsPanel scenario={scenario} state={state()} />);
    expect(getByText('こいし')).toBeTruthy();
    expect(getByText('扉を調べた。')).toBeTruthy();
    expect(queryByText('秘密')).toBeNull();
  });

  it('offers to use the items that have a target', () => {
    const onUse = vi.fn();
    const sc = {
      ...scenario,
      items: [...scenario.items, { id: 'i02', name: '薬草', target: 'hp', effect: '10' }],
    };
    const s = { ...state(), items: ['i01', 'i02'] };
    const { getAllByRole, getByText } = render(
      <ItemsPanel scenario={sc} state={s} onUse={onUse} />,
    );
    expect(getAllByRole('button', { name: /を使う$/ })).toHaveLength(1);
    expect(getByText(/★/)).toBeTruthy();
    fireEvent.click(getAllByRole('button', { name: '薬草を使う' })[0]!);
    expect(onUse).toHaveBeenCalledWith('i02');
  });

  it('casts only the magic the stars allow', () => {
    const onCast = vi.fn();
    const { getAllByRole } = render(<MagicPanel state={state()} onCast={onCast} />);
    const buttons = getAllByRole('button', { name: '唱える' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(onCast).toHaveBeenCalledWith('HEAL');
  });

  it('shows the reasons and levels of unlocked results and hides the locked ones', () => {
    const global = { ...emptyGlobalState(), results: { demo: ['r01'] } };
    const { getByText, getAllByText, getByRole, queryByText } = render(
      <RecordPanel
        scenario={scenario}
        scenarioId="demo"
        global={global}
        history={[]}
        trophyUrl={(level) => `/trophy${level}.png`}
      />,
    );
    expect(getByText('1 / 2')).toBeTruthy();
    expect(getByText('はじまり', { exact: false })).toBeTruthy();
    expect(getByText('Lv.3')).toBeTruthy();
    expect(getByText('冒険を始めた')).toBeTruthy();
    expect(getByRole('img', { name: 'シルバー' }).getAttribute('src')).toBe('/trophy3.png');
    expect(getAllByText('？？？')).toHaveLength(1);
    expect(getByRole('img', { name: '実績未達' }).getAttribute('src')).toBe('/trophy0.png');
    expect(queryByText('おわり', { exact: false })).toBeNull();
    expect(queryByText('冒険を終えた')).toBeNull();
    expect(queryByText('Lv.5')).toBeNull();
  });

  it('omits the trophies when no icon is given', () => {
    const global = { ...emptyGlobalState(), results: { demo: ['r01'] } };
    const { queryByRole, getByText } = render(
      <RecordPanel scenario={scenario} scenarioId="demo" global={global} history={[]} />,
    );
    expect(getByText('Lv.3')).toBeTruthy();
    expect(queryByRole('img')).toBeNull();
  });
});
