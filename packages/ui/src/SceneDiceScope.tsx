import { useEffect, useRef, useState, type ReactNode } from 'react';

export function SceneDiceScope({ children }: { children: ReactNode }) {
  const endRef = useRef<HTMLDivElement>(null);
  const [endVisible, setEndVisible] = useState(false);

  useEffect(() => {
    const end = endRef.current;
    if (!end || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setEndVisible(entry?.isIntersecting ?? false);
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`scene-dice-scope${endVisible ? ' scene-dice-scope--end-visible' : ''}`}>
      {children}
      <div ref={endRef} className="scene-dice-scope-end" aria-hidden="true" />
    </div>
  );
}
