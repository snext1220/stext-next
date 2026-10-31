export interface Toast {
  id: number;
  kind: 'item' | 'result' | 'dmg' | 'warn' | 'info';
  title: string;
  message: string;
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="k">{t.title}</div>
          {t.message}
        </div>
      ))}
    </div>
  );
}
