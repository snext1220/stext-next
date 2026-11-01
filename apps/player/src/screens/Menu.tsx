import { useEffect, useId, useRef, useState } from 'react';
import { href, type Route, type SimplePage } from '../router.js';

type MenuPage = SimplePage | 'about' | 'post';

/** ヘッダーのサブメニュー（書庫のほかは、ここにまとめる） */
export const MENU: readonly { label: string; items: readonly (readonly [MenuPage, string])[] }[] = [
  {
    label: '道具箱',
    items: [
      ['records', '記録'],
      ['convert', '変換所'],
      ['music', '音楽室'],
      ['materials', '制作者向けの素材'],
    ],
  },
  {
    label: '案内所',
    items: [
      ['about', 'ソーサリアン Text とは'],
      ['post', '投稿'],
      ['recruit', '募集中の企画'],
      ['links', '関連リンク'],
      ['gallery', '画廊'],
      ['staff', '作り手たち'],
    ],
  },
];

/** ヘッダーの画面の切り替え */
export function Menu({ route }: { route: Route }) {
  return (
    <nav className="screens" aria-label="画面">
      <a
        className="chip-btn"
        aria-current={route.name === 'library' ? 'page' : undefined}
        href={href({ name: 'library' })}
      >
        書庫
      </a>
      {MENU.map((g) => (
        <SubMenu key={g.label} label={g.label} items={g.items} current={route.name} />
      ))}
    </nav>
  );
}

/** 押すと開くサブメニュー。外を押す、Esc、フォーカスが外へ出る、項目を選ぶ、のどれかで閉じる */
function SubMenu({
  label,
  items,
  current,
}: {
  label: string;
  items: readonly (readonly [MenuPage, string])[];
  current: Route['name'];
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onOutside);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
    };
  }, [open]);

  return (
    <div
      className="submenu"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="chip-btn"
        aria-expanded={open}
        aria-controls={listId}
        data-active={items.some(([name]) => name === current) || undefined}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      <ul id={listId} className="submenu-list" hidden={!open}>
        {items.map(([name, text]) => (
          <li key={name}>
            <a
              href={href({ name })}
              aria-current={name === current ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
