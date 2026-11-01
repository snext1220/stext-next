import { useEffect, useState } from 'react';

/** 引数のない画面（道具箱・案内所の項目） */
export const SIMPLE_PAGES = [
  'records',
  'convert',
  'music',
  'materials',
  'recruit',
  'links',
  'gallery',
  'staff',
] as const;
export type SimplePage = (typeof SIMPLE_PAGES)[number];

export type Route =
  | { name: 'library'; quest?: boolean }
  | { name: 'create'; id: string }
  | { name: 'play'; id: string }
  | { name: SimplePage }
  | { name: 'about'; section?: string }
  | { name: 'post'; section?: string };

/** 以前は案内・投稿の章だったもの（#/about/staff など）。今は別の画面 */
const MOVED = new Map<string, Route>([
  ['about/stext', { name: 'about' }],
  ['about/staff', { name: 'staff' }],
  ['about/gallery', { name: 'gallery' }],
  ['about/links', { name: 'links' }],
  ['post/recruit', { name: 'recruit' }],
  ['post/materials', { name: 'materials' }],
]);

const isSimple = (name: string | undefined): name is SimplePage =>
  (SIMPLE_PAGES as readonly (string | undefined)[]).includes(name);

/** 以前の URL なら、移った先の画面 */
function movedRoute(hash: string): Route | undefined {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  return MOVED.get(`${name}/${id ? decodeURIComponent(id) : ''}`);
}

/** #/play/scepter のようなハッシュを読む */
export function parseRoute(hash: string): Route {
  const moved = movedRoute(hash);
  if (moved) return moved;
  const [, name, id] = hash.replace(/^#/, '').split('/');
  if ((name === 'play' || name === 'create') && id) return { name, id: decodeURIComponent(id) };
  if (isSimple(name)) return { name };
  if (name === 'about' || name === 'post')
    return id ? { name, section: decodeURIComponent(id) } : { name };
  // #/library/quest は、アンケートのあるシナリオだけを並べた書庫
  if (name === 'library' && id === 'quest') return { name, quest: true };
  return { name: 'library' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'play':
    case 'create':
      return `#/${route.name}/${encodeURIComponent(route.id)}`;
    case 'about':
    case 'post':
      return route.section
        ? `#/${route.name}/${encodeURIComponent(route.section)}`
        : `#/${route.name}`;
    case 'library':
      return route.quest ? '#/library/quest' : '#/library';
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route) {
  location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/** 今のハッシュを読む。以前の URL なら、アドレス欄も移った先に書き換える */
function readRoute(): Route {
  const route = parseRoute(location.hash);
  if (movedRoute(location.hash)) history.replaceState(history.state, '', href(route));
  return route;
}

/** 案内・投稿の章（#/post/submit など）を開いたら、その見出しまでスクロールする */
export function useSectionScroll(prefix: string, section: string | undefined) {
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(`${prefix}-${section}`);
    // jsdom には scrollIntoView がない
    el?.scrollIntoView?.({ block: 'start' });
  }, [prefix, section]);
}
