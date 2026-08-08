const APPROVAL_COLORS = {
  approved: '#16a34a',
  rejected: '#dc2626',
  pending: '#d97706'
};

export default function CprApprovalBadge({ status }) {
  const key = String(status || '').toLowerCase();
  const color = APPROVAL_COLORS[key] || '#9ca3af';
  if (!status) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold whitespace-nowrap" style={{ background: '#f1f5f9', color: '#9ca3af' }}>
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold whitespace-nowrap"
      style={{ background: `${color}15`, color }}
    >
      {status}
    </span>
  );
}
