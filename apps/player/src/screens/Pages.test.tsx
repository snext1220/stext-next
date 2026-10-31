// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioEntry } from '../data.js';
import { About } from './About.js';
import { Footer } from './Footer.js';
import { Music } from './Music.js';
import { Post } from './Post.js';

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

describe('About and Post', () => {
  it('lists the chapters of the guide as links to each section', () => {
    render(<About section="staff" />);
    const toc = screen.getByRole('navigation', { name: '目次' });
    expect([...toc.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '#/about/stext',
      '#/about/sorcerian',
      '#/about/staff',
      '#/about/gallery',
      '#/about/links',
    ]);
    expect(toc.querySelector('[aria-current="location"]')?.textContent).toBe('スタッフ');
    expect(document.getElementById('about-staff')).not.toBeNull();
    expect(screen.getByRole('img', { name: '30周年（杖・大）' }).getAttribute('src')).toBe(
      '/assets/site/gallery/banner_r1.png',
    );
  });

  it('explains how to post and offers the creator materials', () => {
    const { container } = render(<Post />);
    expect(
      screen.getByRole('link', { name: 'GitHub から投稿する（要ログイン）' }).getAttribute('href'),
    ).toBe('https://github.com/snext1220/stext/discussions/299');
    expect(screen.getByLabelText('zip のフォルダー構成').textContent).toContain('scenario.json');
    expect(container.querySelectorAll('.face-grid a[download]')).toHaveLength(24);
    expect(container.querySelectorAll('.recruit')).toHaveLength(5);
    expect(container.querySelector('.recruit.closed h3')?.textContent).toContain('ドラゴンモード');
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
