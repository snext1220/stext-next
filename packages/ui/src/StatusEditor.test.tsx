// @vitest-environment jsdom
import { newGameState } from '@stext/core';
import type { Enemy, Scenario } from '@stext/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnemyCard } from './Battle.js';
import { Effect } from './Effect.js';
import { StatusEditor } from './StatusEditor.js';

afterEach(cleanup);

const scenario = { meta: { title: 'デモ', labels: { free1: '所持金' } } } as unknown as Scenario;

describe('StatusEditor', () => {
  it('saves edited values, stars and a valid job', () => {
    const state = newGameState(() => 0);
    const onSave = vi.fn();
    const { getByLabelText, getByRole } = render(
      <StatusEditor scenario={scenario} state={state} onSave={onSave} onCancel={() => {}} />,
    );
    fireEvent.change(getByLabelText('名前'), { target: { value: 'ゼン' } });
    fireEvent.change(getByLabelText('HP'), { target: { value: '12' } });
    fireEvent.click(getByRole('button', { name: '所持金を1増やす' }));
    fireEvent.change(getByLabelText('状態'), { target: { value: 'poison' } });
    fireEvent.click(getByRole('button', { name: '太陽を1増やす' }));
    fireEvent.click(getByRole('button', { name: '月を1減らす' }));
    fireEvent.change(getByLabelText('種族'), { target: { value: 'WIZARD' } });
    fireEvent.click(getByRole('button', { name: '確定' }));
    const saved = onSave.mock.calls[0]![0];
    expect(saved.chara).toMatchObject({
      name: 'ゼン',
      hp: 12,
      free1: 1,
      state: 'poison',
      race: 'WIZARD',
    });
    expect(saved.stars).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(saved.chara.job).not.toBe('');
    expect(state.chara.hp).not.toBe(12);
  });
});

describe('EnemyCard', () => {
  it('marks an enemy as defeated with the check box', () => {
    const enemy: Enemy = { id: 'm01', name: '人面岩' };
    const onToggle = vi.fn();
    const { getByLabelText, container, rerender } = render(
      <EnemyCard enemy={enemy} onToggleDefeated={onToggle} />,
    );
    fireEvent.click(getByLabelText('人面岩を撃破した'));
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(<EnemyCard enemy={enemy} defeatedChecked onToggleDefeated={onToggle} />);
    expect(container.querySelector('.enemy.defeated')).not.toBeNull();
  });
});

describe('Effect', () => {
  it('animates each letter with the named effect and a growing delay', () => {
    const { container } = render(
      <Effect name="fadeInDown">
        あい <b>う</b>
      </Effect>,
    );
    const letters = [...container.querySelectorAll('.stext-letter')] as HTMLElement[];
    expect(letters.map((l) => l.textContent)).toEqual(['あ', 'い', 'う']);
    expect(letters.every((l) => l.classList.contains('fx-fadeInDown'))).toBe(true);
    expect(letters.map((l) => l.style.animationDelay)).toEqual(['0ms', '50ms', '100ms']);
    expect(container.querySelector('b')!.textContent).toBe('う');
  });

  it('falls back to a fade for unknown effects', () => {
    const { container } = render(<Effect name="wobble">あ</Effect>);
    expect(container.querySelector('.fx-fadeIn')).not.toBeNull();
  });
});
