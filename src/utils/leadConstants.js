export const STAGES = [
  { value: 'High', label: 'High', chip: 'bg-red-50 text-red-600 border border-red-100' },
  { value: 'Medium', label: 'Medium', chip: 'bg-amber-50 text-amber-600 border border-amber-100' },
  { value: 'Low', label: 'Low', chip: 'bg-slate-100 text-slate-600 border border-slate-200' },
  { value: 'New', label: 'New', chip: 'bg-sky-50 text-sky-600 border border-sky-100' },
  { value: 'Qualified', label: 'Qualified', chip: 'bg-indigo-50 text-indigo-600 border border-indigo-100' },
  { value: 'Negotiation', label: 'Negotiation', chip: 'bg-purple-50 text-purple-600 border border-purple-100' },
  { value: 'Won', label: 'Won', chip: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { value: 'Lost', label: 'Lost', chip: 'bg-rose-50 text-rose-600 border border-rose-100' }
];

export const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((s) => [s.value, s]));

export const STAGE_BADGES = {
  New: 'bg-sky-50 text-sky-700 border border-sky-200',
  Qualified: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  Proposal: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  Negotiation: 'bg-purple-50 text-purple-700 border border-purple-200',
  Won: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Lost: 'bg-rose-50 text-rose-700 border border-rose-200',
  Contacted: 'bg-blue-50 text-blue-700 border border-blue-200',
  High: 'bg-red-50 text-red-700 border border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  Low: 'bg-slate-100 text-slate-600 border border-slate-200'
};

export const STAGE_BADGE_FALLBACK = 'bg-slate-100 text-slate-600 border border-slate-200';

export const PIPELINE_ORDER = STAGES.map((s) => s.value);

export const LEAD_STATUSES = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Archived', label: 'Archived' },
  { value: 'Deleted', label: 'Deleted' }
];

export const LEAD_STATUS_BADGES = {
  Active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Inactive: 'bg-amber-50 text-amber-700 border border-amber-200',
  Archived: 'bg-slate-100 text-slate-600 border border-slate-200',
  Deleted: 'bg-rose-50 text-rose-700 border border-rose-200'
};

export const LEAD_STATUS_BADGE_FALLBACK = 'bg-slate-100 text-slate-600 border border-slate-200';

export const STAGE_FILTER_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Proposal', label: 'Proposal' },
  { value: 'Negotiation', label: 'Negotiation' },
  { value: 'Won', label: 'Won' },
  { value: 'Lost', label: 'Lost' }
];

export const LEAD_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

export const PRIORITY_BADGES = {
  low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  high: 'bg-red-50 text-red-700 border border-red-200',
  critical: 'bg-red-100 text-red-800 border border-red-300'
};

export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Cold Call',
  'Trade Show',
  'LinkedIn',
  'Email Campaign',
  'Advertisement'
];

export const LEAD_COLUMNS = [
  { key: 'name', label: 'Lead Target', width: 210, sortable: true, visible: true, sticky: 'left' },
  { key: 'company', label: 'Company Entity', width: 170, sortable: true, visible: true, align: 'left' },
  { key: 'value', label: 'Estimated Value', width: 150, sortable: true, visible: true, align: 'right' },
  { key: 'stage', label: 'Pipeline Stage', width: 135, sortable: true, visible: true, align: 'center' },
  { key: 'owner', label: 'Owner', width: 150, sortable: true, visible: true, align: 'left' },
  { key: 'contact', label: 'Phone / Email', width: 210, sortable: false, visible: true, align: 'left' },
  { key: 'source', label: 'Lead Source', width: 140, sortable: true, visible: false, align: 'left' },
  { key: 'date', label: 'Registry Date', width: 135, sortable: true, visible: true, align: 'left' },
  { key: 'status', label: 'Status', width: 115, sortable: true, visible: true, align: 'center' },
  { key: 'actions', label: 'Actions', width: 96, sortable: false, visible: true, sticky: 'right', align: 'center' }
];

export const DEFAULT_VISIBLE_COLUMNS = LEAD_COLUMNS.filter((c) => c.visible).map((c) => c.key);

export const AVATAR_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
  'bg-blue-100 text-blue-800',
  'bg-pink-100 text-pink-800'
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const STORAGE_KEYS = {
  columns: 'vishak:leads:columns',
  pageSize: 'vishak:leads:pageSize',
  filters: 'vishak:leads:filters',
  listState: 'vishak:leads:listState'
};
