const STATUS_STYLES = {
  draft: { background: '#f3f4f6', color: '#6b7280' },
  'cost workout': { background: '#E8F0EE', color: '#0B4A3D' },
  'pending approval': { background: '#fffbeb', color: '#d97706' },
  approved: { background: '#f0fdf4', color: '#16a34a' },
  rejected: { background: '#fef2f2', color: '#dc2626' },
  converted: { background: '#eff6ff', color: '#2563eb' },
  archived: { background: '#f1f5f9', color: '#64748b' },
  deleted: { background: '#fef2f2', color: '#dc2626' }
};

const STATUS_LABELS = {
  draft: 'Draft',
  'cost workout': 'Cost Workout',
  'pending approval': 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  converted: 'Converted',
  archived: 'Archived',
  deleted: 'Deleted'
};

export default function CprStatusBadge({ status }) {
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
