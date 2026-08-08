import { AVATAR_COLORS } from './leadConstants';
import { readMeta, stripMeta, writeMeta, removeMetaKeys } from './leadMeta';

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

export function toISODate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(value);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function pick(obj, keys) {
  if (!obj) return undefined;
  for (let i = 0; i < keys.length; i += 1) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') {
      return obj[keys[i]];
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------
 * Stage vocabulary bridge.
 * The source CRM uses High/Medium/Low (+ New/Qualified/Negotiation/
 * Won/Lost); the target backend enum is HOT/WARM/COLD/NEW/QUALIFIED/
 * NEGOTIATION/WON/LOST. These helpers map both directions (and fold
 * Contacted -> NEW, Proposal -> NEGOTIATION which the backend lacks).
 * ------------------------------------------------------------------ */
const STAGE_TO_BACKEND = {
  high: 'HOT',
  medium: 'WARM',
  low: 'COLD',
  contacted: 'NEW',
  proposal: 'NEGOTIATION'
};

const BACKEND_TO_STAGE = {
  HOT: 'High',
  WARM: 'Medium',
  COLD: 'Low'
};

export function mapStageToBackend(stage) {
  const v = String(stage || '').trim();
  if (!v) return undefined;
  return STAGE_TO_BACKEND[v.toLowerCase()] || v.toUpperCase();
}

export function mapStageFromBackend(stage) {
  const v = String(stage || '').trim();
  if (!v) return '';
  const mapped = BACKEND_TO_STAGE[v.toUpperCase()];
  if (mapped) return mapped;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

/* Follow-up schedule keys stored in the lead meta blob. */
export const FOLLOWUP_META_KEYS = [
  'followUpDate',
  'followUpTime',
  'mode',
  'priority',
  'assignedUser',
  'remarks',
  'status',
  'outcome',
  'feedback',
  'requirement',
  'nextFollowUpDate',
  'reminder',
  'reminderType'
];

export function normalizeLead(raw = {}) {
  const name = pick(raw, ['name', 'leadName', 'fullName']) || `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const value = pick(raw, ['value', 'estimatedValue', 'dealValue']);
  const date = pick(raw, ['date', 'createdAt', 'createdDate', 'registryDate']);
  const priority = pick(raw, ['priority', 'leadPriority']);
  const lastFollowUp = pick(raw, ['lastFollowUp', 'lastFollowup', 'lastFollowUpDate', 'lastFollowupDate']);
  const nextFollowUp = pick(raw, ['nextFollowUp', 'nextFollowup', 'nextFollowUpDate', 'nextFollowupDate']);
  const meta = readMeta(raw.internalNotes);
  const rawStatus = pick(raw, ['status', 'leadStatus']);

  return {
    id: raw.id,
    leadNo: raw.leadNo || raw.leadNumber || raw.number || meta.leadNo || '',
    name,
    firstName: raw.firstName || (name || '').split(' ')[0] || '',
    lastName: raw.lastName || (name || '').split(' ').slice(1).join(' ') || '',
    company: pick(raw, ['company', 'companyName', 'organisation']) || '',
    title: raw.title || raw.designation || '',
    description: pick(raw, ['requirement', 'description', 'leadDescription']) || meta.description || '',
    phone: pick(raw, ['phone', 'mobile', 'phoneNumber']) || '',
    email: raw.email || '',
    value: value !== undefined && value !== '' ? Number(value) : 0,
    stage: mapStageFromBackend(pick(raw, ['stage', 'pipelineStage'])) || 'New',
    source: raw.source || raw.leadSource || '',
    owner: pick(raw, ['owner', 'assignedTo', 'ownerName']) || '',
    status: rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() : 'Active',
    priority: priority !== undefined && priority !== '' ? String(priority).toLowerCase() : (meta.priority || 'medium'),
    lastFollowUp: lastFollowUp || meta.lastFollowUp || '',
    nextFollowUp: nextFollowUp || meta.nextFollowUp || '',
    date,
    updatedAt: raw.updatedAt || raw.lastUpdated || raw.modifiedAt || date || '',
    website: raw.website || '',
    address: raw.address || '',
    city: raw.city || '',
    state: raw.state || '',
    pincode: raw.pincode || '',
    country: raw.country || '',
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    businessName: raw.businessName || '',
    businessType: raw.businessType || '',
    industry: raw.industry || '',
    taxId: raw.taxId || '',
    secondaryName: raw.secondaryName || '',
    secondaryPhone: raw.secondaryPhone || '',
    secondaryEmail: raw.secondaryEmail || '',
    secondaryDesignation: raw.secondaryDesignation || meta.secondaryDesignation || '',
    landmark: raw.landmark || meta.landmark || '',
    expectedCloseDate: raw.expectedCloseDate || meta.expectedCloseDate || '',
    internalNotes: stripMeta(raw.internalNotes)
  };
}

export function serializeLead(lead) {
  const metaPatch = {
    leadNo: lead.leadNo || undefined,
    priority: lead.priority || undefined,
    lastFollowUp: lead.lastFollowUp || undefined,
    nextFollowUp: lead.nextFollowUp || undefined,
    landmark: lead.landmark || undefined,
    expectedCloseDate: toISODate(lead.expectedCloseDate) || lead.expectedCloseDate || undefined,
    secondaryDesignation: lead.secondaryDesignation || undefined,
    description: lead.description || undefined
  };
  return {
    leadName: lead.name,
    leadNo: lead.leadNo || '',
    firstName: lead.firstName,
    lastName: lead.lastName,
    companyName: lead.company,
    designation: lead.title,
    phone: lead.phone,
    email: lead.email,
    estimatedValue: Number(lead.value) || 0,
    pipelineStage: mapStageToBackend(lead.stage),
    leadSource: lead.source,
    assignedTo: lead.owner,
    website: lead.website,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    pincode: lead.pincode,
    country: lead.country,
    landmark: lead.landmark || '',
    expectedCloseDate: toISODate(lead.expectedCloseDate),
    businessName: lead.businessName,
    businessType: lead.businessType,
    industry: lead.industry,
    taxId: lead.taxId,
    secondaryName: lead.secondaryName,
    secondaryPhone: lead.secondaryPhone,
    secondaryEmail: lead.secondaryEmail,
    secondaryDesignation: lead.secondaryDesignation || '',
    internalNotes: writeMeta(lead.internalNotes || '', metaPatch),
    status: lead.status || 'Active',
    priority: lead.priority || 'medium'
  };
}

/**
 * Build a full LeadRequest payload from a raw lead response so that
 * meta-only updates (priority, follow-up schedule, notes) preserve every
 * other field of the record.
 */
export function leadToLeadRequest(rawLead, extra = {}) {
  const norm = normalizeLead(rawLead);
  // Keep the RAW internalNotes so the existing meta blob is preserved and
  // serializeLead's patch merges into it instead of replacing it.
  return serializeLead({ ...norm, internalNotes: rawLead?.internalNotes ?? '', ...extra });
}

/** Normalize the follow-up form payload into the lead meta patch shape. */
export function followUpPatch(payload = {}) {
  const patch = {
    followUpDate: payload.followUpDate || undefined,
    followUpTime: payload.followUpTime || undefined,
    mode: payload.mode || undefined,
    priority: payload.priority || undefined,
    assignedUser: payload.assignedUser || payload.assignedTo || undefined,
    remarks: payload.remarks || payload.discussion || undefined,
    status: payload.status || 'Pending',
    outcome: payload.outcome || undefined,
    feedback: payload.feedback || undefined,
    requirement: payload.requirement || undefined,
    nextFollowUpDate: payload.nextFollowUpDate || undefined,
    reminder: payload.reminder || undefined,
    reminderType: payload.reminderType || undefined
  };
  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined || patch[key] === null || patch[key] === '') delete patch[key];
  });
  return patch;
}

/**
 * Update (or clear) the follow-up schedule stored in a lead's meta blob
 * and return the internalNotes string ready for PUT.
 */
export function applyFollowUpMeta(internalNotes, patch, clear = false) {
  if (clear) return removeMetaKeys(internalNotes || '', FOLLOWUP_META_KEYS);
  return writeMeta(internalNotes || '', patch);
}

export function getCellValue(lead, key) {
  switch (key) {
    case 'number':
    case 'leadNo':
      return lead.leadNo || '';
    case 'name':
      return lead.name || '';
    case 'company':
      return lead.company || '';
    case 'value':
      return formatINR(lead.value);
    case 'stage':
      return lead.stage || '';
    case 'owner':
      return lead.owner || '';
    case 'contact':
      return [lead.phone, lead.email].filter(Boolean).join(' ');
    case 'source':
      return lead.source || '';
    case 'priority':
      return lead.priority || '';
    case 'lastFollowUp':
      return formatDate(lead.lastFollowUp);
    case 'nextFollowUp':
      return formatDate(lead.nextFollowUp);
    case 'date':
      return formatDate(lead.date);
    case 'description':
      return lead.description || '';
    case 'createdAt':
      return formatDate(lead.date || lead.createdAt);
    case 'status':
      return lead.status || '';
    default:
      return lead[key] != null ? String(lead[key]) : '';
  }
}

export function buildLeadFormPrefill(raw) {
  const lead = normalizeLead(raw);
  const rawNotes = Array.isArray(raw?.notes)
    ? raw.notes.map((note) => (typeof note === 'string' ? note : note?.text || '')).join('\n')
    : typeof raw?.notes === 'string'
      ? raw.notes
      : '';
  return {
    // Keep the RAW internalNotes blob out of the form fields (displayed
    // stripped) so the edit payload can re-merge the follow-up/lead meta
    // that would otherwise be wiped by a plain lead edit.
    _rawInternalNotes: typeof raw?.internalNotes === 'string' ? raw.internalNotes : '',
    leadNo: lead.leadNo || '',
    businessName: lead.businessName || '',
    businessType: lead.businessType || '',
    industry: lead.industry || '',
    taxId: lead.taxId || '',
    website: lead.website || '',
    name: lead.name || '',
    company: lead.company || '',
    title: lead.title || '',
    value: lead.value && lead.value !== 0 ? String(lead.value) : '',
    stage: lead.stage || 'New',
    source: lead.source || 'Website',
    email: lead.email || '',
    phone: lead.phone || '',
    secondaryName: lead.secondaryName || '',
    secondaryEmail: lead.secondaryEmail || '',
    secondaryPhone: lead.secondaryPhone || '',
    secondaryDesignation: lead.secondaryDesignation || '',
    address: lead.address || '',
    city: lead.city || '',
    state: lead.state || '',
    pincode: lead.pincode || '',
    country: lead.country || 'India',
    landmark: lead.landmark || '',
    expectedCloseDate: lead.expectedCloseDate || '',
    owner: lead.owner || 'Admin User',
    status: lead.status || 'Active',
    priority: lead.priority || 'medium',
    lastFollowUp: lead.lastFollowUp || '',
    nextFollowUp: lead.nextFollowUp || '',
    notes: rawNotes,
    internalNotes: stripMeta(typeof raw?.internalNotes === 'string' ? raw.internalNotes : '')
  };
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

export function buildLeadSearchString(lead) {
  return [
    lead.leadNo,
    lead.name,
    lead.company,
    lead.phone,
    lead.email,
    lead.stage,
    lead.owner,
    lead.source,
    lead.city,
    lead.status
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
