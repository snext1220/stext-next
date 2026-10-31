/**
 * ダイナミックヘルプ。旧 Playground と同じく、項目名のダブルクリック（または「?」）で、その項目の説明を開く。
 */
import { renderMarkdown } from '@stext/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { HELP, MARK_KINDS, searchHelp, type HelpEntry, type MarkKind } from './help.js';

/** ヘルプを開く関数。Provider の外では null（ヘルプのボタンを出さない） */
export const HelpContext = createContext<((topic: string) => void) | null>(null);

export function useHelp() {
  return useContext(HelpContext);
}

export function HelpButton({ topic }: { topic: string }) {
  const open = useHelp();
  if (!open) return null;
  return (
    <button
      type="button"
      className="pg-help-button"
      onClick={() => open(topic)}
      title="この項目のヘルプ"
      aria-label="ヘルプ"
      data-help={topic}
    >
      ?
    </button>
  );
}

/** 目次を表すトピック */
export const HELP_INDEX = '';

/** ヘルプの状態（開いた項目の履歴）を持ち、開いているときはパネルを表示する */
export function HelpProvider({ children }: { children: ReactNode }) {
  // 最後が表示中の項目。空なら閉じている
  const [stack, setStack] = useState<string[]>([]);
  const open = useCallback((topic: string) => setStack((s) => [...s, topic]), []);
  const close = useCallback(() => setStack([]), []);
  return (
    <HelpContext.Provider value={open}>
      {children}
      {stack.length > 0 && (
        <HelpPanel
          topic={stack[stack.length - 1]!}
          canBack={stack.length > 1}
          onNavigate={open}
          onBack={() => setStack((s) => s.slice(0, -1))}
          onClose={close}
        />
      )}
    </HelpContext.Provider>
  );
}

export function HelpPanel({
  topic,
  canBack,
  onNavigate,
  onBack,
  onClose,
}: {
  topic: string;
  canBack: boolean;
  onNavigate: (topic: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const entry = topic === HELP_INDEX ? undefined : HELP.get(topic);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    panel.current?.querySelector('.pg-help-content')?.scrollTo(0, 0);
  }, [topic]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 本文のリンク：#help/キー はヘルプの中で移動し、外部のリンクは別のタブで開く
  const onLinkClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    if (href.startsWith('#help/')) onNavigate(decodeURIComponent(href.slice(6)));
    else if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
  };

  const title = topic === HELP_INDEX ? 'ヘルプの目次' : (entry?.title ?? 'ヘルプ');

  return (
    <div className="pg-help-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="pg-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-help-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pg-help-head">
          <h2 id="pg-help-title">{title}</h2>
          {entry && <code className="pg-help-key">{entry.key}</code>}
          <span className="pg-spacer" />
          <button type="button" onClick={onBack} disabled={!canBack}>
            ← 戻る
          </button>
          <button
            type="button"
            onClick={() => onNavigate(HELP_INDEX)}
            disabled={topic === HELP_INDEX}
          >
            目次
          </button>
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="pg-help-content" onClick={onLinkClick}>
          {topic === HELP_INDEX ? (
            <HelpIndex onNavigate={onNavigate} />
          ) : entry ? (
            <HelpArticle entry={entry} onNavigate={onNavigate} />
          ) : (
            <p className="pg-hint">「{topic}」のヘルプはまだありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HelpArticle({
  entry,
  onNavigate,
}: {
  entry: HelpEntry;
  onNavigate: (topic: string) => void;
}) {
  const html = useMemo(() => renderMarkdown(entry.body), [entry]);
  return (
    <>
      {entry.marks.length > 0 && (
        <aside className="pg-help-marks" aria-label="旧リファレンスからの移行メモ">
          <h3>旧リファレンスからの移行メモ</h3>
          <ul>
            {entry.marks.map((m, i) => (
              <li key={i}>
                <MarkBadge kind={m.kind} />{' '}
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text, true) }} />
              </li>
            ))}
          </ul>
        </aside>
      )}
      <div className="pg-help-body" dangerouslySetInnerHTML={{ __html: html }} />
      {entry.related.length > 0 && (
        <nav className="pg-help-related" aria-label="関連する項目">
          <h3>関連する項目</h3>
          <ul>
            {entry.related.map((k) => (
              <li key={k}>
                <button type="button" onClick={() => onNavigate(k)}>
                  → {HELP.get(k)?.title ?? k}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

function MarkBadge({ kind }: { kind: MarkKind }) {
  return <span className={`pg-mark mark-${MARK_KINDS.indexOf(kind)}`}>{kind}</span>;
}

function HelpIndex({ onNavigate }: { onNavigate: (topic: string) => void }) {
  const [query, setQuery] = useState('');
  const [mark, setMark] = useState<'' | 'any' | MarkKind>('');
  const hits = useMemo(() => {
    const found = new Set(searchHelp(HELP, query));
    return HELP.categories
      .map((c) => ({
        name: c.name,
        entries: c.entries.filter(
          (e) =>
            found.has(e) &&
            (mark === '' ||
              (mark === 'any' ? e.marks.length > 0 : e.marks.some((m) => m.kind === mark))),
        ),
      }))
      .filter((c) => c.entries.length > 0);
  }, [query, mark]);
  return (
    <div className="pg-help-index">
      <div className="pg-inline">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ヘルプを検索（例：BGM、条件、${if）"
          aria-label="ヘルプを検索"
        />
        <select
          value={mark}
          onChange={(e) => setMark(e.target.value as typeof mark)}
          aria-label="移行メモで絞り込む"
        >
          <option value="">すべての項目</option>
          <option value="any">移行メモのある項目</option>
          {MARK_KINDS.map((k) => (
            <option key={k} value={k}>
              移行メモ：{k}
            </option>
          ))}
        </select>
      </div>
      <p className="pg-hint">
        各欄の「?」や項目名のダブルクリックでも、その項目のヘルプを開けます。
      </p>
      {hits.length === 0 && <p className="pg-hint">見つかりませんでした。</p>}
      {hits.map((c) => (
        <section key={c.name}>
          <h3>{c.name}</h3>
          <ul>
            {c.entries.map((e) => (
              <li key={e.key}>
                <button type="button" onClick={() => onNavigate(e.key)}>
                  {e.title}
                </button>
                {e.marks.map((m, i) => (
                  <MarkBadge key={i} kind={m.kind} />
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
