import { useEffect, useId, useRef, useState } from 'react';
import { href, type Route, type SimplePage } from '../router.js';

type MenuPage = SimplePage | 'about';
type MenuEntry =
  | { readonly page: MenuPage; readonly label: string }
  | { readonly label: string; readonly items: readonly MenuEntry[] };

/** ヘッダーのサブメニュー */
export const MENU: readonly { label: string; items: readonly MenuEntry[] }[] = [
  {
    label: '案内所',
    items: [
      { page: 'about', label: 'ソーサリアンTextとは？' },
      { page: 'records', label: '冒険の記録' },
      { page: 'music', label: '音楽室' },
      {
        label: '作品の広場',
        items: [
          { page: 'gallery', label: '画廊' },
          { page: 'staff', label: '作り手たち' },
          { page: 'links', label: '関連リンク' },
        ],
      },
    ],
  },
  {
    label: '制作工房',
    items: [
      { page: 'materials', label: '制作者向けの素材' },
      { page: 'recruit', label: '募集中の企画' },
      { page: 'convert', label: '記録の変換所' },
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
      {route.name !== 'play' && (
        <a
          className="chip-btn post-link"
          aria-current={route.name === 'post' ? 'page' : undefined}
          href={href({ name: 'post' })}
        >
          作品を投稿
        </a>
      )}
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
  items: readonly MenuEntry[];
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
        data-active={hasCurrentPage(items, current) || undefined}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      <ul id={listId} className="submenu-list" hidden={!open}>
        {open && <MenuEntries items={items} current={current} onNavigate={() => setOpen(false)} />}
      </ul>
    </div>
  );
}

function MenuEntries({
  items,
  current,
  onNavigate,
}: {
  items: readonly MenuEntry[];
  current: Route['name'];
  onNavigate: () => void;
}) {
  return items.map((item) => (
    <li key={item.label}>
      {'page' in item ? (
        <a
          href={href({ name: item.page })}
          aria-current={item.page === current ? 'page' : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </a>
      ) : (
        <NestedSubMenu item={item} current={current} onNavigate={onNavigate} />
      )}
    </li>
  ));
}

function NestedSubMenu({
  item,
  current,
  onNavigate,
}: {
  item: Extract<MenuEntry, { items: readonly MenuEntry[] }>;
  current: Route['name'];
  onNavigate: () => void;
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
      className="submenu submenu-nested"
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
        className="submenu-item-button"
        aria-expanded={open}
        aria-controls={listId}
        data-active={hasCurrentPage(item.items, current) || undefined}
        onClick={() => setOpen(!open)}
      >
        {item.label}
      </button>
      <ul id={listId} className="submenu-list submenu-list-nested" hidden={!open}>
        {open && (
          <MenuEntries
            items={item.items}
            current={current}
            onNavigate={() => {
              setOpen(false);
              onNavigate();
            }}
          />
        )}
      </ul>
    </div>
  );
}

function hasCurrentPage(items: readonly MenuEntry[], current: Route['name']): boolean {
  return items.some((item) =>
    'page' in item ? item.page === current : hasCurrentPage(item.items, current),
  );
}
