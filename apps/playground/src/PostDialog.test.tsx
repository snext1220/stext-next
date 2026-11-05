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
    expect(screen.getByDisplayValue('作者名').getAttribute('name')).toBe('author');
    expect(
      [...container.querySelectorAll('form [name]')].map((element) => element.getAttribute('name')),
    ).not.toContain('title');
    expect(
      [...container.querySelectorAll('form [name]')].map((element) => element.getAttribute('name')),
    ).not.toContain('scenario_id');
    expect(screen.getByRole('button', { name: '提出情報を送信' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('[name="form_id"]')).toBeNull();
  });

  it('sends form fields to the PHP endpoint and shows the server response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accepted: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
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
      target: { value: 'author@example.com' },
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
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText(/提出情報を受け付けました/)).toBeTruthy();
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('https://www.web-deli.com/sorcerian/text/playground/submit.php');
    expect(options?.method).toBe('POST');
    expect(options?.credentials).toBe('omit');
    if (!(options?.body instanceof URLSearchParams)) throw new Error('Form body is missing');
    expect(options.body.get('email')).toBe('author@example.com');
    expect(options.body.get('website')).toBe('');
  });
});
