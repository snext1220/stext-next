import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

/** 文字ごとの演出（旧エンジンの Textillate に当たる）。効果名は animate.css の名前 */
const EFFECTS = new Set([
  'fadeIn',
  'fadeInDown',
  'fadeInUp',
  'fadeInLeft',
  'fadeInRight',
  'bounceIn',
  'zoomIn',
  'flipInX',
  'rollIn',
  'flash',
]);

/** 一文字あたりの遅れ（Textillate の既定値と同じ 50ms） */
const DELAY = 50;

export function Effect({ name, children }: { name: string; children: ReactNode }) {
  const effect = EFFECTS.has(name) ? name : 'fadeIn';
  let index = 0;
  const split = (node: ReactNode): ReactNode =>
    Children.map(node, (child) => {
      if (typeof child === 'string') {
        return [...child].map((ch) =>
          /\s/.test(ch) ? (
            ch
          ) : (
            <span
              key={index}
              className={`stext-letter fx-${effect}`}
              style={{ animationDelay: `${index++ * DELAY}ms` }}
            >
              {ch}
            </span>
          ),
        );
      }
      if (isValidElement(child)) {
        const el = child as ReactElement<{ children?: ReactNode }>;
        return el.props.children === undefined
          ? el
          : cloneElement(el, undefined, split(el.props.children));
      }
      return child;
    });
  return (
    <div className="stext-effect" data-effect={name}>
      {split(children)}
    </div>
  );
}
