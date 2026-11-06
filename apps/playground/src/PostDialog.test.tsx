// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import { PostDialog } from './PostDialog.js';
import { deletePostDraft, loadPostDraft } from './postDraft.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  deletePostDraft('project-1');
  deletePostDraft('project-2');
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
    expect(screen.getByRole('button', { name: '作品を提出' }).hasAttribute('disabled')).toBe(false);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('[name="form_id"]')?.getAttribute('value')).toBe('261098');
    expect(screen.getByRole('link', { name: 'メールフォーム 『オレンジフォーム』' })).toBeTruthy();
    const fallback = screen.getByRole('link', { name: 'GitHub Discussionから投稿' });
    expect(container.querySelector('form')!.lastElementChild?.contains(fallback)).toBe(true);
    expect(screen.queryByRole('button', { name: 'GitHub用の提出文をコピー' })).toBeNull();
    const downloadHint = screen.getByText(
      'HTTPSのギガファイル便URLを入力してください。ホスト名は管理者も確認します。',
    );
    expect(downloadHint.closest('.pg-grid')).toBeNull();
    expect(downloadHint.parentElement?.getAttribute('aria-label')).toBe('アップロードと提出');
    expect(screen.getByLabelText('ダウンロードURL（必須）').getAttribute('aria-describedby')).toBe(
      downloadHint.id,
    );
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
    expect(screen.getByRole('button', { name: '作品を提出' }).hasAttribute('disabled')).toBe(true);
    expect(fireEvent.submit(container.querySelector('form')!)).toBe(false);
  });

  it('restores inputs after closing and reopening, but never restores the download key', () => {
    const scenario = emptyScenario('題');
    const onClose = vi.fn();
    const props = { scenario, projectId: 'project-1', resources: [], errors: 0, onClose };
    const dialog = render(<PostDialog {...props} />);
    fireEvent.change(screen.getByLabelText('連絡先（メールアドレス）'), {
      target: { value: 'draft@example.com' },
    });
    fireEvent.change(screen.getByLabelText('作者より（80文字程度）'), {
      target: { value: '途中の入力です。' },
    });
    fireEvent.change(screen.getByLabelText('ダウンロードキー（任意）'), {
      target: { value: 'private-key' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: '閉じる' })[0]!);
    expect(onClose).toHaveBeenCalledOnce();
    dialog.unmount();
    render(<PostDialog {...props} />);
    expect(screen.getByLabelText('連絡先（メールアドレス）').getAttribute('value')).toBe(
      'draft@example.com',
    );
    expect(screen.getByLabelText('作者より（80文字程度）').textContent).toBe('途中の入力です。');
    expect(screen.getByLabelText('ダウンロードキー（任意）').getAttribute('value')).toBe('');
  });

  it('deletes only this project draft and resets the inputs without immediately saving again', () => {
    const scenario = emptyScenario('題');
    scenario.meta.author = '元の作者';
    const props = {
      scenario,
      projectId: 'project-1',
      resources: [],
      errors: 0,
      onClose: vi.fn(),
    };
    const dialog = render(<PostDialog {...props} />);
    fireEvent.change(screen.getByLabelText('ペンネーム（作者名）'), {
      target: { value: '変更した作者' },
    });
    fireEvent.change(screen.getByLabelText('ダウンロードキー（任意）'), {
      target: { value: 'private-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存した入力内容を削除' }));
    expect(screen.getByLabelText('ペンネーム（作者名）').getAttribute('value')).toBe('元の作者');
    expect(screen.getByLabelText('ダウンロードキー（任意）').getAttribute('value')).toBe('');
    expect(document.cookie).not.toContain('stext_post_project-1');
    expect(screen.getByRole('status').textContent).toContain('入力欄を初期値に戻しました');
    dialog.unmount();
    render(<PostDialog {...props} />);
    expect(screen.getByLabelText('ペンネーム（作者名）').getAttribute('value')).toBe('元の作者');
  });

  it('warns when cookies are blocked and keeps the input available for submission', () => {
    const scenario = emptyScenario('題');
    render(
      <PostDialog
        scenario={scenario}
        projectId="project-1"
        resources={[]}
        errors={0}
        onClose={vi.fn()}
      />,
    );
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {});
    fireEvent.change(screen.getByLabelText('ペンネーム（作者名）'), {
      target: { value: '保存できない作者' },
    });
    expect(screen.getByRole('alert').textContent).toContain('入力内容を保存できませんでした');
    expect(screen.getByLabelText('ペンネーム（作者名）').getAttribute('value')).toBe(
      '保存できない作者',
    );
  });

  it('warns about corrupt drafts and allows deleting them', () => {
    document.cookie = 'stext_post_project-1=invalid; Path=/';
    const scenario = emptyScenario('題');
    render(
      <PostDialog
        scenario={scenario}
        projectId="project-1"
        resources={[]}
        errors={0}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('入力内容を復元できませんでした');
    fireEvent.click(screen.getByRole('button', { name: '保存した入力内容を削除' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(loadPostDraft('project-1', scenario).email).toBe('');
  });
});
