import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import masterService from '../../services/masterService';
import {
  APPROVAL_STATUSES,
  CPR_STATUSES,
  DEPARTMENTS as FALLBACK_DEPARTMENTS
} from '../../utils/cprMock';

export default function CprFilterPanel({ open, filters, onChange, onReset }) {
  // Department options come from the backend master list (/masters/pr_departments)
  // so new departments added via the CPR form appear here after refresh; falls
  // back to the original hardcoded list if the master endpoint is unreachable.
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);

  useEffect(() => {
    let cancelled = false;
    masterService
      .list('pr_departments')
      .then((res) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        const values = data.map((d) => (typeof d === 'string' ? d : d?.value)).filter(Boolean);
        if (!cancelled && values.length > 0) setDepartments(values);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const FILTERS = [
    { key: 'no', label: 'PR No', type: 'text', placeholder: 'Search PR No...' },
    { key: 'client', label: 'Client', type: 'text', placeholder: 'Search client...' },
    { key: 'lead', label: 'Lead No', type: 'text', placeholder: 'Search lead...' },
    { key: 'department', label: 'Department', type: 'select', options: departments, placeholder: 'All Departments' },
    { key: 'salesPerson', label: 'Sales Executive', type: 'text', placeholder: 'Search executive...' },
    { key: 'status', label: 'Status', type: 'select', options: CPR_STATUSES.map((s) => s.label), placeholder: 'All Statuses' },
    { key: 'approval', label: 'Approval Status', type: 'select', options: APPROVAL_STATUSES.map((s) => s.label), placeholder: 'All' },
    { key: 'stage', label: 'Current Stage', type: 'select', options: CPR_STATUSES.map((s) => s.label), placeholder: 'All Stages' },
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
  ];

  return (
    <div className="bg-surface border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {FILTERS.map((field) => (
          <div key={field.key} className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{field.label}</span>
            {field.type === 'select' ? (
              <select
                value={filters[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50 cursor-pointer"
              >
                <option value="">{field.placeholder}</option>
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
