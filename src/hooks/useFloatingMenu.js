/**
 * useFloatingMenu.js
 * ------------------------------------------------------------------
 * Positions a dropdown menu as a fixed, viewport-anchored overlay so the
 * menu is never clipped by cards, forms, tables, tabs, accordions or
 * dialogs. The menu itself is expected to be rendered through
 * createPortal(menu, document.body) by the consumer.
 *
 * The hook styles the menu element imperatively inside a layout effect
 * (position: fixed, top/left, z-index), so there is no visible flash and
 * no render churn. It:
 *   - opens downward when there is room below the trigger,
 *   - flips upward automatically when there is not,
 *   - clamps the menu inside the viewport,
 *   - re-positions on window resize / page scroll while open,
 *   - leaves scrolling of long option lists to the menu's own overflow.
 *
 * Usage:
 *   const { triggerRef, menuRef } = useFloatingMenu({ open, align, matchWidth });
 *   <div ref={triggerRef}>…trigger…</div>
 *   {open && createPortal(<div ref={menuRef} className="…">…</div>, document.body)}
 * ------------------------------------------------------------------
 */
import { useLayoutEffect, useRef } from 'react';

const MENU_GAP = 8;

export default function useFloatingMenu({
  open,
  align = 'right',
  matchWidth = false,
  zIndex = 9999,
  gap = MENU_GAP
} = {}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!open || !trigger || !menu) return undefined;

    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxHeight = Math.round(vh * 0.7);
      const menuHeight = Math.min(menu.offsetHeight, maxHeight);
      const menuWidth = matchWidth
        ? Math.min(rect.width, vw - gap * 2)
        : menu.offsetWidth || 240;
      const spaceBelow = vh - rect.bottom - gap;
      const spaceAbove = rect.top - gap;

      const position =
        spaceBelow >= menuHeight
          ? 'down'
          : spaceAbove >= menuHeight
            ? 'up'
            : spaceBelow >= spaceAbove
              ? 'down'
              : 'up';

      const top =
        position === 'down'
          ? Math.min(rect.bottom + gap, vh - menuHeight - gap)
          : Math.max(rect.top - gap - menuHeight, gap);

      const left =
        align === 'right'
          ? Math.max(gap, Math.min(rect.right - menuWidth, vw - menuWidth - gap))
          : Math.max(gap, Math.min(rect.left, vw - menuWidth - gap));

      menu.style.position = 'fixed';
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      menu.style.zIndex = String(zIndex);
      if (matchWidth) menu.style.width = `${menuWidth}px`;

      // When the menu is taller than the viewport budget, scroll inside the
      // menu instead of letting it clip at the viewport edge. Short menus keep
      // their exact styling (no scrollbar is introduced).
      if (menu.offsetHeight > maxHeight) {
        menu.style.maxHeight = `${maxHeight}px`;
        menu.style.overflowY = 'auto';
      } else {
        menu.style.maxHeight = '';
        menu.style.overflowY = '';
      }

      menu.style.visibility = 'visible';
    };

    // Keep the menu hidden until it has been measured and placed in the
    // same layout-effect tick, so it never flashes at an intermediate spot.
    menu.style.position = 'fixed';
    menu.style.visibility = 'hidden';
    place();

    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      menu.style.visibility = 'hidden';
    };
  }, [open, align, matchWidth, zIndex, gap]);

  return { triggerRef, menuRef };
}
