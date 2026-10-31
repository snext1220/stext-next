import { useEffect, useState } from 'react';

export type Route =
  | { name: 'library'; quest?: boolean }
  | { name: 'create'; id: string }
  | { name: 'play'; id: string }
  | { name: 'convert' }
  | { name: 'records' }
  | { name: 'music' }
  | { name: 'about'; section?: string }
  | { name: 'post'; section?: string };

/** #/play/scepter のようなハッシュを読む */
export function parseRoute(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  if ((name === 'play' || name === 'create') && id) return { name, id: decodeURIComponent(id) };
  if (name === 'convert' || name === 'records' || name === 'music') return { name };
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
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/** 案内・投稿の章（#/about/staff など）を開いたら、その見出しまでスクロールする */
export function useSectionScroll(prefix: string, section: string | undefined) {
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(`${prefix}-${section}`);
    // jsdom には scrollIntoView がない
    el?.scrollIntoView?.({ block: 'start' });
  }, [prefix, section]);
}
