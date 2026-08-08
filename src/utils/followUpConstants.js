// Column order + widths mirror OLD.zip followups.html <colgroup>
// checkbox(52) | Date(130) | Time(90) | Lead/Client No(170) | Customer(220) |
// Lead Stage(140) | Last Follow-up(170) | Remarks(220) | Mode(110) | Priority(110) | Status(130) | Actions(70)
export const FOLLOWUP_COLUMNS = [
  { key: 'followUpDate', label: 'Date', width: 130, sortable: true, visible: true, align: 'left' },
  { key: 'followUpTime', label: 'Time', width: 90, sortable: false, visible: true, align: 'left' },
  { key: 'leadNo', label: 'Lead / Client No', width: 170, sortable: true, visible: true, sticky: 'left', align: 'left' },
  { key: 'customer', label: 'Customer', width: 220, sortable: true, visible: true, align: 'left' },
  { key: 'leadStage', label: 'Lead Stage', width: 140, sortable: false, visible: true, align: 'left' },
  { key: 'lastFollowUp', label: 'Last Follow-up', width: 170, sortable: false, visible: true, align: 'left' },
  { key: 'remarks', label: 'Remarks', width: 220, sortable: false, visible: true, align: 'left' },
  { key: 'mode', label: 'Mode', width: 110, sortable: false, visible: true, align: 'left' },
  { key: 'priority', label: 'Priority', width: 110, sortable: false, visible: true, align: 'center' },
  { key: 'status', label: 'Status', width: 130, sortable: true, visible: true, align: 'center' },
  { key: 'actions', label: 'Actions', width: 70, sortable: false, visible: true, sticky: 'right', align: 'center' }
];

export const DEFAULT_VISIBLE_FOLLOWUP_COLUMNS = FOLLOWUP_COLUMNS.filter((c) => c.visible).map((c) => c.key);

export const FOLLOWUP_STATUSES = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' }
];

export const FOLLOWUP_MODES = ['Call', 'Meeting', 'Email', 'WhatsApp', 'Visit', 'Other'];

export const FOLLOWUP_PRIORITIES = ['High', 'Medium', 'Low'];

export const REMINDER_TYPES = ['Email', 'SMS', 'Phone', 'Notification', 'Other'];

// Lifecycle badge colors (used by detail modal / form).
export const FOLLOWUP_STATUS_BADGES = {
  Draft: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-slate-200 text-slate-600',
  Archived: 'bg-slate-200/70 text-slate-500 line-through'
};

// Date-based status badges — exact OLD.zip fu-status-* palette.
export const FOLLOWUP_DATE_STATUS_BADGES = {
  Overdue: 'bg-[#fef2f2] text-[#dc2626]',
  Today: 'bg-[#dbeafe] text-[#2563eb]',
  Tomorrow: 'bg-[#fef3c7] text-[#d97706]',
  Upcoming: 'bg-[#f0fdf4] text-[#16a34a]',
  Completed: 'bg-[#dcfce7] text-[#16a34a]',
  Cancelled: 'bg-[#fee2e2] text-[#dc2626]'
};

// Stage badge map — exact OLD.zip stageBadge() classes.
export const FOLLOWUP_STAGE_BADGES = {
  High: 'bg-[#eff6ff] text-[#2563eb]',
  Medium: 'bg-[#eff6ff] text-[#2563eb]',
  Low: 'bg-[#eff6ff] text-[#2563eb]',
  New: 'bg-[#eff6ff] text-[#2563eb]',
  Contacted: 'bg-[#fffbeb] text-[#d97706]',
  Qualified: 'bg-[#f0fdf4] text-[#16a34a]',
  Proposal: 'bg-[#edf7f4] text-[#0B4A3D]',
  'Proposal Sent': 'bg-[#edf7f4] text-[#0B4A3D]',
  Negotiation: 'bg-[#eff6ff] text-[#2563eb]',
  Won: 'bg-[#f0fdf4] text-[#16a34a]',
  Lost: 'bg-[#fef2f2] text-[#dc2626]',
  Active: 'bg-[#f0fdf4] text-[#16a34a]',
  Inactive: 'bg-[#f3f4f6] text-[#6b7280]',
  Archived: 'bg-[#f3f4f6] text-[#6b7280]',
  default: 'bg-[#f3f4f6] text-[#6b7280]'
};

// Priority badge map — exact OLD.zip priorityBadge() classes.
export const FOLLOWUP_TABLE_PRIORITY_BADGES = {
  High: 'bg-[#fef2f2] text-[#dc2626]',
  Urgent: 'bg-[#fef2f2] text-[#dc2626]',
  Critical: 'bg-[#fef2f2] text-[#dc2626]',
  Medium: 'bg-[#eff6ff] text-[#2563eb]',
  Low: 'bg-[#f3f4f6] text-[#6b7280]',
  default: 'bg-[#eff6ff] text-[#2563eb]'
};

export const FOLLOWUP_MODE_ICONS = {
  Call: 'PhoneCall',
  Email: 'Mail',
  Meeting: 'Users',
  WhatsApp: 'MessageCircle',
  Visit: 'MapPin',
  Other: 'ClipboardList',
  default: 'CalendarClock'
};

export const FOLLOWUP_MODE_COLORS = {
  Call: 'bg-sky-50 text-sky-600',
  Email: 'bg-indigo-50 text-indigo-600',
  Meeting: 'bg-purple-50 text-purple-600',
  WhatsApp: 'bg-emerald-50 text-emerald-600',
  Visit: 'bg-amber-50 text-amber-600',
  Other: 'bg-slate-100 text-slate-500',
  default: 'bg-slate-100 text-slate-500'
};

export const FOLLOWUP_PRIORITY_BADGES = {
  High: 'bg-rose-100 text-rose-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-emerald-100 text-emerald-700'
};

// Same as client table / OLD.zip pagination.
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const FOLLOWUP_STORAGE_KEYS = {
  columns: 'vishak:followups:columns',
  pageSize: 'vishak:followups:pageSize'
};
