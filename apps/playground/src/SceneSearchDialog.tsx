import type { Scenario } from '@stext/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchScenes } from './sceneSearch.js';

export function SceneSearchDialog({
  scenario,
  onSelect,
  onClose,
}: {
  scenario: Scenario;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchScenes(scenario.scenes, query), [scenario.scenes, query]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    input.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <div className="pg-dialog-backdrop" onClick={onClose}>
      <section
        className="pg-dialog pg-scene-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pg-scene-search-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <header className="pg-dialog-head">
          <h2 id="pg-scene-search-title">シーンを検索</h2>
          <span className="pg-spacer" />
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="pg-dialog-body pg-scene-search-body">
          <label className="pg-scene-search-input">
            <span>サマリー・本文・選択肢を検索</span>
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p className="pg-hint" aria-live="polite">
            {query.trim() ? `${matches.length} シーン` : '検索する文字を入力してください。'}
          </p>
          {query.trim() && matches.length === 0 && (
            <p className="pg-hint">該当するシーンはありません。</p>
          )}
          {matches.length > 0 && (
            <ul className="pg-scene-search-results">
              {matches.map(({ scene, fields, excerpt }) => (
                <li key={scene.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(scene.id)}
                    aria-label={`§${scene.id}：${scene.summary || '（サマリーなし）'}`}
                  >
                    <strong>
                      §{scene.id}：{scene.summary || '（サマリーなし）'}
                    </strong>
                    <span>{fields.join('・')}</span>
                    <small>{excerpt}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
