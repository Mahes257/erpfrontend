import { Ban, Calculator, CheckCircle, ClipboardList, Clock, FileText, IndianRupee, PenLine } from 'lucide-react';

const KPI_ICONS = {
  all: { icon: ClipboardList, color: '#0B4A3D' },
  draft: { icon: PenLine, color: '#6b7280' },
  costworkout: { icon: Calculator, color: '#0A4F44' },
  pendingapproval: { icon: Clock, color: '#d97706' },
  approved: { icon: CheckCircle, color: '#16a34a' },
  converted: { icon: FileText, color: '#2563eb' },
  rejected: { icon: Ban, color: '#dc2626' },
  totalvalue: { icon: IndianRupee, color: '#ec4899' }
};

export default function CprKpiCards({ stats, activeKpi, onSelect }) {
  const cards = [
    { key: 'all', label: 'Total CPR', value: stats.total },
    { key: 'draft', label: 'Draft', value: stats.draft },
    { key: 'costworkout', label: 'Cost Workout', value: stats.costWorkout },
    { key: 'pendingapproval', label: 'Pending Approval', value: stats.pendingApproval },
    { key: 'approved', label: 'Approved', value: stats.approved },
    { key: 'converted', label: 'Converted to Quotation', value: stats.converted },
    { key: 'rejected', label: 'Rejected', value: stats.rejected },
    { key: 'totalvalue', label: 'Total CPR Value', value: `₹${Number(stats.totalAmt || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6 select-none">
      {cards.map((card) => {
        const Icon = KPI_ICONS[card.key].icon;
        const color = KPI_ICONS[card.key].color;
        const active = activeKpi === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect(card.key)}
            className={`flex items-center gap-3 bg-surface rounded-xl p-3.5 shadow-sm transition-all cursor-pointer text-left ${
              active
                ? 'border-2 border-[#0B4A3D] shadow-[0_2px_10px_rgba(11,74,61,0.15)]'
                : 'border border-slate-200 hover:border-slate-300'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" style={{ color }} />
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 truncate leading-tight">{card.value}</div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                {card.label}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
