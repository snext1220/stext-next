// @vitest-environment jsdom
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

const settings = { theme: 'system', fontSize: 'medium' } as const;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderLibrary() {
  return render(<Library global={emptyGlobalState()} settings={settings} />);
}

describe('Library', () => {
  it('shows each listed scenario with its intro image, scenes and level', async () => {
    const { container } = renderLibrary();
    await screen.findByText('新・消えた王様の杖');
    const books = container.querySelectorAll('.book');
    expect(books).toHaveLength(2);
    expect(screen.queryByText('開発用テスト')).toBeNull();
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
    const dialog = screen.getByRole('dialog', { name: '新・消えた王様の杖' });
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

  it('narrows the shelf with the search conditions and clears them', async () => {
    const { container } = renderLibrary();
    await screen.findByText('新・消えた王様の杖');
    const books = () => [...container.querySelectorAll('.book h2')].map((h) => h.textContent);

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
