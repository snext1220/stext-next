// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioEntry } from '../data.js';
import { App } from '../App.js';
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

vi.mock('../data.js', () => ({
  loadIndex: () => Promise.resolve(entries),
  loadScenario: () => Promise.reject(new Error('test scenario load failure')),
}));

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
    expect(screen.getByRole('heading', { name: 'ソーサリアン Text から NText へ' })).toBeTruthy();
    expect(screen.getByText(/ソーサリアン NText/)).toBeTruthy();
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
    const { container } = render(<Post />);
    expect(
      screen.getByRole('link', { name: 'GitHub から投稿する（要ログイン）' }).getAttribute('href'),
    ).toBe('https://github.com/snext1220/stext/discussions/299');
    expect(screen.getByLabelText('zip のフォルダー構成').textContent).toContain('scenario.json');
    expect(screen.getByRole('link', { name: '素材と資料を見る' }).getAttribute('href')).toBe(
      '#/materials',
    );
    expect(screen.getByRole('link', { name: '開発ツールの入門を見る' }).getAttribute('href')).toBe(
      'https://github.com/snext1220/stext-next/blob/main/docs/manual-playground.md',
    );
    expect(screen.getByRole('link', { name: '募集中の企画を見る' }).getAttribute('href')).toBe(
      '#/recruit',
    );
    expect(screen.getByRole('link', { name: '記録の変換所' }).getAttribute('href')).toBe(
      '#/convert',
    );
    expect(
      [...container.querySelector('.end-actions')!.querySelectorAll('a')].map((link) =>
        link.textContent?.trim(),
      ),
    ).toEqual([
      'Playgroundを開く',
      '開発ツールの入門を見る',
      '募集中の企画を見る',
      '素材と資料を見る',
    ]);
    expect(container.querySelector('.post-playground-actions .btn')?.textContent?.trim()).toBe(
      'Playgroundを開く',
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
  it('nests the gallery, staff, and links under the resource room', () => {
    render(<Menu route={{ name: 'library' }} />);
    const guide = screen.getByRole('button', { name: '案内所' });
    const post = screen.getByRole('link', { name: '制作工房' });
    expect(post.getAttribute('href')).toBe('#/post');
    expect(post.classList.contains('post-link')).toBe(false);

    fireEvent.click(guide);
    const guideList = document.getElementById(guide.getAttribute('aria-controls')!)!;
    expect([...guideList.querySelectorAll(':scope > li > a')].map((a) => a.textContent)).toEqual([
      'ソーサリアンTextとは？',
      '冒険の記録',
      '音楽室',
    ]);
    const works = screen.getByRole('button', { name: '資料室' });
    fireEvent.click(works);
    const worksList = document.getElementById(works.getAttribute('aria-controls')!)!;
    expect([...worksList.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      '画廊',
      '作り手たち',
      '関連リンク',
    ]);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '案内所',
      '資料室',
    ]);
  });

  it('shows creator guidance outside play and marks nested pages as active', () => {
    render(<Menu route={{ name: 'staff' }} />);
    expect(screen.queryByRole('link', { name: '制作工房' })).toBeTruthy();
    const guide = screen.getByRole('button', { name: '案内所' });
    expect(guide.hasAttribute('data-active')).toBe(true);

    fireEvent.click(guide);
    const works = screen.getByRole('button', { name: '資料室' });
    expect(works.hasAttribute('data-active')).toBe(true);
    fireEvent.click(works);
    expect(screen.getByRole('link', { name: '作り手たち' }).getAttribute('aria-current')).toBe(
      'page',
    );

    cleanup();
    render(<Menu route={{ name: 'play', id: 'scepter' }} />);
    expect(screen.queryByRole('link', { name: '制作工房' })).toBeNull();
    expect(screen.queryByRole('button', { name: '案内所' })).toBeNull();
    expect(screen.getByRole('link', { name: '書庫' }).getAttribute('href')).toBe('#/library');

    cleanup();
    render(<Menu route={{ name: 'create', id: 'scepter' }} />);
    expect(screen.getByRole('link', { name: '書庫' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '制作工房' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '案内所' })).toBeTruthy();
  });

  it('closes menus with Escape or outside interaction', () => {
    render(<Menu route={{ name: 'staff' }} />);
    const guide = screen.getByRole('button', { name: '案内所' });
    fireEvent.click(guide);
    const works = screen.getByRole('button', { name: '資料室' });
    fireEvent.click(works);
    fireEvent.keyDown(screen.getByRole('link', { name: '画廊' }), { key: 'Escape' });
    expect(guide.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(guide);
    fireEvent.pointerDown(document.body);
    expect(guide.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('header controls', () => {
  it('shows the sound toggle only on the play screen', async () => {
    window.location.hash = '#/records';
    render(<App />);
    expect(screen.queryByRole('button', { name: /音あり|音なし/ })).toBeNull();
    expect(screen.getByRole('button', { name: '昼と夜を切り替え' })).toBeTruthy();

    cleanup();
    window.location.hash = '#/play/scepter';
    render(<App />);
    expect(await screen.findByRole('button', { name: /音あり|音なし/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '昼と夜を切り替え' })).toBeTruthy();
    cleanup();
    window.location.hash = '';
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
