const STATUS_STYLES = {
  draft: { background: '#f3f4f6', color: '#6b7280' },
  pending: { background: '#fffbeb', color: '#d97706' },
  'pending approval': { background: '#fffbeb', color: '#d97706' },
  pendingreview: { background: '#fffbeb', color: '#d97706' },
  'pending review': { background: '#fffbeb', color: '#d97706' },
  submitted: { background: '#eff6ff', color: '#2563eb' },
  'under review': { background: '#fef3c7', color: '#b45309' },
  viewed: { background: '#f0f9ff', color: '#0284c7' },
  sent: { background: '#eff6ff', color: '#2563eb' },
  accepted: { background: '#f0fdf4', color: '#16a34a' },
  confirmed: { background: '#f0fdf4', color: '#16a34a' },
  'in progress': { background: '#eff6ff', color: '#2563eb' },
  active: { background: '#f0fdf4', color: '#16a34a' },
  approved: { background: '#f0fdf4', color: '#16a34a' },
  issued: { background: '#f0fdf4', color: '#16a34a' },
  settled: { background: '#f0fdf4', color: '#16a34a' },
  received: { background: '#f0fdf4', color: '#16a34a' },
  paid: { background: '#f0fdf4', color: '#16a34a' },
  'partial paid': { background: '#fef3c7', color: '#b45309' },
  partial: { background: '#fef3c7', color: '#b45309' },
  packed: { background: '#f0fdf4', color: '#15803d' },
  dispatched: { background: '#eff6ff', color: '#2563eb' },
  'in transit': { background: '#eff6ff', color: '#2563eb' },
  delivered: { background: '#f0fdf4', color: '#16a34a' },
  completed: { background: '#f0fdf4', color: '#16a34a' },
  converted: { background: '#f0fdf4', color: '#16a34a' },
  expired: { background: '#f5f3ff', color: '#7c3aed' },
  overdue: { background: '#fef2f2', color: '#dc2626' },
  rejected: { background: '#fef2f2', color: '#dc2626' },
  cancelled: { background: '#fef2f2', color: '#dc2626' },
  adjusted: { background: '#fefce8', color: '#a16207' },
  refunded: { background: '#f0fdf4', color: '#15803d' },
  archived: { background: '#f1f5f9', color: '#64748b' },
  deleted: { background: '#fef2f2', color: '#dc2626' }
};

const STATUS_LABELS = {
  'pending approval': 'Pending Approval',
  'pending review': 'Pending Review',
  'under review': 'Under Review',
  'in progress': 'In Progress',
  'partial paid': 'Partial Paid',
  'in transit': 'In Transit'
};

export default function SalesStatusBadge({ status }) {
  const key = String(status || 'draft').toLowerCase();
  const style = STATUS_STYLES[key] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[key] || status || 'Draft';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold whitespace-nowrap"
      style={{ background: style.background, color: style.color }}
    >
      {label}
    </span>
  );
}
