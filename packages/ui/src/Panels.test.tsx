// @vitest-environment jsdom
import { BONUS_ITEMS, MAGIC, emptyGlobalState, newGameState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroPanel, ItemsPanel, MagicPanel, RecordPanel } from './Panels.js';
import { BONUS_AUTOMATION, MAGIC_AUTOMATION } from './effectAutomation.js';

afterEach(cleanup);

const scenario: Scenario = {
  format: 'stext/2',
  meta: { title: 'デモ', labels: { state: '状態異常', free1: '所持金' } },
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
    expect(getByText('状態異常')).toBeTruthy();
    expect(getByText('50')).toBeTruthy();
  });

  it('shows the applied bonus item with its effect', () => {
    const s = state();
    s.bonus = 'gi23';
    const { getByText } = render(<HeroPanel scenario={scenario} state={s} />);
    expect(getByText('D・スレイヤー')).toBeTruthy();
    expect(getByText('すべての星を1個所有した状態で冒険を開始する')).toBeTruthy();
  });

  it('covers every known magic and bonus item with an automation classification', () => {
    expect(Object.keys(MAGIC_AUTOMATION).sort()).toEqual(Object.keys(MAGIC).sort());
    expect(Object.keys(BONUS_AUTOMATION).sort()).toEqual(
      [...Object.keys(BONUS_ITEMS.happy), ...Object.keys(BONUS_ITEMS.bad)].sort(),
    );
    const classified = (entries: Record<string, { mode: string } | undefined>, mode: string) =>
      Object.entries(entries)
        .filter(([, info]) => info?.mode === mode)
        .map(([id]) => id)
        .sort();
    expect(classified(MAGIC_AUTOMATION, '手動')).toEqual(
      [
        'REJUVENATE',
        'PROTECT',
        'HOLY-WATER',
        'CHANGE-AIR',
        'GIVE-VIGOR',
        'EXPLOSION',
        'DELUGE',
        'FREEZE',
        'DESTROY-A',
        'LIGHT-CROSS',
        'NOILA-TEM',
      ].sort(),
    );
    expect(classified(BONUS_AUTOMATION, '手動')).toEqual(['gi12', 'gi13', 'gi16', 'gi17']);
    for (const id of ['bgi03', 'bgi04', 'bgi05']) {
      expect(BONUS_AUTOMATION[id]?.mode).toBe('自動');
      expect(BONUS_AUTOMATION[id]?.detail).toBeTruthy();
    }
    for (const [name, info] of Object.entries(MAGIC_AUTOMATION)) {
      expect(Boolean(info.detail)).toBe(info.mode === '手動' || name === 'RESURRECT');
    }
  });

  it('shows the applied bonus classification and its manual details only when enabled', () => {
    const s = state();
    s.bonus = 'bgi03';
    const { getByText, rerender, queryByText } = render(
      <HeroPanel scenario={scenario} state={s} showBonusAutomation />,
    );
    expect(getByText('自動')).toBeTruthy();
    const summary = getByText(/冒険開始時に呪い。ただし、解除後に3回まで/);
    const details = summary.closest('details')!;
    expect(summary.tagName).toBe('SUMMARY');
    expect(details.open).toBe(false);
    expect(getByText(/開始時の呪いは自動です/).closest('details')).toBe(details);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/通常どおり消費します/)).toBeTruthy();
    fireEvent.click(summary);
    expect(details.open).toBe(false);

    rerender(<HeroPanel scenario={scenario} state={s} />);
    expect(queryByText('自動')).toBeNull();
    expect(queryByText(/開始時の呪いは自動です/)).toBeNull();
    s.bonus = 'unknown';
    rerender(<HeroPanel scenario={scenario} state={s} showBonusAutomation />);
    expect(getByText('効果未確認')).toBeTruthy();
  });

  it('shows automatic and manual bonus classifications', () => {
    const s = state();
    s.bonus = 'gi14';
    const { getByText, rerender } = render(
      <HeroPanel scenario={scenario} state={s} showBonusAutomation />,
    );
    expect(getByText('自動')).toBeTruthy();
    expect(getByText('戦闘時のHPダメージが1減算される').closest('details')).toBeNull();
    s.bonus = 'gi12';
    rerender(<HeroPanel scenario={scenario} state={s} showBonusAutomation />);
    expect(getByText('手動')).toBeTruthy();
    const summary = getByText('冒険中に一度だけHPを半分回復しても良い').closest('summary')!;
    const details = summary.closest('details')!;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/冒険中１回の使用を自分で管理/)).toBeTruthy();
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

  it('opens manual spell details from their summaries without casting', () => {
    const onCast = vi.fn();
    const { getByText } = render(<MagicPanel state={state()} onCast={onCast} />);
    const heal = getByText('HEAL').closest('li')!;
    const protect = getByText('PROTECT').closest('li')!;
    const resurrect = getByText('RESURRECT').closest('li')!;
    expect(within(heal).getByText('自動')).toBeTruthy();
    expect(within(protect).getByText('手動')).toBeTruthy();
    expect(within(resurrect).getByText('自動')).toBeTruthy();
    expect(heal.querySelector('details')).toBeNull();
    expect(within(protect).queryByRole('button', { name: '唱える' })).toBeNull();
    const details = protect.querySelector('details')!;
    const summary = details.querySelector('summary')!;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/HPダメージ.*倍率を1\/2/)).toBeTruthy();
    expect(onCast).not.toHaveBeenCalled();
    fireEvent.click(summary);
    expect(details.open).toBe(false);
    const resurrectDetails = resurrect.querySelector('details')!;
    expect(resurrectDetails.open).toBe(false);
    expect(resurrect.querySelector('.sd')!.children).toHaveLength(1);
    fireEvent.click(resurrectDetails.querySelector('summary')!);
    expect(resurrectDetails.open).toBe(true);
    expect(
      within(resurrectDetails).getByText(
        'HP・MPは最大値の半分（端数切り捨て）に設定され、現在値より下がることもあります。回復は自動ですが、冒険中１回の使用は自分で管理してください。',
      ),
    ).toBeTruthy();
  });

  it('keeps casting separate from opening an available manual spell', () => {
    const onCast = vi.fn();
    const s = state();
    s.stars = [5, 5, 5, 5, 5, 5, 5];
    const { getByText } = render(<MagicPanel state={s} onCast={onCast} />);
    const protect = getByText('PROTECT').closest('li')!;
    fireEvent.click(protect.querySelector('summary')!);
    expect(onCast).not.toHaveBeenCalled();
    fireEvent.click(within(protect).getByRole('button', { name: '唱える' }));
    expect(onCast).toHaveBeenCalledWith('PROTECT');
  });

  it('shows the reasons and levels of unlocked results and hides the locked ones', () => {
    const global = { ...emptyGlobalState(), results: { demo: ['r01'] } };
    const { getByText, getAllByText, getByRole, queryByText } = render(
      <RecordPanel
        scenario={scenario}
        scenarioId="demo"
        global={global}
        elapsedSceneCount={17}
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

  it('shows elapsed scenes separately from the back history count', () => {
    const { getByText } = render(
      <RecordPanel
        scenario={scenario}
        scenarioId="demo"
        global={emptyGlobalState()}
        elapsedSceneCount={17}
        history={[{ id: '10', label: '次へ' }]}
      />,
    );
    expect(getByText('経過シーン数')).toBeTruthy();
    expect(getByText('17')).toBeTruthy();
    expect(getByText('辿った節')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
  });

  it('omits the trophies when no icon is given', () => {
    const global = { ...emptyGlobalState(), results: { demo: ['r01'] } };
    const { queryByRole, getByText } = render(
      <RecordPanel
        scenario={scenario}
        scenarioId="demo"
        global={global}
        elapsedSceneCount={1}
        history={[]}
      />,
    );
    expect(getByText('Lv.3')).toBeTruthy();
    expect(queryByRole('img')).toBeNull();
  });
});
