/**
 * フロー図と右の編集パネルの境目。ドラッグや矢印キーで右パネルの幅を変え、ブラウザに覚えておく。
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const KEY = 'stext-next:playground:side-width';
/** 右パネルの最小幅（playground.css の .pg-main と合わせる） */
const SIDE_MIN = 360;
/** フロー図に残す最小幅（playground.css の .pg-main と合わせる） */
const FLOW_MIN = 280;
const STEP = 16;

function load(): number | undefined {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v >= SIDE_MIN ? v : undefined;
  } catch {
    return undefined;
  }
}

function save(width: number | undefined) {
  try {
    if (width === undefined) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(Math.round(width)));
  } catch {
    // 覚えておけなくても幅は変えられる
  }
}

/** 右パネルの幅（px）。undefined なら CSS の既定の幅 */
export function useSideWidth() {
  return useState<number | undefined>(load);
}

function partsOf(el: HTMLElement | null) {
  const main = el?.parentElement;
  const side = el?.nextElementSibling;
  return el && main && side ? { el, main, side } : undefined;
}

const maxOf = (main: Element, el: Element) =>
  Math.max(SIDE_MIN, main.clientWidth - FLOW_MIN - el.getBoundingClientRect().width);

export function Splitter({
  width,
  onChange,
}: {
  width: number | undefined;
  onChange: (width: number | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);
  // 読み上げ用に、実際の幅と動かせる範囲を追う
  const [now, setNow] = useState(0);
  const [max, setMax] = useState(SIDE_MIN);

  const clamp = (w: number) => {
    const p = partsOf(ref.current);
    return p ? Math.round(Math.min(Math.max(w, SIDE_MIN), maxOf(p.main, p.el))) : w;
  };

  useEffect(() => {
    const p = partsOf(ref.current);
    if (!p) return;
    const ro = new ResizeObserver(() => {
      setNow(Math.round(p.side.getBoundingClientRect().width));
      setMax(Math.round(maxOf(p.main, p.el)));
    });
    ro.observe(p.side);
    ro.observe(p.main);
    return () => ro.disconnect();
  }, []);

  const resize = (w: number | undefined, done: boolean) => {
    const next = w === undefined ? undefined : clamp(w);
    onChange(next);
    if (done) save(next);
  };
  const fromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = partsOf(ref.current);
    if (!p) return width;
    const rect = p.main.getBoundingClientRect();
    return rect.right - e.clientX - p.el.getBoundingClientRect().width / 2;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? STEP * 4 : STEP;
    const current = width ?? now;
    const next =
      e.key === 'ArrowLeft'
        ? current + step
        : e.key === 'ArrowRight'
          ? current - step
          : e.key === 'Home'
            ? max
            : e.key === 'End'
              ? SIDE_MIN
              : undefined;
    if (next === undefined) return;
    e.preventDefault();
    resize(next, true);
  };

  return (
    <div
      ref={ref}
      className={`pg-splitter${dragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="フロー図と編集パネルの境目"
      aria-valuemin={SIDE_MIN}
      aria-valuemax={max}
      aria-valuenow={width ?? now}
      aria-valuetext={`編集パネルの幅 ${width ?? now}px`}
      title="ドラッグで幅を変えます（ダブルクリックで元の幅）"
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        moved.current = false;
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        moved.current = true;
        resize(fromPointer(e), false);
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        // クリックだけでは幅を決めない（既定の幅のままにしておく）
        if (moved.current) resize(fromPointer(e), true);
      }}
      onPointerCancel={() => {
        setDragging(false);
        save(width);
      }}
      onDoubleClick={() => resize(undefined, true)}
      onKeyDown={onKeyDown}
    />
  );
}
