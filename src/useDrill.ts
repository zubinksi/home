import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type TouchEvent } from 'react';

export type Motion = 'push' | 'pop' | 'next' | 'prev';

/**
 * List ⇄ detail on phones. On wide screens it's just a selection; on phones the
 * list is the home view and a row opens its detail as its own URL (so Back and
 * the phone's back gesture work), with slide transitions, next / previous and
 * left / right swipes.
 */
export function useDrill(opts: {
  narrow: boolean;
  sub: string | null; // the route's detail segment, when this tab is showing
  keys: string[]; // every key that can be opened
  sequence: string[]; // keys that next / previous step through
  defaultKey: string;
  openSub: (k: string) => void;
  replaceSub: (k: string) => void;
  closeSub: () => void;
  panelRef: RefObject<HTMLElement>;
}) {
  const { narrow, sub, keys, sequence, defaultKey, openSub, replaceSub, closeSub, panelRef } = opts;
  const [selKey, setSelKey] = useState(defaultKey);
  const routeKey = sub && keys.includes(sub) ? sub : null;
  const detailOpen = narrow && routeKey !== null;

  useEffect(() => {
    if (routeKey) setSelKey(routeKey);
  }, [routeKey]);

  const motion = useRef<Motion>('push');
  const wasOpen = useRef(detailOpen);
  const listScroll = useRef(0);
  if (wasOpen.current !== detailOpen) {
    if (!detailOpen) motion.current = 'pop';
    else if (motion.current === 'pop') motion.current = 'push';
  }

  useLayoutEffect(() => {
    if (wasOpen.current === detailOpen) return;
    wasOpen.current = detailOpen;
    if (detailOpen) {
      // start the detail at the top of its panel
      const el = panelRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 12;
        if (window.scrollY > top) window.scrollTo(0, top);
      }
    } else {
      window.scrollTo(0, listScroll.current);
    }
  }, [detailOpen, panelRef]);

  const select = (key: string) => {
    setSelKey(key);
    if (narrow) {
      listScroll.current = window.scrollY;
      motion.current = 'push';
      openSub(key);
    }
  };

  const at = sequence.indexOf(selKey);
  const step = (delta: 1 | -1) => {
    if (at < 0) return;
    const next = sequence[(at + delta + sequence.length) % sequence.length];
    motion.current = delta > 0 ? 'next' : 'prev';
    setSelKey(next);
    replaceSub(next);
  };

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || at < 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
  };

  return {
    selKey,
    setSelKey,
    detailOpen,
    showList: !narrow || !detailOpen,
    showDetail: !narrow || detailOpen,
    gridClass: narrow ? (detailOpen ? 'm-detail' : 'm-list') : '',
    listClass: narrow && motion.current === 'pop' ? 'anim-pop' : '',
    detailClass: narrow ? `anim-${motion.current}` : '',
    detailKey: narrow ? `m-${selKey}` : 'detail',
    touchHandlers: narrow ? { onTouchStart, onTouchEnd } : {},
    select,
    step,
    position: at >= 0 ? { index: at + 1, count: sequence.length } : null,
    back: closeSub,
  };
}
