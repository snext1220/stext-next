// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneText, legacyMarkdown, renderMarkdown } from './SceneText.js';

afterEach(cleanup);

describe('renderMarkdown', () => {
  it('makes paragraphs from blank lines and line breaks from newlines, like the legacy engine', () => {
    expect(renderMarkdown('一行目\n二行目\n\n次の段落')).toBe(
      '<p>一行目<br>二行目</p>\n<p>次の段落</p>\n',
    );
  });

  it('follows the legacy rules for bold text and -- lines', () => {
    expect(legacyMarkdown('しかし**「本物」**との噂')).toBe(
      'しかし<strong>「本物」</strong>との噂',
    );
    expect(renderMarkdown('上\n\n--\n\n下')).toContain('<hr>');
  });

  it('keeps ruby, colours and the custom tags, and removes scripts', () => {
    const html = renderMarkdown(
      '<ruby>主<rp>（</rp><rt>ぬし</rt><rp>）</rp></ruby>&nbsp;<span style="color:red">赤</span><stext-input param="p01" value="3"></stext-input><script>alert(1)</script><img src=x onerror="alert(1)">',
    );
    expect(html).toContain('<ruby>主<rp>（</rp><rt>ぬし</rt><rp>）</rp></ruby>');
    expect(html).toContain('<span style="color:red">赤</span>');
    expect(html).toContain('<stext-input param="p01" value="3"></stext-input>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('onerror');
  });
});

describe('SceneText', () => {
  it('resolves image paths and opens external links in a new tab', () => {
    const { container } = render(
      <SceneText
        markdown={'![杖](scepter.png)\n\nhttps://example.com/'}
        resolveImage={(src) => `/scenarios/scepter/capture/${src}`}
      />,
    );
    expect(container.querySelector('img')!.getAttribute('src')).toBe(
      '/scenarios/scepter/capture/scepter.png',
    );
    const a = container.querySelector('a')!;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('turns ${input?p01} into a number field that reports changes', () => {
    const onParamChange = vi.fn();
    const { getByLabelText, getByRole } = render(
      <SceneText
        markdown={'所持金 <stext-input param="p01" value="3"></stext-input> G'}
        onParamChange={onParamChange}
      />,
    );
    fireEvent.change(getByLabelText('パラメーター p01'), { target: { value: '5' } });
    expect(onParamChange).toHaveBeenLastCalledWith('p01', '5');
    fireEvent.click(getByRole('button', { name: '1増やす' }));
    expect(onParamChange).toHaveBeenLastCalledWith('p01', '4');
  });

  it('renders labels inline', () => {
    const { container } = render(
      <SceneText inline markdown="森の<ruby>主<rt>ぬし</rt></ruby>へ" />,
    );
    expect(container.querySelector('p')).toBeNull();
    expect(container.textContent).toBe('森の主ぬしへ');
  });

  it('toggles a %secret% spoiler by click and keyboard, and keeps %white% as hidden text', () => {
    const { container, getByRole } = render(
      <SceneText
        markdown={
          '「&nbsp;<span class="stext-secret">20 Gold<br>&nbsp;<span style="color:red">だ</span></span>」<span class="stext-hidden">裏</span>'
        }
      />,
    );
    const secret = getByRole('button', { name: '伏せ字（タップで表示）' });
    expect(secret.getAttribute('aria-pressed')).toBe('false');
    expect(secret.querySelector('span')!.style.color).toBe('red');
    fireEvent.click(secret);
    expect(secret.getAttribute('data-open')).toBe('true');
    expect(secret.getAttribute('aria-label')).toBeNull();
    fireEvent.keyDown(secret, { key: 'Enter' });
    expect(secret.getAttribute('data-open')).toBe('false');
    expect(container.querySelector('.stext-hidden')!.textContent).toBe('裏');
  });
});
