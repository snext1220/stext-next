// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import { initialForm } from './post.js';
import { deletePostDraft, loadPostDraft, savePostDraft } from './postDraft.js';

afterEach(() => {
  vi.restoreAllMocks();
  deletePostDraft('project-1');
  deletePostDraft('project-2');
});

describe('投稿内容のCookie保存', () => {
  it('全入力を復元し、ダウンロードキーだけは保存しない', () => {
    const scenario = emptyScenario('題');
    const form = {
      ...initialForm(scenario),
      author: '作者😀',
      email: 'draft@example.com',
      tag: '短編, 謎解き',
      level: '5（難）',
      intro: '紹介\n改行も保存',
      comment: '途中の入力 ; = %',
      downloadUrl: 'https://gigafile.nu/example?a=1&b=2',
      retention: '30日',
      key: 'private-key',
    };
    savePostDraft('project-1', form);
    expect(loadPostDraft('project-1', scenario)).toEqual({ ...form, key: '' });
    expect(
      atob(
        document.cookie
          .split('; ')
          .find((entry) => entry.startsWith('stext_post_project-1_0='))!
          .split('=')[1]!,
      ),
    ).not.toContain('private-key');
  });

  it('プロジェクト間で混ぜず、削除も個別に行う', () => {
    const scenario = emptyScenario('題');
    const initial = initialForm(scenario);
    savePostDraft('project-1', { ...initial, author: '作者1' });
    expect(loadPostDraft('project-2', scenario)).toEqual(initial);
    savePostDraft('project-2', { ...initial, author: '作者2' });
    deletePostDraft('project-1');
    expect(loadPostDraft('project-1', scenario)).toEqual(initial);
    expect(loadPostDraft('project-2', scenario).author).toBe('作者2');
  });

  it('各項目の上限文字数でも分割して復元でき、短くした場合は余分なCookieを削除する', () => {
    const scenario = emptyScenario('題');
    const form = {
      ...initialForm(scenario),
      author: '😀'.repeat(100),
      email: `${'a'.repeat(242)}@example.com`,
      tag: '😀'.repeat(300),
      intro: '😀'.repeat(300),
      comment: '😀'.repeat(1000),
      downloadUrl: `https://gigafile.nu/${'a'.repeat(2029)}`,
      retention: '9999',
    };
    const writes = vi.spyOn(document, 'cookie', 'set');
    savePostDraft('project-1', form);
    expect(loadPostDraft('project-1', scenario)).toEqual(form);
    for (const [cookie] of writes.mock.calls) expect(cookie.length).toBeLessThanOrEqual(4096);
    expect(document.cookie).toContain('stext_post_project-1_1=');
    savePostDraft('project-1', initialForm(scenario));
    expect(document.cookie).not.toContain('stext_post_project-1_1=');
  });

  it('30日とSameSiteを指定し、Cookieは現在のアプリのパスに限定する', () => {
    const writes = vi.spyOn(document, 'cookie', 'set');
    savePostDraft('project-1', initialForm(emptyScenario('題')));
    const saved = writes.mock.calls
      .map(([cookie]) => cookie)
      .filter((cookie) => !cookie.includes('Max-Age=0;'));
    expect(saved.length).toBeGreaterThan(0);
    for (const cookie of saved) {
      expect(cookie).toContain('Max-Age=2592000;');
      expect(cookie).toContain(`Path=${new URL('.', window.location.href).pathname};`);
      expect(cookie).toContain('SameSite=Lax');
    }
  });

  it('容量超過を通知し、前回保存した入力を残す', () => {
    const scenario = emptyScenario('題');
    const initial = initialForm(scenario);
    savePostDraft('project-1', initial);
    expect(() => savePostDraft('project-1', { ...initial, comment: '😀'.repeat(10000) })).toThrow(
      '入力内容が長すぎる',
    );
    expect(loadPostDraft('project-1', scenario)).toEqual(initial);
  });

  it('分割データの不足や不正な形式は復元エラーにする', () => {
    const scenario = emptyScenario('題');
    document.cookie = 'stext_post_project-1=2; Path=/';
    expect(() => loadPostDraft('project-1', scenario)).toThrow('不足');
    document.cookie = 'stext_post_project-1=1; Path=/';
    document.cookie = `stext_post_project-1_0=${btoa('{}')}; Path=/`;
    expect(() => loadPostDraft('project-1', scenario)).toThrow('形式');
    document.cookie = 'stext_post_project-1_0=invalid!; Path=/';
    expect(() => loadPostDraft('project-1', scenario)).toThrow('読み取れません');
  });
});
