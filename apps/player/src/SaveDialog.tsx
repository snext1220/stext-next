import type { GameState } from '@stext/core';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadSlots, saveSlots, type SaveSlot } from './storage.js';

export function SaveDialog({
  id,
  state,
  onLoad,
  onClose,
}: {
  id: string;
  state?: GameState;
  onLoad: (state: GameState) => void | Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'save' | 'load'>(state && !state.isEnded ? 'save' : 'load');
  const [initial] = useState(() => {
    try {
      return { slots: loadSlots(id), error: null };
    } catch (e) {
      return {
        slots: [],
        error: `スロットを読み込めません：${e instanceof Error ? e.message : String(e)}`,
      };
    }
  });
  const [slots, setSlots] = useState<(SaveSlot | null)[]>(initial.slots);
  const [error, setError] = useState<string | null>(initial.error);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busyRef.current) onClose();
      } else if (event.key === 'Tab' && dialog.current) {
        const elements = Array.from(
          dialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        );
        if (!elements.length) return;
        const first = elements[0]!;
        const last = elements[elements.length - 1]!;
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === dialog.current) {
          event.preventDefault();
          first.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus();
    };
  }, [onClose]);

  const update = (index: number, slot: SaveSlot | null) => {
    try {
      const next = slots.map((item, i) => (i === index ? slot : item));
      saveSlots(id, next);
      setSlots(next);
      setError(null);
    } catch (e) {
      setError(`保存できません：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const load = async (slot: SaveSlot) => {
    if (
      !window.confirm('このデータをロードします。現在の自動保存は上書きされます。よろしいですか？')
    )
      return;
    setBusy(true);
    busyRef.current = true;
    try {
      await onLoad(slot.state);
      onClose();
    } catch (e) {
      setError(`ロードできません：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <div className="save-dialog-backdrop">
      <div
        ref={dialog}
        className="save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        tabIndex={-1}
      >
        <h2 id="save-dialog-title">セーブ／ロード</h2>
        {state && !state.isEnded && (
          <div className="save-dialog-modes">
            <button
              type="button"
              className="chip-btn"
              aria-pressed={mode === 'save'}
              onClick={() => setMode('save')}
            >
              セーブ
            </button>
            <button
              type="button"
              className="chip-btn"
              aria-pressed={mode === 'load'}
              onClick={() => setMode('load')}
            >
              ロード
            </button>
          </div>
        )}
        <p>
          戦闘中にロードすると敵やダイス、戦利品の取得状態は初期化されます。取得済みの戦利品は持ち物に残り、再取得できる場合があります。
        </p>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <ol className="save-slots">
          {slots.map((slot, index) => (
            <li key={index}>
              <div>
                <strong>スロット {index + 1}</strong>
                {slot ? (
                  <div>
                    {new Date(slot.savedAt).toLocaleString()} · {slot.state.chara.name} · 節{' '}
                    {String(slot.state.scene)}
                  </div>
                ) : (
                  <div>空き</div>
                )}
              </div>
              <div className="save-slot-actions">
                {mode === 'save' && state && !state.isEnded ? (
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={busy}
                    onClick={() => {
                      if (!slot || window.confirm(`スロット ${index + 1} を上書きしますか？`))
                        update(index, { savedAt: new Date().toISOString(), state });
                    }}
                  >
                    セーブ
                  </button>
                ) : (
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={!slot || busy}
                    onClick={() => slot && void load(slot)}
                  >
                    ロード
                  </button>
                )}
                {slot && (
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`スロット ${index + 1} を削除しますか？`))
                        update(index, null);
                    }}
                  >
                    削除
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>,
    document.body,
  );
}
