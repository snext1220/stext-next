// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyGlobalState, newGameState } from '@stext/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioEntry } from '../data.js';
import { Library } from './Library.js';

const entries: ScenarioEntry[] = [
  {
    id: 'scepter',
    title: '新・消えた王様の杖',
    author: 'Rio',
    v2: true,
    listed: true,
    series: '開幕シナリオ',
    tags: ['探索'],
    level: 3,
    comment: '作者のコメント',
    scenes: 253,
    results: 45,
    quest: '1FAIpQLSdemo',
    prologue: 'ペンタウァ王家の象徴が盗まれてしまう。\n\n<p class="award">お知らせ</p>',
  },
  { id: 'doll', title: 'プレアオブ・ドールズ', listed: true, level: 1, scenes: 24, results: 4 },
  { id: 'test', title: '開発用テスト', listed: false, scenes: 3, results: 0 },
];

vi.mock('../data.js', () => ({ loadIndex: () => Promise.resolve(entries) }));

const settings = { theme: 'system', fontSize: 'medium', fontFamily: 'mincho' } as const;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderLibrary() {
  return render(<Library global={emptyGlobalState()} settings={settings} />);
}

describe('Library', () => {
  it('styles the native mark as a bordered badge in the shelf and details', async () => {
    const style = document.createElement('style');
    const styles = readFileSync(resolve('packages', 'ui', 'src', 'styles.css'), 'utf8');
    const rule = styles.match(/\.scenario-v2-mark\s*\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toContain('border: 1px solid var(--gold)');
    // jsdom は border の CSS 変数を解決できないため、色だけ具体値に置き換える。
    style.textContent = rule!.replaceAll('var(--gold)', '#8f6a14');
    document.head.append(style);
    try {
      const { container } = renderLibrary();
      const opener = await screen.findByRole('button', {
        name: '「新・消えた王様の杖」の詳細を表示',
      });
      fireEvent.click(opener);
      const marks = container.querySelectorAll('.scenario-v2-mark');
      expect(marks).toHaveLength(2);
      for (const mark of marks) {
        const computed = getComputedStyle(mark);
        expect(computed.display).toBe('inline-block');
        expect(computed.borderTopStyle).toBe('solid');
        expect(computed.borderTopWidth).toBe('1px');
        expect(computed.whiteSpace).toBe('nowrap');
        expect(computed.fontSize).toBe('0.62em');
      }
    } finally {
      style.remove();
    }
  });

  it('shows each listed scenario with its intro image, scenes and level', async () => {
    const { container } = renderLibrary();
    await screen.findByRole('button', { name: '「新・消えた王様の杖」の詳細を表示' });
    const books = container.querySelectorAll('.book');
    expect(books).toHaveLength(2);
    expect(screen.queryByText('開発用テスト')).toBeNull();
    expect(books[0]!.querySelector('.scenario-v2-mark')!.textContent).toBe('［純正］');
    expect(books[1]!.querySelector('.scenario-v2-mark')).toBeNull();
    expect(books[0]!.querySelector('img')!.getAttribute('src')).toMatch(
      /scepter\/capture\/intro\.png$/,
    );
    expect(books[0]!.textContent).toContain('253 シーン');
    const level = screen.getByRole('img', { name: '難易度 3（普通）' });
    expect(level.getAttribute('src')).toMatch(/level3\.png$/);
  });

  it('opens the details with the prologue and starts a new adventure from there', async () => {
    renderLibrary();
    fireEvent.click(
      await screen.findByRole('button', { name: '「新・消えた王様の杖」の詳細を表示' }),
    );
    const dialog = screen.getByRole('dialog', { name: /新・消えた王様の杖/ });
    expect(dialog.querySelector('.scenario-v2-mark')?.textContent).toBe('［純正］');
    expect(dialog.textContent).toContain('ペンタウァ王家の象徴が盗まれてしまう。');
    expect(dialog.querySelector('.award')?.textContent).toBe('お知らせ');
    expect(dialog.textContent).toContain('作者のコメント');
    expect(screen.getByRole('link', { name: '新たに冒険を始める' }).getAttribute('href')).toBe(
      '#/create/scepter',
    );
    expect(screen.queryByRole('link', { name: '続きから冒険する' })).toBeNull();
    expect(screen.getByRole('link', { name: 'アンケートに回答する' }).getAttribute('href')).toBe(
      'https://docs.google.com/forms/d/e/1FAIpQLSdemo/viewform',
    );
    expect(screen.getByRole('link', { name: '結果だけを確認' }).getAttribute('href')).toBe(
      'https://docs.google.com/forms/d/e/1FAIpQLSdemo/viewanalytics',
    );

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers to continue a saved adventure and closes with Escape', async () => {
    localStorage.setItem('doll', JSON.stringify(newGameState(() => 0)));
    renderLibrary();
    fireEvent.click(
      await screen.findByRole('button', { name: '「プレアオブ・ドールズ」の詳細を表示' }),
    );
    expect(screen.getByRole('link', { name: '続きから冒険する' }).getAttribute('href')).toBe(
      '#/play/doll',
    );
    expect(screen.getByRole('link', { name: '新たに冒険を始める' }).getAttribute('href')).toBe(
      '#/create/doll',
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('link', { name: 'アンケートに回答する' })).toBeNull();
  });

  it('starts narrowed to scenarios with a questionnaire when opened from CONTACT', async () => {
    const { container } = render(<Library global={emptyGlobalState()} settings={settings} quest />);
    await screen.findByRole('button', { name: '「新・消えた王様の杖」の詳細を表示' });
    expect(
      [...container.querySelectorAll('.book h2')].map((h) => h.firstChild?.textContent),
    ).toEqual(['新・消えた王様の杖']);
    expect(
      (screen.getByLabelText('アンケートのあるシナリオだけ') as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '条件クリア' }));
  });

  it('narrows the shelf with the search conditions and clears them', async () => {
    const { container } = renderLibrary();
    await screen.findByRole('button', { name: '「新・消えた王様の杖」の詳細を表示' });
    const books = () =>
      [...container.querySelectorAll('.book h2')].map((h) => h.firstChild?.textContent);

    fireEvent.change(screen.getByLabelText('難易度'), { target: { value: '3' } });
    expect(books()).toEqual(['新・消えた王様の杖']);
    expect(screen.getByRole('status').textContent).toBe('1 編 / 全 2 編');
    expect(container.querySelector('summary')!.textContent).toContain('1 件で絞り込み中');

    fireEvent.change(screen.getByLabelText('検索キーワード'), { target: { value: 'ドールズ' } });
    expect(books()).toEqual([]);
    expect(screen.getByText('条件に合うシナリオはありません。')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '条件クリア' }));
    expect(books()).toEqual(['新・消えた王様の杖', 'プレアオブ・ドールズ']);

    fireEvent.click(screen.getByLabelText('アンケートのあるシナリオだけ'));
    expect(books()).toEqual(['新・消えた王様の杖']);
    fireEvent.change(screen.getByLabelText('並び順'), { target: { value: 'scenes' } });
    fireEvent.click(screen.getByRole('button', { name: '条件クリア' }));
    fireEvent.change(screen.getByLabelText('並びの向き'), { target: { value: 'asc' } });
    fireEvent.change(screen.getByLabelText('並び順'), { target: { value: 'scenes' } });
    expect(books()).toEqual(['プレアオブ・ドールズ', '新・消えた王様の杖']);
    fireEvent.click(screen.getByRole('button', { name: '条件クリア' }));
  });
});
