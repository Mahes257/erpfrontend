import { FileText } from 'lucide-react';

export default function SalesKpiCards({ cards = [], activeKpi, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6 select-none">
      {cards.map((card) => {
        const Icon = card.icon || FileText;
        const color = card.color || '#0B4A3D';
        const active = activeKpi === card.key;
        const isAmount = typeof card.value === 'string' && card.value.startsWith('₹');
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
            <Icon className="w-5 h-5 shrink-0" style={{ color: isAmount ? '#ec4899' : color }} />
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
