// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import { PostDialog } from './PostDialog.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PostDialog', () => {
  it('shows title and scenario ID without adding them to the submitted fields', () => {
    const scenario = emptyScenario('作品名');
    scenario.meta.id = 'scenario-1';
    scenario.meta.author = '作者名';
    const { container } = render(
      <PostDialog
        scenario={scenario}
        projectId="project-1"
        resources={[]}
        errors={0}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('作品名', { selector: 'dd' }).textContent).toBe('作品名');
    expect(screen.getByText('scenario-1', { selector: 'dd' }).textContent).toBe('scenario-1');
    expect(container.querySelector('input[name="single_seimei"]')?.getAttribute('value')).toBe(
      '作者名',
    );
    expect(
      [...container.querySelectorAll('form [name]')].map((element) => element.getAttribute('name')),
    ).not.toContain('title');
    expect(
      [...container.querySelectorAll('form [name]')].map((element) => element.getAttribute('name')),
    ).not.toContain('scenario_id');
    expect(
      screen.getByRole('button', { name: 'オレンジフォームで確認' }).hasAttribute('disabled'),
    ).toBe(false);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('[name="form_id"]')?.getAttribute('value')).toBe('261098');
    expect(screen.getByRole('link', { name: 'メールフォーム 『オレンジフォーム』' })).toBeTruthy();
  });

  it('allows a native POST to a separate tab without claiming submission success', () => {
    vi.stubGlobal('fetch', vi.fn());
    const scenario = emptyScenario('題');
    scenario.meta.id = 'scenario-1';
    const { container } = render(
      <PostDialog
        scenario={scenario}
        projectId="project-1"
        resources={[]}
        errors={0}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('ペンネーム（作者名）'), {
      target: { value: '作者名' },
    });
    fireEvent.change(screen.getByLabelText('連絡先（メールアドレス）'), {
      target: { value: ' author@example.com ' },
    });
    fireEvent.change(screen.getByLabelText('分類'), {
      target: { value: '短編' },
    });
    fireEvent.change(screen.getByLabelText('シナリオ紹介（2〜300文字）'), {
      target: { value: '作品紹介です。' },
    });
    fireEvent.change(screen.getByLabelText('作者より（80文字程度）'), {
      target: { value: 'よろしくお願いします。' },
    });
    fireEvent.change(screen.getByLabelText('ダウンロードURL（必須）'), {
      target: { value: 'https://gigafile.nu/example' },
    });
    fireEvent.change(screen.getByLabelText('保持期間（7日以上）'), {
      target: { value: '7日' },
    });
    const form = container.querySelector('form')!;
    expect(fireEvent.submit(form)).toBe(true);
    expect(form.action).toBe('https://form.os7.biz/form/submit/');
    expect(form.method).toBe('post');
    expect(form.target).toBe('_blank');
    expect(form.getAttribute('rel')).toBe('noopener noreferrer');
    expect(form.acceptCharset).toBe('UTF-8');
    expect(Object.fromEntries(new FormData(form))).toEqual({
      form_id: '261098',
      encoding_test: 'あいうえお眉幅ABC',
      base_url: 'https://form.os7.biz/',
      urlhash: 'f/06d639bb/',
      oid: '1012766',
      of_dummy_note: '',
      single_seimei: '作者名',
      mail: 'author@example.com',
      free1: '短編',
      free2: '3（普通）',
      free3: '作品紹介です。',
      free4: 'よろしくお願いします。',
      free5: 'https://gigafile.nu/example',
      free6: '7',
      free7: '',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/受付・メール送信の完了を確認できません/)).toBeTruthy();
    expect(screen.queryByText(/提出情報を受け付けました/)).toBeNull();
    expect(screen.getByLabelText('連絡先（メールアドレス）')).toBeTruthy();
  });

  it('prevents navigation for invalid inputs and keeps the entered values', () => {
    const scenario = emptyScenario('題');
    scenario.meta.id = 'scenario-1';
    const { container } = render(
      <PostDialog
        scenario={scenario}
        projectId="project-1"
        resources={[]}
        errors={0}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('ペンネーム（作者名）'), {
      target: { value: '作者名' },
    });
    expect(fireEvent.submit(container.querySelector('form')!)).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('分類を入力してください');
    expect(screen.getByLabelText('ペンネーム（作者名）').getAttribute('value')).toBe('作者名');
    expect(screen.queryByText(/受付・メール送信の完了を確認できません/)).toBeNull();
  });

  it('prevents navigation if the scenario ID is invalid', () => {
    const scenario = emptyScenario('題');
    scenario.meta.id = '../invalid';
    const { container } = render(
      <PostDialog
        scenario={scenario}
        projectId="project-1"
        resources={[]}
        errors={0}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'オレンジフォームで確認' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(fireEvent.submit(container.querySelector('form')!)).toBe(false);
  });
});
