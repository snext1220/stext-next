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
  it('shows the v2 eGBP diagram', () => {
    render(<About />);
    const diagram = screen.getByRole('img', {
      name: 'eGBPの構成図。シナリオを、Playground・Converter・Systemで支えるソーサリアン Text v2のプラットフォーム',
    });
    expect(diagram.getAttribute('src')).toBe('/assets/site/about-egb-v2.svg');
    expect(diagram.parentElement?.classList.contains('doc-float')).toBe(true);
  });

  it('shows the Sorcerian world illustration beside the text', () => {
    render(<About />);
    const illustration = screen.getByRole('img', { name: 'ドラゴンに立ち向かう冒険者たち' });
    expect(illustration.getAttribute('src')).toBe('/assets/site/sorcerian-next-add2.jpg');
    expect(illustration.parentElement?.classList.contains('doc-float')).toBe(true);
  });

  it('shows the NText banner beside the story invitation', () => {
    render(<About />);
    const banner = screen.getByRole('img', {
      name: 'SORCERIAN Nextのロゴと「遊ぶ。創る。無限の冒険譚へ。」を描いたバナー',
    });
    expect(banner.getAttribute('src')).toBe('/assets/site/banner/ntext-300x250.png');
    expect(banner.parentElement?.classList.contains('doc-float')).toBe(true);
  });

  it('introduces SText and scrolls to the chapter about the original game', () => {
    render(<About section="sorcerian" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ソーサリアン NText とは');
    expect(screen.queryByRole('navigation', { name: '目次' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'ソーサリアン Text から NText へ' })).toBeTruthy();
    expect(screen.getByText(/ソーサリアン Text v2/)).toBeTruthy();
    expect(
      screen
        .getByRole('img', {
          name: '冒険者たちが本から広がる世界へ旅立つ、ソーサリアン NText のイメージイラスト',
        })
        .getAttribute('src'),
    ).toBe('/assets/site/ntext-promo.webp');
    expect(
      screen
        .getByRole('img', { name: 'NextからText、そしてNTextへ…冒険譚を受け継ぎ、新しい世代へ。' })
        .getAttribute('src'),
    ).toBe('/assets/site/banner/ntext-history-660x80.png');
    expect(document.getElementById('about-sorcerian')).not.toBeNull();
  });

  it('highlights key points sparingly in the guide and creator pages', () => {
    const about = render(<About />);
    expect(about.container.querySelector('mark.doc-marker')).not.toBeNull();
    for (const block of about.container.querySelectorAll('.doc p, .doc li')) {
      expect(block.querySelectorAll('mark.doc-marker').length).toBeLessThanOrEqual(2);
    }

    about.unmount();
    const post = render(<Post />);
    expect(post.container.querySelector('mark.doc-marker')?.textContent).toBe(
      'インストールは要りません。',
    );
    expect(post.container.querySelector('#post-submit .doc-marker')).toBeNull();
    for (const block of post.container.querySelectorAll('.doc p, .doc li')) {
      expect(block.querySelectorAll('mark.doc-marker').length).toBeLessThanOrEqual(2);
    }
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
    expect(screen.getByText(/ソーサリアン Text（v1）の画像です/)).toBeTruthy();
    expect(screen.getByText(/NTextの画像も追加する予定です/)).toBeTruthy();
    expect(screen.getByRole('img', { name: '30周年（杖・大）' }).getAttribute('src')).toBe(
      '/assets/site/gallery/banner_r1.png',
    );
  });

  it('shows only the history section on the history page', () => {
    const { container } = render(<Links />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('歴史展示室');
    expect(
      screen.getByRole('heading', { name: '起源（オリジン）、そして更なる展開（ステージ）へ' }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'リリース当日の様子' })).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'スタッフ／ゲスト作者さんのブログより' }),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'そのほかにも、さまざまに紹介していただきました' }),
    ).toBeNull();
    expect(screen.getAllByRole('link', { name: 'SORCERIAN Next 2020' })).toHaveLength(2);
    expect(
      screen
        .getAllByRole('link', { name: 'ソーサリアン Text（SText）' })
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      'https://www.web-deli.com/sorcerian/text/',
      'https://www.web-deli.com/sorcerian/text/',
    ]);
    expect(
      screen.getByRole('img', { name: 'ソーサリアン Text（SText）' }).getAttribute('src'),
    ).toBe('https://www.web-deli.com/sorcerian/text/image/banner/begin.png');
    expect(screen.getByText(/35本のシナリオが公開されました/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'SORCERIAN Next' }).getAttribute('src')).toBe(
      'https://www.web-deli.com/sorcerian/next/images2/snext_banner_1.png',
    );
    expect(
      screen.getByRole('img', { name: 'SORCERIAN Next' }).parentElement?.getAttribute('href'),
    ).toBe('https://www.web-deli.com/sorcerian/next/');
    expect(
      screen.getByRole('img', { name: '新時代のソーサリアンを提案する' }).getAttribute('src'),
    ).toBe(
      'https://cdn-ak.f.st-hatena.com/images/fotolife/s/sorcerian/20121027/20121027191354.png',
    );
    expect(
      screen
        .getByRole('img', { name: '新時代のソーサリアンを提案する' })
        .parentElement?.getAttribute('href'),
    ).toBe('https://d.hatena.ne.jp/sorcerian/');
    expect(screen.getByText(/2020は独立したゲーム作品/)).toBeTruthy();
    expect(screen.getByText(/7本のシナリオを遊べます/)).toBeTruthy();
    expect(screen.getByText(/NTextは、STextのシナリオとセーブデータ/)).toBeTruthy();
    expect(container.querySelector('.doc-banner-links')?.children).toHaveLength(2);
    expect(
      screen
        .getByRole('img', { name: 'ソーサリアン NText。遊ぶ。創る。無限の冒険譚へ。' })
        .getAttribute('src'),
    ).toBe('/assets/site/banner/ntext-660x80.png');
  });

  it('explains how to post and points to the creator materials', () => {
    const { container } = render(<Post />);
    const playgroundImage = screen.getByRole('img', {
      name: 'Playgroundの全体画面。左側にフロー図、右側に選択中のシーン編集欄が表示されている',
    });
    expect(playgroundImage.getAttribute('src')).toBe('/manual/image/01-playground.png');
    expect(playgroundImage.parentElement?.classList.contains('doc-float')).toBe(true);
    const submitImage = screen.getByRole('img', {
      name: '作品名、シナリオID、ZIP作成、提出情報の入力欄が並ぶ提出画面',
    });
    expect(submitImage.getAttribute('src')).toBe('/manual/image/12-submit.png');
    expect(submitImage.parentElement?.classList.contains('doc-float')).toBe(true);
    expect(
      screen.getByRole('link', { name: 'GitHub から投稿する（要ログイン）' }).getAttribute('href'),
    ).toBe('https://github.com/snext1220/stext/discussions/299');
    expect(screen.queryByLabelText('zip のフォルダー構成')).toBeNull();
    expect(screen.getByRole('link', { name: '素材と資料を見る' }).getAttribute('href')).toBe(
      '#/materials',
    );
    expect(screen.getByRole('link', { name: '開発ツールの入門を見る' }).getAttribute('href')).toBe(
      `${import.meta.env.BASE_URL}manual/playground.html`,
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
  it('nests music, history, and the gallery under the museum', () => {
    render(<Menu route={{ name: 'library' }} />);
    const guide = screen.getByRole('button', { name: '案内所' });
    const post = screen.getByRole('link', { name: '制作工房' });
    expect(post.getAttribute('href')).toBe('#/post');
    expect(post.classList.contains('post-link')).toBe(false);

    fireEvent.click(guide);
    const guideList = document.getElementById(guide.getAttribute('aria-controls')!)!;
    expect([...guideList.querySelectorAll(':scope > li > a')].map((a) => a.textContent)).toEqual([
      'ソーサリアン NTextとは？',
      '冒険の記録',
    ]);
    const works = screen.getByRole('button', { name: '資料館' });
    fireEvent.click(works);
    const worksList = document.getElementById(works.getAttribute('aria-controls')!)!;
    expect([...worksList.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      '音楽室',
      '歴史展示室',
      '画廊',
    ]);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '案内所',
      '資料館',
    ]);
  });

  it('marks nested history page as active and keeps the staff page out of the menu', () => {
    render(<Menu route={{ name: 'links' }} />);
    expect(screen.queryByRole('link', { name: '制作工房' })).toBeTruthy();
    const guide = screen.getByRole('button', { name: '案内所' });
    expect(guide.hasAttribute('data-active')).toBe(true);

    fireEvent.click(guide);
    const works = screen.getByRole('button', { name: '資料館' });
    expect(works.hasAttribute('data-active')).toBe(true);
    fireEvent.click(works);
    expect(screen.getByRole('link', { name: '歴史展示室' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.queryByRole('link', { name: '作り手たち' })).toBeNull();
    expect(screen.queryByRole('link', { name: '関連リンク' })).toBeNull();

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
    render(<Menu route={{ name: 'links' }} />);
    const guide = screen.getByRole('button', { name: '案内所' });
    fireEvent.click(guide);
    const works = screen.getByRole('button', { name: '資料館' });
    fireEvent.click(works);
    fireEvent.keyDown(screen.getByRole('link', { name: '歴史展示室' }), { key: 'Escape' });
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

  it('matches the guide menu and omits the staff page', () => {
    render(<Footer />);
    const navigation = screen.getByRole('navigation', { name: 'サイトの案内' });
    expect([...navigation.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'ソーサリアン NText とは',
      'ソーサリアンとは',
      '冒険の記録',
      'シナリオを投稿する',
      '音楽室',
      '歴史展示室',
      '画廊',
    ]);
    expect(screen.queryByRole('link', { name: '作り手たち' })).toBeNull();
    expect(screen.queryByRole('link', { name: '関連リンク' })).toBeNull();
  });
});
