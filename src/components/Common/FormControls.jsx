import { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useFloatingMenu from '../../hooks/useFloatingMenu';

export function FormField({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-[11px] font-semibold text-rose-500">{error}</p>}
    </div>
  );
}

const INPUT_BASE =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-blue-500/60 focus:bg-surface focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] shadow-inner';

export function TextInput({ registration, error, ...rest }) {
  return <input className={`${INPUT_BASE} ${error ? 'border-rose-400' : ''}`} {...registration} {...rest} />;
}

export function SelectInput({ registration, error, children, ...rest }) {
  return (
    <select className={`${INPUT_BASE} ${error ? 'border-rose-400' : ''} cursor-pointer`} {...registration} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({ registration, error, rows = 3, ...rest }) {
  return <textarea rows={rows} className={`${INPUT_BASE} ${error ? 'border-rose-400' : ''}`} {...registration} {...rest} />;
}

export function SearchableSelect({
  value,
  onChange,
  onBlur,
  error,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  className = '',
  creatable = false,
  onCreate
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  // Renders the option list as a fixed overlay via a portal to document.body
  // so it is never clipped by accordions, cards, tables or dialogs.
  const { triggerRef, menuRef } = useFloatingMenu({ open, align: 'left', matchWidth: true, gap: 4 });

  const uniqueOptions = useMemo(() => {
    const seen = new Set();
    return options.filter((opt) => {
      const key = String(opt?.value ?? '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [options]);

  const selected = uniqueOptions.find((opt) => String(opt.value) === String(value));
  const hasValue = value != null && String(value) !== '';

  useEffect(() => {
    const handleClick = (e) => {
      const inControl = containerRef.current && containerRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inControl && !inMenu) {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuRef]);

  const normalizedQuery = query.trim().toLowerCase();
  const exactMatch =
    normalizedQuery !== ''
      ? uniqueOptions.some((opt) => String(opt.label ?? opt.value).toLowerCase() === normalizedQuery)
      : false;
  const filtered = uniqueOptions.filter((opt) =>
    String(opt.label ?? opt.value ?? '').toLowerCase().includes(normalizedQuery)
  );

  const showCreateOption = creatable && query.trim() !== '' && !exactMatch;
  const optionCount = filtered.length + (showCreateOption ? 1 : 0);

  // Keep the keyboard-highlighted index within bounds whenever the list shrinks
  const clampedIndex = optionCount === 0 ? -1 : Math.min(activeIndex, optionCount - 1);

  const display =
    !open || query === '' ? (selected?.label ?? (value != null ? String(value) : '')) : query;

  const commitQuery = () => {
    const raw = query.trim();
    if (!raw) return;
    onChange?.(raw);
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  // Persist a brand-new owner. When onCreate is provided the parent is
  // responsible for saving it (e.g. via the register API); otherwise fall back
  // to committing the raw text locally.
  const handleCreate = () => {
    const raw = query.trim();
    if (!raw) return;
    if (onCreate) {
      onCreate(raw);
    } else {
      onChange?.(raw);
    }
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const handleSelect = (opt) => {
    onChange?.(opt.value);
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const handleClear = () => {
    onChange?.('');
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const activeItem = () => {
    if (clampedIndex < 0 || optionCount === 0) return null;
    if (showCreateOption) {
      if (clampedIndex === 0) return { kind: 'create' };
      return filtered[clampedIndex - 1];
    }
    return filtered[clampedIndex];
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (optionCount === 0 ? -1 : (prev + 1) % optionCount));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) =>
        optionCount === 0 ? -1 : prev <= 0 ? optionCount - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = activeItem();
      if (active) {
        if (active.kind === 'create') handleCreate();
        else handleSelect(active);
      } else if (exactMatch) {
        const match = uniqueOptions.find(
          (opt) => String(opt.label ?? opt.value).toLowerCase() === normalizedQuery
        );
        if (match) handleSelect(match);
      } else if (filtered.length === 1) {
        // Prefer selecting the single existing match over creating a new owner.
        handleSelect(filtered[0]);
      } else if (creatable && query.trim()) {
        // Only create a brand-new owner when nothing matches, so Enter never
        // silently persists a junk owner while existing options partially match.
        if (onCreate) {
          if (filtered.length === 0) handleCreate();
        } else {
          commitQuery();
        }
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
    }
  };

  const handleBlur = () => {
    if (creatable && !onCreate && query.trim() && filtered.length === 0) {
      onChange?.(query.trim());
    }
    setQuery('');
    setActiveIndex(-1);
    onBlur?.();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={triggerRef}
        value={display}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={clampedIndex >= 0 ? `searchable-option-${clampedIndex}` : undefined}
        className={`${INPUT_BASE} ${error ? 'border-rose-400' : ''} cursor-pointer pr-8`}
      />
      {hasValue && !open ? (
        <button
          type="button"
          onClick={handleClear}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Clear selection"
          title="Clear selection"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
          &#9662;
        </span>
      )}
      {open &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            className="max-h-52 overflow-auto bg-surface border border-slate-200 rounded-lg shadow-lg py-1"
          >
          {showCreateOption && (
            <li role="option" aria-selected={clampedIndex === 0}>
              <button
                type="button"
                id="searchable-option-0"
                onClick={handleCreate}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(0)}
                className={`w-full text-left px-3 py-2 text-xs font-semibold text-blue-700 transition-colors cursor-pointer ${
                  clampedIndex === 0 ? 'bg-blue-50' : 'hover:bg-blue-50'
                }`}
              >
                + Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
          {filtered.length === 0 && !showCreateOption && (
            <li className="px-3 py-2 text-xs text-slate-400">No matches</li>
          )}
          {filtered.map((opt, index) => {
            const optionIndex = showCreateOption ? index + 1 : index;
            const active = clampedIndex === optionIndex;
            return (
              <li key={opt.value} role="option" aria-selected={String(opt.value) === String(value)}>
                <button
                  type="button"
                  id={`searchable-option-${optionIndex}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setActiveIndex(optionIndex)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                    String(opt.value) === String(value)
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : active
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label ?? opt.value}
                </button>
              </li>
            );
          })}
          </ul>,
          document.body
        )}
    </div>
  );
}
