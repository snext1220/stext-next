// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioEntry } from '../data.js';
import { About } from './About.js';
import { Footer } from './Footer.js';
import { Gallery } from './Gallery.js';
import { Links } from './Links.js';
import { Materials } from './Materials.js';
import { Menu } from './Menu.js';
import { Music } from './Music.js';
import { Post } from './Post.js';
import { Recruit } from './Recruit.js';
import { Staff } from './Staff.js';

const entries: ScenarioEntry[] = [
  {
    id: 'scepter',
    title: '新・消えた王様の杖',
    listed: true,
    scenes: 253,
    results: 45,
    bgm: ['field04', 'town01'],
  },
  { id: 'inn', title: 'トラベラーズ☆イン', listed: true, scenes: 30, results: 5, bgm: ['town01'] },
  { id: 'test', title: '開発用テスト', listed: false, scenes: 3, results: 0, bgm: ['town01'] },
];

vi.mock('../data.js', () => ({ loadIndex: () => Promise.resolve(entries) }));

afterEach(cleanup);

describe('Music', () => {
  it('shows which listed scenarios use each track and plays the chosen one', async () => {
    const { container } = render(<Music />);
    expect(await screen.findByText('2 編：新・消えた王様の杖、トラベラーズ☆イン')).toBeTruthy();
    expect(container.querySelectorAll('.track')).toHaveLength(24);
    expect(screen.queryByRole('region', { name: '再生中の曲' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'field04 を再生' }));
    const audio = container.querySelector<HTMLAudioElement>('.now-playing audio')!;
    expect(audio.getAttribute('src')).toBe('/assets/common/bgm/field04.mp3');
    expect(audio.loop).toBe(true);
    expect(
      screen.getByRole('button', { name: 'field04 を止める' }).getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '停止' }));
    expect(container.querySelector('.now-playing')).toBeNull();
  });
});

describe('guide and toolbox pages', () => {
  it('introduces SText and scrolls to the chapter about the original game', () => {
    render(<About section="sorcerian" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ソーサリアン Text とは');
    expect(screen.queryByRole('navigation', { name: '目次' })).toBeNull();
    expect(document.getElementById('about-sorcerian')).not.toBeNull();
  });

  it('shows the staff and the gallery on their own pages', () => {
    render(<Staff />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('作り手たち');
    expect(
      screen.getAllByRole('link', { name: 'Rio' }).map((a) => a.getAttribute('href')),
    ).toContain('https://x.com/yy7512');
    cleanup();
    render(<Gallery />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('画廊');
    expect(screen.getByRole('img', { name: '30周年（杖・大）' }).getAttribute('src')).toBe(
      '/assets/site/gallery/banner_r1.png',
    );
  });

  it('lists the related links', () => {
    render(<Links />);
    expect(screen.getByRole('heading', { name: 'リリース当日の様子' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'SORCERIAN Next 2020' })).toHaveLength(2);
  });

  it('explains how to post and points to the creator materials', () => {
    render(<Post />);
    expect(
      screen.getByRole('link', { name: 'GitHub から投稿する（要ログイン）' }).getAttribute('href'),
    ).toBe('https://github.com/snext1220/stext/discussions/299');
    expect(screen.getByLabelText('zip のフォルダー構成').textContent).toContain('scenario.json');
    expect(screen.getByRole('link', { name: '素材と資料を見る' }).getAttribute('href')).toBe(
      '#/materials',
    );
  });

  it('offers the recruitments and the creator materials on their own pages', () => {
    const { container } = render(<Recruit />);
    expect(container.querySelectorAll('.recruit')).toHaveLength(5);
    expect(container.querySelector('.recruit.closed h3')?.textContent).toContain('ドラゴンモード');
    cleanup();
    const materials = render(<Materials />);
    expect(materials.container.querySelectorAll('.face-grid a[download]')).toHaveLength(24);
  });
});

describe('Menu', () => {
  it('groups the pages into the toolbox and the guide', () => {
    render(<Menu route={{ name: 'library' }} />);
    const toolbox = screen.getByRole('button', { name: '道具箱' });
    const guide = screen.getByRole('button', { name: '案内所' });
    expect(toolbox.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: '記録' })).toBeNull();

    fireEvent.click(toolbox);
    expect(toolbox.getAttribute('aria-expanded')).toBe('true');
    const list = document.getElementById(toolbox.getAttribute('aria-controls')!)!;
    expect([...list.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      '記録',
      '変換所',
      '音楽室',
      '制作者向けの素材',
    ]);

    fireEvent.click(guide);
    expect(guide.getAttribute('aria-expanded')).toBe('true');
    // ほかのサブメニューを押したら（フォーカスが移ったら）、開いていたほうは閉じる
    fireEvent.focusIn(guide);
    expect(toolbox.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual(
      [
        ['書庫', '#/library'],
        ['ソーサリアン Text とは', '#/about'],
        ['投稿', '#/post'],
        ['募集中の企画', '#/recruit'],
        ['関連リンク', '#/links'],
        ['画廊', '#/gallery'],
        ['作り手たち', '#/staff'],
      ],
    );
  });

  it('closes with Escape or when an item is chosen, and marks the current page', () => {
    render(<Menu route={{ name: 'staff' }} />);
    const guide = screen.getByRole('button', { name: '案内所' });
    expect(guide.hasAttribute('data-active')).toBe(true);
    expect(screen.getByRole('button', { name: '道具箱' }).hasAttribute('data-active')).toBe(false);

    fireEvent.click(guide);
    expect(screen.getByRole('link', { name: '作り手たち' }).getAttribute('aria-current')).toBe(
      'page',
    );
    fireEvent.keyDown(screen.getByRole('link', { name: '画廊' }), { key: 'Escape' });
    expect(guide.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(guide);

    fireEvent.click(guide);
    fireEvent.click(screen.getByRole('link', { name: '画廊' }));
    expect(guide.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(guide);
    fireEvent.pointerDown(document.body);
    expect(guide.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Footer', () => {
  it('shows the contacts and leads to the scenarios with a questionnaire', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'X（旧 Twitter）' }).getAttribute('href')).toBe(
      'https://x.com/snext1220',
    );
    expect(
      screen.getByRole('link', { name: 'シナリオへの感想・ご意見' }).getAttribute('href'),
    ).toBe('#/library/quest');
  });
});
