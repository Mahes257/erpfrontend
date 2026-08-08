import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import leadService from '../../services/leadService';
import useAsyncData from '../../hooks/useAsyncData';
import DetailSection from './DetailSection';
import { formatDateTime } from '../../utils/leadHelpers';

function toList(response) {
  const list = Array.isArray(response) ? response : response?.data ?? response?.history ?? response?.content ?? [];
  return list.map((entry) => ({
    id: entry.id,
    date: entry.at || entry.date || entry.createdAt,
    field: entry.field || entry.attribute || 'Lead',
    oldValue: entry.oldValue ?? entry.from ?? entry.old ?? '',
    newValue: entry.newValue ?? entry.to ?? entry.value ?? entry.new ?? '',
    changedBy: entry.changedBy || entry.by || entry.actor || entry.user || '',
    action: entry.action || (entry.field ? 'UPDATED' : 'CREATED')
  }));
}

const ACTION_CHIPS = {
  CREATED: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  UPDATED: 'bg-amber-50 text-amber-600 border border-amber-100',
  DELETED: 'bg-rose-50 text-rose-600 border border-rose-100',
  default: 'bg-slate-100 text-slate-500 border border-slate-200'
};

export default function History({ leadId, fallbackData = [] }) {
  const { data, loading, error, isFallback, refresh } = useAsyncData(
    () => leadService.getHistory(leadId),
    { fallbackData, deps: [leadId] }
  );

  const items = useMemo(
    () =>
      toList(data)
        .filter((entry) => entry.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data]
  );

  return (
    <DetailSection
      loading={loading}
      error={error}
      isFallback={isFallback}
      onRetry={refresh}
      count={items.length}
      emptyMessage="No change history recorded for this lead."
    >
      <ul className="space-y-3">
        {items.map((entry) => {
          const action = entry.action || 'default';
          return (
            <li key={entry.id} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ACTION_CHIPS[action] || ACTION_CHIPS.default}`}>
                    {action}
                  </span>
                  <span className="text-[11px] font-bold text-slate-800">{entry.field}</span>
                </div>
                <time className="text-[10px] text-slate-400 font-medium">{formatDateTime(entry.date)}</time>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-400 line-through">{entry.oldValue || '—'}</span>
                <ArrowRight className="w-3 h-3 text-slate-300" />
                <span className="text-xs font-semibold text-slate-800">{entry.newValue || '—'}</span>
                {entry.changedBy && (
                  <span className="ml-auto text-[10px] text-slate-400 font-medium">by {entry.changedBy}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}
