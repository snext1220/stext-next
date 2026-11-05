// @vitest-environment jsdom
import { createEngine, emptyGlobalState } from '@stext/core';
import type { Scenario } from '@stext/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector } from '../audio.js';
import { Play } from './Play.js';

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
  vi.restoreAllMocks();
});

function renderPlay() {
  const global = emptyGlobalState();
  const { state } = createEngine(scenario).start(global);
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const result = render(
    <Play
      id="scroll-test"
      scenario={scenario}
      initial={state}
      global={global}
      onGlobal={vi.fn()}
      audio={new AudioDirector(false)}
      settings={{ theme: 'system', fontSize: 'medium', fontFamily: 'mincho' }}
      onSettings={vi.fn()}
    />,
  );
  return { ...result, scroll };
}

describe('scene scrolling', () => {
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
