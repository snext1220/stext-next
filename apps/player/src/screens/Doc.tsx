import { Parchment } from '@stext/ui';
import type { ReactNode } from 'react';
import { useSectionScroll } from '../router.js';

/** 案内所・道具箱の読み物の画面 */
export type DocPageName =
  'about' | 'post' | 'recruit' | 'links' | 'gallery' | 'staff' | 'materials';

/** 章（案内・投稿のように、1画面に節を並べるときに使う） */
export interface DocChapter {
  id: string;
  title: string;
}

/** 読み物の画面：見出しと、羊皮紙を並べる */
export function DocPage({
  page,
  section,
  eyebrow,
  title,
  lede,
  children,
}: {
  page: DocPageName;
  section?: string | undefined;
  eyebrow: string;
  title: string;
  lede: ReactNode;
  children: ReactNode;
}) {
  useSectionScroll(page, section);
  return (
    <div className="records doc-page">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      {children}
    </div>
  );
}

/** 羊皮紙1枚 */
export function DocSheet({ seed, children }: { seed: number; children: ReactNode }) {
  return (
    <Parchment seed={seed} curl={30}>
      <div className="doc">{children}</div>
    </Parchment>
  );
}

/** 見出しの付いた章。id は「ページ名-章」（#/post/submit なら post-submit） */
export function DocSection({
  page,
  chapter,
  eyebrow,
  seed,
  children,
}: {
  page: DocPageName;
  chapter: DocChapter;
  eyebrow?: string;
  seed: number;
  children: ReactNode;
}) {
  return (
    <section
      id={`${page}-${chapter.id}`}
      className="doc-section"
      aria-labelledby={`${page}-${chapter.id}-h`}
    >
      <DocSheet seed={seed}>
        {eyebrow && <div className="eyebrow doc-eyebrow">{eyebrow}</div>}
        <h2 id={`${page}-${chapter.id}-h`}>{chapter.title}</h2>
        {children}
      </DocSheet>
    </section>
  );
}

/** 外部サイトへのリンク（新しいタブで開く） */
export function ExtLink({ href: url, children }: { href: string; children: ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** 画像を並べる。押すと元の大きさの画像を新しいタブで開く */
export function Figures({
  items,
  className = 'figure-grid',
}: {
  items: readonly { src: string; caption: string }[];
  className?: string;
}) {
  return (
    <ul className={className}>
      {items.map((f) => (
        <li key={f.src}>
          <a href={f.src} target="_blank" rel="noopener noreferrer">
            <img src={f.src} alt={f.caption} loading="lazy" />
          </a>
          <span>{f.caption}</span>
        </li>
      ))}
    </ul>
  );
}
