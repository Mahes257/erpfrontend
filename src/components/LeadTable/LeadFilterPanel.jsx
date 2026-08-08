import { X } from 'lucide-react';
import { LEAD_STATUSES, STAGE_FILTER_OPTIONS, LEAD_PRIORITIES, LEAD_SOURCES } from '../../utils/leadConstants';

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: LEAD_STATUSES.map((s) => s.value), placeholder: 'All Statuses' },
  { key: 'stage', label: 'Stage', type: 'select', options: STAGE_FILTER_OPTIONS.map((s) => s.value), placeholder: 'All Stages' },
  { key: 'source', label: 'Source', type: 'select', options: LEAD_SOURCES, placeholder: 'All Sources' },
  { key: 'priority', label: 'Priority', type: 'select', options: LEAD_PRIORITIES.map((p) => p.value), placeholder: 'All Priorities' },
  { key: 'owner', label: 'Owner', type: 'select', options: undefined, placeholder: 'All Owners' },
  { key: 'dateFrom', label: 'Date From', type: 'date' },
  { key: 'dateTo', label: 'Date To', type: 'date' }
];

export default function LeadFilterPanel({ filters, onChange, onReset, ownerOptions = [] }) {
  return (
    <div className="bg-surface border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="lead-filter-grid">
        {FILTER_FIELDS.map((field) => {
          const isOwner = field.key === 'owner';
          const options = isOwner ? ownerOptions : field.options;
          return (
            <div key={field.key} className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{field.label}</span>
              {field.type === 'select' ? (
                <select
                  value={filters[field.key] || ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50 cursor-pointer"
                >
                  <option value="">{field.placeholder}</option>
                  {options.map((option) => {
                    const value = typeof option === 'string' ? option : option.value;
                    const label = typeof option === 'string' ? option : option.label || option.value;
                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    );
                  })}
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
          );
        })}

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
