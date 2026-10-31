import { Parchment } from '@stext/ui';
import type { ReactNode } from 'react';
import { href, useSectionScroll } from '../router.js';

/** 案内・投稿の章 */
export interface DocChapter {
  id: string;
  title: string;
}

/** 案内・投稿の画面：見出し、章の目次、章（羊皮紙）を並べる */
export function DocPage({
  page,
  section,
  eyebrow,
  title,
  lede,
  chapters,
  children,
}: {
  page: 'about' | 'post';
  section: string | undefined;
  eyebrow: string;
  title: string;
  lede: ReactNode;
  chapters: readonly DocChapter[];
  children: ReactNode;
}) {
  useSectionScroll(page, section);
  return (
    <div className="records doc-page">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="lede">{lede}</p>
        <nav className="doc-toc" aria-label="目次">
          {chapters.map((c) => (
            <a
              key={c.id}
              className="chip-btn"
              href={href({ name: page, section: c.id })}
              aria-current={section === c.id ? 'location' : undefined}
            >
              {c.title}
            </a>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

/** 章。id は「ページ名-章」（#/about/staff なら about-staff） */
export function DocSection({
  page,
  chapter,
  eyebrow,
  seed,
  children,
}: {
  page: 'about' | 'post';
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
      <Parchment seed={seed} curl={30}>
        <div className="doc">
          {eyebrow && <div className="eyebrow doc-eyebrow">{eyebrow}</div>}
          <h2 id={`${page}-${chapter.id}-h`}>{chapter.title}</h2>
          {children}
        </div>
      </Parchment>
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
