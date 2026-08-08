/**
 * useClickOutside.js
 * ------------------------------------------------------------------
 * Calls the provided handler when a pointer event occurs outside of
 * the referenced element(s). Powers dropdowns, menus and column panes.
 * Accepts a single ref or an array of refs (e.g. [triggerRef, menuRef]
 * where the menu is rendered in a portal outside the trigger's tree).
 * ------------------------------------------------------------------
 */
import { useEffect } from 'react';

export default function useClickOutside(refs, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const list = Array.isArray(refs) ? refs : [refs];

    const handleClick = (event) => {
      const inside = list.some((ref) => ref.current && ref.current.contains(event.target));
      if (!inside) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [refs, handler, enabled]);
}
