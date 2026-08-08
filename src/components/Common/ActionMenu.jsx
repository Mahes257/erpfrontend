import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

const MENU_MARGIN = 8;
const MENU_MAX_HEIGHT = '70vh';

export default function ActionMenu({
  groups = [],
  align = 'right',
  trigger: TriggerIcon = MoreVertical,
  triggerClassName = '',
  menuClassName = '',
  ariaLabel = 'More actions',
  onOpenChange
}) {
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState(null); // { visible, top, left, position }
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setPopup(null);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const openMenu = useCallback(() => {
    setOpen(true);
    setPopup({ visible: false, top: -9999, left: -9999, position: 'down' });
    onOpenChange?.(true);
  }, [onOpenChange]);

  // ESC to close
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // Outside click: the popup is portaled to body, so check both the trigger
  // container and the portaled popup before treating a pointer as "outside".
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const inTrigger = containerRef.current && containerRef.current.contains(e.target);
      const inPopup = popupRef.current && popupRef.current.contains(e.target);
      if (!inTrigger && !inPopup) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, close]);

  // Position the popup within the viewport. Runs once the popup is rendered
  // (hidden, off-screen) so its real height can be measured, then decides the
  // opening direction based on available space below/above the trigger.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const triggerEl = triggerRef.current;
    const popupEl = popupRef.current;
    if (!triggerEl || !popupEl) return undefined;

    const place = () => {
      const rect = triggerEl.getBoundingClientRect();
      const popupHeight = popupEl.offsetHeight;
      const popupWidth = popupEl.offsetWidth || 240;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxH = Math.round(vh * 0.7);
      const menuHeight = Math.min(popupHeight, maxH);
      const spaceBelow = vh - rect.bottom - MENU_MARGIN;
      const spaceAbove = rect.top - MENU_MARGIN;

      let position;
      if (spaceBelow >= menuHeight) position = 'down';
      else if (spaceAbove >= menuHeight) position = 'up';
      else position = spaceBelow >= spaceAbove ? 'down' : 'up';

      let top;
      if (position === 'down') {
        top = Math.min(rect.bottom + MENU_MARGIN, vh - menuHeight - MENU_MARGIN);
      } else {
        top = Math.max(rect.top - MENU_MARGIN - menuHeight, MENU_MARGIN);
      }

      let left;
      if (align === 'right') {
        left = Math.max(MENU_MARGIN, Math.min(rect.right - popupWidth, vw - popupWidth - MENU_MARGIN));
      } else {
        left = Math.max(MENU_MARGIN, Math.min(rect.left, vw - popupWidth - MENU_MARGIN));
      }

      setPopup((prev) => {
        if (prev && prev.visible && prev.top === top && prev.left === left && prev.position === position) {
          return prev;
        }
        return { visible: true, top, left, position };
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => item.hidden !== true && item.visible !== false)
    }))
    .filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) return null;

  const handleToggle = () => {
    if (open) close();
    else openMenu();
  };

  const handleItemClick = (item) => {
    close();
    item.onClick?.();
  };

  const positionClass = popup?.position === 'up' ? 'origin-bottom' : 'origin-top';

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all inline-block cursor-pointer ${triggerClassName}`}
      >
        <TriggerIcon className="w-4 h-4" />
      </button>
      {open &&
        popup &&
        createPortal(
          <div
            ref={popupRef}
            role="menu"
            style={{
              top: popup.top,
              left: popup.left,
              maxHeight: MENU_MAX_HEIGHT,
              visibility: popup.visible ? 'visible' : 'hidden'
            }}
            className={`fixed z-[70] w-max min-w-[150px] max-w-[240px] whitespace-nowrap bg-surface border border-slate-200 rounded-xl shadow-[0_10px_40px_rgba(15,23,42,0.14)] py-1.5 font-medium text-left overflow-x-hidden overflow-y-auto overscroll-contain ${positionClass} ${
              popup.visible ? 'animate-in fade-in zoom-in-95' : ''
            } ${menuClassName}`}
          >
            {visibleGroups.map((group, index) => (
              <div key={group.title || index} className="py-0.5">
                {index > 0 && <div className="my-1 border-t border-slate-100" />}
                {group.title && (
                  <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 select-none">
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const disabled = item.disabled;
                  const comingSoon = item.comingSoon;
                  return (
                    <button
                      key={item.key}
                      role="menuitem"
                      disabled={disabled || comingSoon}
                      title={comingSoon ? 'Coming Soon' : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(item);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
                        comingSoon
                          ? 'text-slate-300 cursor-not-allowed select-none'
                          : item.danger
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-slate-700 hover:bg-slate-50'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {Icon && (
                        <Icon className={`w-4 h-4 shrink-0 ${comingSoon ? 'text-slate-300' : item.danger ? 'text-rose-500' : 'text-slate-400'}`} />
                      )}
                      <span className="truncate">{item.label}</span>
                      {comingSoon && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-300 bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0">
                          Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
