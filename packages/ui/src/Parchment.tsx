import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/** シード付きの乱数（同じシードなら同じ形になる） */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 端がほつれ、ところどころ欠けた輪郭（右下は curl の大きさだけ斜めに切り落とす） */
export function tornPath(w: number, h: number, curl: number, seed: number): string {
  const rnd = mulberry32(seed);
  const pts: [number, number][] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const tx = (x1 - x0) / len;
    const ty = (y1 - y0) / len;
    const n = Math.max(2, Math.round(len / 11));
    for (let i = 0; i < n; i++) {
      const d = (i * len) / n;
      const x = x0 + tx * d;
      const y = y0 + ty * d;
      if (i > 1 && i < n - 3 && rnd() < 0.05) {
        const cw = 12 + rnd() * 14;
        const depth = 3 + rnd() * 6;
        for (let m = 0; m <= 5; m++) {
          const u = m / 5;
          const dd = depth * Math.sin(Math.PI * u) * (0.6 + rnd() * 0.5);
          pts.push([x + tx * cw * u + nx * dd, y + ty * cw * u + ny * dd]);
        }
        i += Math.ceil(cw / (len / n)) - 1;
      } else {
        const j = rnd() * 2.4;
        pts.push([x + nx * j, y + ny * j]);
      }
    }
  };
  edge(0, 0, w, 0, 0, 1);
  edge(w, 0, w, h - curl, -1, 0);
  edge(w, h - curl, w - curl, h, 0, 0);
  edge(w - curl, h, 0, h, 0, -1);
  edge(0, h, 0, 0, 1, 0);
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
}

const STAR = 'M50 9.5L73.8 82.8L11.5 37.5H88.5L26.2 82.8Z';

/** 古びた五芒星の透かし */
export function Pentagram() {
  const marks = Array.from({ length: 5 }, (_, k) => {
    const a = ((-90 + 36 + 72 * k) * Math.PI) / 180;
    return [50 + 43.2 * Math.cos(a), 50 + 43.2 * Math.sin(a)] as const;
  });
  return (
    <svg className="mark" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <filter id="pg-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.7"
            numOctaves={2}
            seed={5}
            result="t"
          />
          <feDisplacementMap in="SourceGraphic" in2="t" scale={1.8} />
        </filter>
        <filter id="pg-wear" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={11} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -3.4 0 0 0 2.45" />
        </filter>
        <mask id="pg-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" filter="url(#pg-wear)" />
        </mask>
      </defs>
      <g mask="url(#pg-mask)" transform="rotate(-7 50 50)">
        <g
          filter="url(#pg-rough)"
          fill="none"
          stroke="var(--ink)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            strokeWidth="2.4"
            strokeDasharray="64 2.6 41 1.8 77 3.4 55 2"
          />
          <circle cx="50" cy="50" r="40.5" strokeWidth="1.1" strokeDasharray="120 1.5 84 2.2" />
          <path d={STAR} strokeWidth="1.9" />
          <path d={STAR} strokeWidth="0.6" transform="translate(.7 .4)" opacity=".5" />
          {marks.map(([x, y], k) => (
            <g key={k} transform={`translate(${x} ${y}) rotate(${36 + 72 * k})`}>
              <path d="M-1.6 0H1.6M0 -1.6V1.6" strokeWidth=".8" />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

export interface ParchmentProps {
  as?: 'div' | 'article' | 'section';
  className?: string;
  style?: CSSProperties;
  /** 輪郭の形を決める数（同じなら同じ形） */
  seed?: number;
  /** 右下のめくれの大きさ（px） */
  curl?: number;
  children?: ReactNode;
}

/** 羊皮紙のページ。端の欠け・右下のめくれ・汚れ・五芒星の透かしを持つ */
export function Parchment({
  as = 'div',
  className = '',
  style,
  seed = 1,
  curl = 46,
  children,
}: ParchmentProps) {
  const ref = useRef<HTMLElement>(null);
  const [clip, setClip] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setClip(tornPath(el.offsetWidth, el.offsetHeight, curl, seed));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [curl, seed]);
  return (
    <div className="parchment">
      {createElement(
        as,
        {
          ref,
          className: `page ${className}`.trim(),
          style: { ...style, clipPath: clip ? `path('${clip}')` : undefined },
        },
        children,
        <Pentagram key="mark" />,
      )}
      <span className="curl" style={{ width: curl, height: curl }} aria-hidden="true" />
    </div>
  );
}
