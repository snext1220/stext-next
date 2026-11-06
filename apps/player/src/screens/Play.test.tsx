// @vitest-environment jsdom
import { createEngine, emptyGlobalState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector } from '../audio.js';
import { Play } from './Play.js';

vi.mock('../data.js', () => ({
  loadIndex: () => Promise.resolve([{ id: 'past', results: 4 }]),
}));

const scenario: Scenario = {
  format: 'stext/2',
  meta: { id: 'scroll-test', title: 'Scroll test' },
  items: [],
  flags: [],
  params: [],
  enemies: [],
  results: [],
  groups: [],
  licence: [],
  scenes: [
    {
      id: '0',
      text: 'First scene',
      choices: [
        { label: 'Next', to: ['1'] },
        { label: 'Again', to: ['0'] },
        { label: 'Missing', to: ['404'] },
        { kind: 'jump', allow: ['1'] },
        { kind: 'answer', answer: 'yes', to: '1', else: '0' },
      ],
    },
    { id: '1', text: 'Second scene', choices: [{ label: 'Return', to: ['90000'] }] },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(AudioDirector.prototype, 'playBgm').mockImplementation(() => {});
  vi.spyOn(AudioDirector.prototype, 'playSe').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  document.cookie =
    'stext_cache_random_player-random-cache-test0=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  vi.restoreAllMocks();
});

function renderPlay() {
  const global = emptyGlobalState();
  const { state } = createEngine(scenario).start(global);
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const onSettings = vi.fn();
  const result = render(
    <Play
      id="scroll-test"
      scenario={scenario}
      initial={state}
      global={global}
      onGlobal={vi.fn()}
      audio={new AudioDirector(false)}
      settings={{ theme: 'system', fontSize: 'medium', fontFamily: 'mincho' }}
      onSettings={onSettings}
    />,
  );
  return { ...result, scroll, onSettings };
}

describe('scene scrolling', () => {
  it('shows reading settings in the mobile adventurer sheet', () => {
    const { onSettings } = renderPlay();

    expect(
      within(screen.getByRole('navigation', { name: '冒険者メニュー' })).getAllByRole('button'),
    ).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /HP/ }));
    const dialog = within(screen.getByRole('dialog', { name: '冒険者' }));
    fireEvent.click(dialog.getByRole('button', { name: '大' }));
    expect(onSettings).toHaveBeenCalledWith({
      theme: 'system',
      fontSize: 'large',
      fontFamily: 'mincho',
    });

    fireEvent.click(dialog.getByRole('button', { name: 'ゴシック' }));
    expect(onSettings).toHaveBeenLastCalledWith({
      theme: 'system',
      fontSize: 'medium',
      fontFamily: 'gothic',
    });
  });

  it('keeps random destinations in cookies during play', () => {
    const randomScenario: Scenario = {
      ...scenario,
      meta: { id: 'player-random-cache-test', title: 'Random cache test' },
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
    const global = emptyGlobalState();
    const { state } = createEngine(randomScenario).start(global);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(
      <Play
        id="player-random-cache-test"
        scenario={randomScenario}
        initial={state}
        global={global}
        onGlobal={vi.fn()}
        audio={new AudioDirector(false)}
        settings={{ theme: 'system', fontSize: 'medium', fontFamily: 'mincho' }}
        onSettings={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /運試し/ }));
    expect(screen.getByText('分岐2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '← 戻る' }));
    random.mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: /運試し/ }));
    expect(screen.getByText('分岐2')).toBeTruthy();
  });

  it('renders achievement macros from the saved global results', async () => {
    const withMacro: Scenario = {
      ...scenario,
      scenes: [{ ...scenario.scenes[0]!, text: '${result?past}:${result_rate?past}' }],
    };
    const global = { ...emptyGlobalState(), results: { past: ['r01', 'r02'] } };
    const { state } = createEngine(withMacro).start(global);
    render(
      <Play
        id="scroll-test"
        scenario={withMacro}
        initial={state}
        global={global}
        onGlobal={vi.fn()}
        audio={new AudioDirector(false)}
        settings={{ theme: 'system', fontSize: 'medium', fontFamily: 'mincho' }}
        onSettings={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('2:50')).toBeTruthy());
  });

  it('scrolls instantly only after the new scene has been rendered', () => {
    const { scroll } = renderPlay();
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockImplementation(() => {
      expect(screen.getByText('Second scene')).toBeTruthy();
      expect(screen.queryByText('First scene')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  });

  it('scrolls when a choice enters the same scene again', () => {
    const { scroll } = renderPlay();
    fireEvent.click(screen.getByRole('button', { name: /Again/ }));
    fireEvent.click(screen.getByRole('button', { name: /Again/ }));
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it.each(['button', 'keyboard', 'choice'])('scrolls after going back by %s', (method) => {
    const { scroll } = renderPlay();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    scroll.mockClear();
    scroll.mockImplementation(() => {
      expect(screen.getByText('First scene')).toBeTruthy();
    });
    if (method === 'button') fireEvent.click(screen.getByRole('button', { name: '← 戻る' }));
    else if (method === 'keyboard') fireEvent.keyDown(document.body, { key: 'Backspace' });
    else fireEvent.click(screen.getByRole('button', { name: /Return/ }));
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  });

  it('scrolls after selecting with a number key', () => {
    const { scroll } = renderPlay();
    fireEvent.keyDown(document.body, { key: '1' });
    expect(screen.getByText('Second scene')).toBeTruthy();
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  });

  it.each([
    ['移動する番号', '1', '移動する'],
    ['答え', 'yes', '回答する'],
  ])('scrolls after submitting %s', (label, value, button) => {
    const { scroll } = renderPlay();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByText('Second scene')).toBeTruthy();
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  });

  it('keeps the reading position when navigation fails or the memo changes', () => {
    const { scroll } = renderPlay();
    fireEvent.click(screen.getByRole('button', { name: /Missing/ }));
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    fireEvent.change(screen.getByLabelText('移動する番号'), { target: { value: '404' } });
    fireEvent.click(screen.getByRole('button', { name: '移動する' }));
    fireEvent.change(screen.getByLabelText('冒険メモ'), { target: { value: 'Keep reading' } });
    expect(screen.getByText('First scene')).toBeTruthy();
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  });
});
