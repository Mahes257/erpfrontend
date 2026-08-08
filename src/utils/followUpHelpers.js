import { FOLLOWUP_PRIORITIES, FOLLOWUP_MODES } from './followUpConstants';
import { readMeta } from './leadMeta';

export function formatINR(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
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

export function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function normalizePriority(value) {
  const v = String(value || '').trim();
  if (v === '') return 'Medium';
  return FOLLOWUP_PRIORITIES.find((p) => p.toLowerCase() === v.toLowerCase()) || v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

export function normalizeMode(value) {
  const v = String(value || '').trim();
  if (v === '') return 'Call';
  return FOLLOWUP_MODES.find((m) => m.toLowerCase() === v.toLowerCase()) || v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

export function normalizeFollowUp(raw = {}) {
  const meta = readMeta(raw.internalNotes);
  return {
    id: raw.id,
    followUpNo: raw.followUpNo || raw.number || meta.followUpNo || raw.leadNo || String(raw.id || ''),
    leadId: raw.leadId ?? raw.id,
    leadNo: raw.leadNo || meta.leadNo || '',
    leadName: raw.leadName || raw.name || '',
    leadCompany: raw.leadCompany || raw.company || '',
    leadDesignation: raw.leadDesignation || raw.designation || raw.title || '',
    leadPhone: raw.leadPhone || raw.leadMobile || raw.phone || '',
    leadEmail: raw.leadEmail || raw.email || '',
    leadStage: raw.leadStage || raw.stage || '',
    leadOwner: raw.leadOwner || raw.owner || '',
    leadIndustry: raw.leadIndustry || raw.industry || '',
    leadAddress: raw.leadAddress || raw.address || '',
    leadCity: raw.leadCity || raw.city || '',
    leadValue: raw.leadValue !== undefined ? Number(raw.leadValue) : raw.value !== undefined ? Number(raw.value) : 0,
    followUpDate: raw.followUpDate || meta.followUpDate || raw.date || '',
    followUpTime: raw.followUpTime || meta.followUpTime || '',
    mode: normalizeMode(raw.mode || meta.mode),
    priority: normalizePriority(raw.priority || meta.priority),
    assignedUser: raw.assignedUser || meta.assignedUser || raw.owner || '',
    remarks: raw.remarks || meta.remarks || '',
    status: raw.status || meta.status || 'Pending',
    outcome: raw.outcome || meta.outcome || '',
    discussion: raw.discussion || meta.discussion || '',
    feedback: raw.feedback || meta.feedback || '',
    requirement: raw.requirement || meta.requirement || '',
    nextFollowUpDate: raw.nextFollowUpDate || meta.nextFollowUpDate || '',
    reminder: raw.reminder || meta.reminder || '',
    reminderType: raw.reminderType || meta.reminderType || '',
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    createdBy: raw.createdBy || '',
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || ''
  };
}

export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function attachmentType(name = '') {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  return 'file';
}

export function getCellValue(followUp, key) {
  switch (key) {
    case 'followUpNo':
    case 'number':
      return followUp.followUpNo || '';
    case 'followUpDate':
      return formatDate(followUp.followUpDate);
    case 'followUpTime':
      return followUp.followUpTime || '';
    case 'leadNo':
      return followUp.leadNo || String(followUp.leadId || '');
    case 'customer':
      return followUp.leadName || followUp.leadCompany || '';
    case 'leadStage':
      return followUp.leadStage || '';
    case 'lastFollowUp':
      return followUp.lastFollowUp || '';
    case 'leadName':
      return followUp.leadName || '';
    case 'company':
      return followUp.leadCompany || '';
    case 'contact':
      return [followUp.leadPhone, followUp.leadEmail].filter(Boolean).join(' ');
    case 'mode':
      return followUp.mode || '';
    case 'priority':
      return followUp.priority || '';
    case 'assignedUser':
      return followUp.assignedUser || '';
    case 'remarks':
      return followUp.remarks || '';
    case 'status':
      return followUp.status || '';
    default:
      return followUp[key] != null ? String(followUp[key]) : '';
  }
}

// Date-based status info — mirrors OLD.zip getStatusInfo().
export function getFollowUpStatusInfo(followUp) {
  const status = followUp.status || 'Pending';
  if (status === 'Completed') return { label: 'Completed', badge: 'Completed' };
  if (status === 'Cancelled') return { label: 'Cancelled', badge: 'Cancelled' };
  if (!followUp.followUpDate) return { label: 'Overdue', badge: 'Overdue' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fuDate = new Date(`${followUp.followUpDate}T00:00:00`);
  if (Number.isNaN(fuDate.getTime())) return { label: 'Overdue', badge: 'Overdue' };
  const diff = Math.round((fuDate - today) / 86400000);
  if (diff === 0) return { label: 'Today', badge: 'Today' };
  if (diff === 1) return { label: 'Tomorrow', badge: 'Tomorrow' };
  if (diff > 0) return { label: 'Upcoming', badge: 'Upcoming' };
  return { label: 'Overdue', badge: 'Overdue' };
}

export function buildFollowUpSearchString(followUp) {
  return [
    followUp.followUpNo,
    followUp.leadName,
    followUp.leadCompany,
    followUp.leadPhone,
    followUp.leadEmail,
    followUp.assignedUser,
    followUp.mode,
    followUp.priority,
    followUp.status
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function buildExportFilename(prefix) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}`;
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
