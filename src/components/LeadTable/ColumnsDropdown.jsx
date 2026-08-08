import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Columns, Search, Check, X, RotateCcw } from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside';
import useFloatingMenu from '../../hooks/useFloatingMenu';

export default function ColumnsDropdown({
  columns = [],
  onToggle,
  onSetHidden = null,
  disabledKeys = ['actions'],
  buttonLabel = 'Columns',
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const { triggerRef, menuRef } = useFloatingMenu({ open });

  useClickOutside([ref, menuRef], () => setOpen(false), open);

  const selectable = columns.filter((col) => !disabledKeys.includes(col.key));
  const hiddenCount = selectable.filter((col) => col.visible === false).length;
  const query = search.trim().toLowerCase();
  const filtered = query ? selectable.filter((col) => col.label.toLowerCase().includes(query)) : selectable;
  const allVisibleInList = filtered.length > 0 && filtered.every((col) => col.visible !== false);

  const handleSelectAll = () => onSetHidden?.([]);
  const handleClearAll = () => onSetHidden?.(selectable.map((col) => col.key));
  const handleReset = () => onSetHidden?.([]);

  return (
    <div
      className="relative"
      ref={(node) => {
        ref.current = node;
        triggerRef.current = node;
      }}
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg transition-colors cursor-pointer select-none ${className}`}
      >
        <Columns className="w-3.5 h-3.5 text-slate-400" />
        <span>{buttonLabel}</span>
        {hiddenCount > 0 && (
          <span className="bg-[#0B4A3D] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{hiddenCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="w-60 bg-surface border border-slate-200 rounded-xl shadow-lg py-1 animate-in fade-in zoom-in-95"
          >
          <div className="px-3 py-2 border-b border-slate-100 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Show / Hide Columns</div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search columns..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {onSetHidden && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSelectAll}
                  className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                    allVisibleInList
                      ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                      : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                  }`}
                  disabled={allVisibleInList}
                >
                  <Check className="w-3 h-3" /> Select All
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-md text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear All
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-md text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center font-medium">No matching columns</div>
            )}
            {filtered.map((col) => {
              const isVisible = col.visible !== false;
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle?.(col.key)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={isVisible}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#0B4A3D] focus:ring-[#0B4A3D]/20 accent-[#0B4A3D] pointer-events-none"
                  />
                  <span className={`text-xs ${isVisible ? 'font-semibold text-slate-700' : 'font-medium text-slate-400'}`}>
                    {col.label}
                  </span>
                </button>
              );
            })}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}
