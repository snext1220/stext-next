import DOMPurify from 'dompurify';
import parse, {
  Element,
  domToReact,
  type DOMNode,
  type HTMLReactParserOptions,
} from 'html-react-parser';
import { marked } from 'marked';
import { useMemo, type ReactNode } from 'react';

export interface SceneTextProps {
  /** エンジンが展開した Markdown（SceneView.markdown など） */
  markdown: string;
  /** 本文中の画像のファイル名を URL にする */
  resolveImage?: (src: string) => string;
  /** ${input?p01} の入力欄で値が変わったとき */
  onParamChange?: (id: string, value: string) => void;
  /** 段落にせず、行内の文として描画する（選択肢のラベルなど） */
  inline?: boolean;
  className?: string;
}

const PURIFY = {
  ADD_TAGS: ['stext-input', 'ruby', 'rt', 'rp'],
  ADD_ATTR: ['param', 'value', 'data-effect', 'target'],
};

/**
 * 旧エンジンの Markdown（jQuery Markdown）に合わせるための前処理。
 * - 「--」だけの行は区切り線
 * - **…** は前後の文字に関係なく太字（CommonMark の規則では「し**「…」**」のような日本語の太字が効かない）
 */
export function legacyMarkdown(markdown: string): string {
  return markdown
    .replace(/^[ \t]*-{2}[ \t]*$/gm, '\n\n---\n\n')
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Markdown を描画する。旧エンジンと同じく、空行で段落、改行は <br> にする。
 * HTML は DOMPurify で安全なものだけに絞る。
 */
export function renderMarkdown(markdown: string, inline = false): string {
  const source = legacyMarkdown(markdown);
  const html = inline
    ? (marked.parseInline(source, { breaks: true, gfm: true }) as string)
    : (marked.parse(source, { breaks: true, gfm: true, async: false }) as string);
  return DOMPurify.sanitize(html, PURIFY);
}

export function SceneText({
  markdown,
  resolveImage,
  onParamChange,
  inline = false,
  className,
}: SceneTextProps) {
  const content = useMemo(() => {
    const options: HTMLReactParserOptions = {
      replace(node) {
        if (!(node instanceof Element)) return undefined;
        if (node.name === 'img' && resolveImage) {
          const src = resolveImage(node.attribs['src'] ?? '');
          return <img src={src} alt={node.attribs['alt'] ?? ''} loading="lazy" />;
        }
        if (node.name === 'a' && /^https?:/.test(node.attribs['href'] ?? '')) {
          return (
            <a href={node.attribs['href']} target="_blank" rel="noopener noreferrer">
              {domToReact(node.children as DOMNode[], options)}
            </a>
          );
        }
        if (node.name === 'stext-input') {
          return (
            <ParamInput
              param={node.attribs['param']}
              value={node.attribs['value'] ?? ''}
              {...(onParamChange ? { onChange: onParamChange } : {})}
            />
          );
        }
        return undefined;
      },
    };
    return parse(renderMarkdown(markdown, inline), options);
  }, [markdown, inline, resolveImage, onParamChange]);
  return inline ? (
    <span className={className}>{content as ReactNode}</span>
  ) : (
    <div className={className}>{content as ReactNode}</div>
  );
}

/** ${input?p01} の入力欄。パラメーター以外（${input?値}）は飾りの入力欄 */
function ParamInput({
  param,
  value,
  onChange,
}: {
  param: string | undefined;
  value: string;
  onChange?: (id: string, value: string) => void;
}) {
  const set = (v: string) => param && onChange?.(param, v);
  const step = (d: number) => set(String((Number(value) || 0) + d));
  return (
    <span className="param-input">
      <button type="button" onClick={() => step(-1)} aria-label="1減らす">
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={param ? `パラメーター ${param}` : '値'}
        onChange={(e) => set(e.target.value)}
        readOnly={!param}
      />
      <button type="button" onClick={() => step(1)} aria-label="1増やす">
        ＋
      </button>
    </span>
  );
}
