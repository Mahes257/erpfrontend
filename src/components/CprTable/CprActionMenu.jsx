import { useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside';

export default function CprActionMenu({ items = [], onAction }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setOpen(false), open);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-md text-slate-400 hover:text-[#0B4A3D] hover:bg-[#E8F0EE] transition-colors cursor-pointer"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[240px] bg-surface border border-slate-200 rounded-xl shadow-lg py-2 z-50"
        >
          {items.map((item, index) =>
            item.heading ? (
              <div
                key={index}
                className="px-3.5 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                {item.label}
              </div>
            ) : item.divider ? (
              <div key={index} className="my-1.5 mx-2 border-t border-slate-200" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAction(item.key);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors cursor-pointer ${
                  item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-[#E8F0EE] hover:text-[#0B4A3D]'
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 shrink-0 ${item.danger ? 'text-rose-500' : 'text-slate-500'}`} />
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
