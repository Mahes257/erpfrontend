import { X } from 'lucide-react';
import { EditableMasterDropdown } from '../Common';

export default function SalesFilterPanel({ open, filters, onChange, onReset, fields = [] }) {
  if (!open) return null;

  return (
    <div className="bg-surface border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{field.label}</span>
            {field.type === 'select' && field.masterKey ? (
              <EditableMasterDropdown
                masterKey={field.masterKey}
                value={filters[field.key] || ''}
                placeholder={field.placeholder || 'All'}
                onChange={(v) => onChange(field.key, v)}
                inputClassName="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50"
              />
            ) : field.type === 'select' ? (
              <select
                value={filters[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50 cursor-pointer"
              >
                <option value="">{field.placeholder || 'All'}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={filters[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50"
              />
            )}
          </div>
        ))}

        <div className="flex items-end">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}
