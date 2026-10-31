import { useEffect, useState } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'create'; id: string }
  | { name: 'play'; id: string }
  | { name: 'convert' };

/** #/play/scepter のようなハッシュを読む */
export function parseRoute(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  if ((name === 'play' || name === 'create') && id) return { name, id: decodeURIComponent(id) };
  if (name === 'convert') return { name };
  return { name: 'library' };
}

export function href(route: Route): string {
  return route.name === 'play' || route.name === 'create'
    ? `#/${route.name}/${encodeURIComponent(route.id)}`
    : `#/${route.name}`;
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
