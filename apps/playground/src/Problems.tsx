import type { Problem } from './checks.js';

export function Problems({
  problems,
  onSelect,
}: {
  problems: Problem[];
  onSelect: (sceneId: string) => void;
}) {
  if (problems.length === 0) return <p className="pg-hint pg-ok">✓ 問題は見つかりませんでした。</p>;
  const sorted = [...problems].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
  return (
    <ul className="pg-problems">
      {sorted.map((p, i) => (
        <li key={i} className={p.severity}>
          <span className="lv">{p.severity === 'error' ? 'エラー' : '警告'}</span>
          {p.sceneId ? (
            <button type="button" onClick={() => onSelect(p.sceneId!)}>
              §{p.sceneId}
            </button>
          ) : (
            <code>{p.path}</code>
          )}
          <span>{p.message}</span>
        </li>
      ))}
    </ul>
  );
}
