// @vitest-environment jsdom
import { createEngine, emptyGlobalState, type GameState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BattlePanel } from './BattlePanel.js';

const scenario: Scenario = {
  format: 'stext/2',
  meta: { id: 'battle-ui', title: 'Battle UI' },
  items: [{ id: 'herb', name: '薬草' }],
  flags: [],
  params: [],
  results: [],
  groups: [],
  licence: [],
  enemies: [
    {
      id: 'first',
      name: '敵1',
      text: '最初の敵の説明',
      hp: 10,
      attack: 'physics',
      func: 'L',
      funcOpp: '1',
      drop: 'item/herb/薬草',
    },
    { id: 'second', name: '敵2', text: '二体目の説明', hp: 1, funcOpp: '1' },
    { id: 'third', name: '敵3', text: '三体目の説明' },
  ],
  scenes: [{ id: '0', text: '戦闘', enemies: ['first', 'second', 'third'], choices: [] }],
};

function renderBattle() {
  const engine = createEngine(scenario);
  const global = emptyGlobalState();
  const onChange = vi.fn<(state: GameState) => void>();
  function Harness() {
    const [state, setState] = useState(() => engine.start(global).state);
    return (
      <BattlePanel
        engine={engine}
        scenario={scenario}
        state={state}
        global={global}
        view={engine.view(state, global)}
        onStateChange={(next) => {
          onChange(next);
          setState(next);
        }}
        onFeedback={vi.fn()}
      />
    );
  }
  return { ...render(<Harness />), onChange };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('battle card folding', () => {
  it('folds only the checked enemy, preserving battle state and unclaimed drops', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { onChange, container } = renderBattle();
    const card = screen.getByRole('region', { name: '敵：敵1' });
    const enemy = within(card);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.click(enemy.getByRole('button', { name: '攻撃する' }));
    const hp = card.querySelector('.enemy-hp b')?.textContent;
    const dice = screen
      .getAllByRole('img', { name: /ダイス/ })
      .map((die) => die.getAttribute('aria-label'));
    onChange.mockClear();

    const check = enemy.getByRole('checkbox') as HTMLInputElement;
    check.focus();
    fireEvent.click(check);
    expect(document.activeElement).toBe(check);
    expect(check.checked).toBe(true);
    expect(enemy.queryByRole('button', { name: '攻撃する' })).toBeNull();
    expect(enemy.queryByRole('button', { name: '戦利品：薬草' })).toBeNull();
    expect(enemy.getByText('未取得の戦利品あり')).toBeTruthy();
    expect(
      enemy.getByRole('button', { name: '敵1の詳細を開く' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      within(screen.getByRole('region', { name: '敵：敵2' })).getByRole('button', {
        name: '攻撃する',
      }),
    ).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll('.enemy h3')).map((title) => title.textContent),
    ).toEqual(['敵1', '敵2', '敵3']);

    const open = enemy.getByRole('button', { name: '敵1の詳細を開く' });
    fireEvent.click(open);
    expect(check.checked).toBe(true);
    expect(card.querySelector('.enemy-hp b')?.textContent).toBe(hp);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('2');
    expect(
      screen.getAllByRole('img', { name: /ダイス/ }).map((die) => die.getAttribute('aria-label')),
    ).toEqual(dice);
    const close = enemy.getByRole('button', { name: '敵1の詳細を閉じる' });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(close);
    fireEvent.click(check);
    expect(enemy.getByRole('button', { name: '攻撃する' }).hasAttribute('disabled')).toBe(false);
    expect(card.querySelector('.enemy-hp b')?.textContent).toBe(hp);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('claims drops from checked details without resetting them on folding or state updates', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { onChange } = renderBattle();
    const enemy = within(screen.getByRole('region', { name: '敵：敵1' }));
    const check = enemy.getByRole('checkbox');
    fireEvent.click(check);
    fireEvent.click(enemy.getByRole('button', { name: '敵1の詳細を開く' }));
    fireEvent.click(enemy.getByRole('button', { name: '戦利品：薬草' }));
    expect(onChange.mock.lastCall?.[0].items).toEqual(['herb']);
    expect(enemy.queryByText('未取得の戦利品あり')).toBeNull();
    expect(enemy.getByRole('button', { name: '薬草（取得済み）' }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(enemy.getByRole('button', { name: '敵1の詳細を閉じる' }));
    fireEvent.click(screen.getByRole('button', { name: 'ダイスを振る' }));
    expect(enemy.getByRole('button', { name: '敵1の詳細を開く' })).toBeTruthy();
    fireEvent.click(check);
    expect(enemy.getByRole('button', { name: '薬草（取得済み）' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not auto-fold at zero HP and keeps all checked enemies recoverable', () => {
    renderBattle();
    const second = within(screen.getByRole('region', { name: '敵：敵2' }));
    fireEvent.click(second.getByRole('button', { name: '攻撃する' }));
    expect(second.getByText('二体目の説明')).toBeTruthy();
    expect(second.getByRole('button', { name: '攻撃する' }).hasAttribute('disabled')).toBe(true);
    expect((second.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    for (const check of screen.getAllByRole('checkbox')) fireEvent.click(check);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /の詳細を開く/ })).toHaveLength(3);
    fireEvent.click(second.getByRole('checkbox'));
    expect(second.getByRole('button', { name: '攻撃する' }).hasAttribute('disabled')).toBe(true);
  });
});
