import { AVATAR_COLORS } from './clientConstants';
import { readMeta, stripMeta, writeMeta } from './leadMeta';

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

function pick(obj, keys) {
  if (!obj) return undefined;
  for (let i = 0; i < keys.length; i += 1) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') {
      return obj[keys[i]];
    }
  }
  return undefined;
}

export function normalizeClient(raw = {}) {
  const name = pick(raw, ['name', 'clientName', 'fullName']) || `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const value = pick(raw, ['value', 'dealValue', 'contractValue']);
  const date = pick(raw, ['date', 'createdAt', 'createdDate', 'addedAt']);
  const meta = readMeta(raw.internalNotes);
  // Prefer the backend's real status field so table actions (archive,
  // inactive, active) that PATCH the lead show through; meta is only a
  // fallback for records whose status lived in the blob. 'stage' is not a
  // status source (a WON client would otherwise display as "Won").
  const rawStatus = pick(raw, ['status', 'clientStatus']);

  return {
    id: raw.id,
    clientNo: meta.clientNo || raw.clientNo || raw.clientNumber || raw.number || '',
    clientCode: raw.clientCode || meta.clientNo || raw.clientNo || raw.clientNumber || raw.number || '',
    name,
    company: pick(raw, ['company', 'companyName', 'organisation']) || '',
    designation: raw.designation || raw.title || '',
    email: raw.email || '',
    phone: pick(raw, ['phone', 'mobile', 'phoneNumber']) || '',
    website: raw.website || '',
    value: value !== undefined && value !== '' ? Number(value) : 0,
    owner: pick(raw, ['owner', 'assignedTo', 'ownerName']) || '',
    industry: raw.industry || '',
    taxId: raw.taxId || '',
    gstin: meta.gstin || raw.gstin || '',
    panNumber: meta.panNumber || raw.panNumber || '',
    clientType: meta.clientType || raw.clientType || '',
    taxTreatment: meta.taxTreatment || raw.taxTreatment || '',
    bankName: meta.bankName || raw.bankName || '',
    accountHolderName: meta.accountHolderName || raw.accountHolderName || '',
    accountNumber: meta.accountNumber || raw.accountNumber || '',
    ifscCode: meta.ifscCode || raw.ifscCode || '',
    branch: meta.branch || raw.branch || '',
    upiId: meta.upiId || raw.upiId || '',
    openingBalance:
      meta.openingBalance !== undefined && meta.openingBalance !== null && meta.openingBalance !== ''
        ? Number(meta.openingBalance)
        : raw.openingBalance !== undefined && raw.openingBalance !== null && raw.openingBalance !== ''
          ? Number(raw.openingBalance)
          : 0,
    address: raw.address || '',
    city: raw.city || '',
    state: raw.state || '',
    pincode: raw.pincode || '',
    country: raw.country || '',
    alias: meta.alias || raw.alias || '',
    mapNo: meta.mapNo || raw.mapNo || '',
    category: meta.category || raw.category || '',
    paymentTerms: meta.paymentTerms || raw.paymentTerms || '',
    creditLimit:
      meta.creditLimit !== undefined && meta.creditLimit !== null && meta.creditLimit !== ''
        ? Number(meta.creditLimit)
        : raw.creditLimit !== undefined && raw.creditLimit !== null && raw.creditLimit !== ''
          ? Number(raw.creditLimit)
          : 0,
    currency: meta.currency || raw.currency || 'INR',
    internalNotes: stripMeta(raw.internalNotes),
    linkedContacts: parseJsonList(meta.linkedContacts || raw.linkedContacts),
    shippingDetails: parseJsonList(meta.shippingDetails || raw.shippingDetails),
    status: rawStatus
      ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
      : (meta.status || 'Active'),
    date,
    createdAt: raw.createdAt || date || '',
    updatedAt: raw.updatedAt || '',
    archivedAt: raw.archivedAt || '',
    deletedAt: raw.deletedAt || '',
    // Raw internalNotes passthrough so edit payloads can re-attach the meta
    // blob (clientNo, banking, etc.) that the form displays stripped.
    _rawInternalNotes: typeof raw?.internalNotes === 'string' ? raw.internalNotes : ''
  };
}

export function serializeClient(client) {
  return {
    clientNo: client.clientNo || '',
    name: client.name,
    company: client.company,
    designation: client.designation,
    email: client.email,
    phone: client.phone,
    website: client.website,
    value: Number(client.value) || 0,
    owner: client.owner,
    industry: client.industry,
    taxId: client.taxId,
    gstin: client.gstin || '',
    panNumber: client.panNumber || '',
    clientType: client.clientType || '',
    taxTreatment: client.taxTreatment || '',
    bankName: client.bankName || '',
    accountHolderName: client.accountHolderName || '',
    accountNumber: client.accountNumber || '',
    ifscCode: client.ifscCode || '',
    branch: client.branch || '',
    upiId: client.upiId || '',
    openingBalance:
      client.openingBalance !== undefined && client.openingBalance !== null && client.openingBalance !== ''
        ? Number(client.openingBalance)
        : null,
    address: client.address,
    city: client.city,
    state: client.state,
    pincode: client.pincode,
    country: client.country,
    alias: client.alias || '',
    mapNo: client.mapNo || '',
    category: client.category || '',
    paymentTerms: client.paymentTerms || '',
    creditLimit:
      client.creditLimit !== undefined && client.creditLimit !== null && client.creditLimit !== ''
        ? Number(client.creditLimit)
        : null,
    currency: client.currency || 'INR',
    internalNotes: client.internalNotes,
    linkedContacts: Array.isArray(client.linkedContacts) ? JSON.stringify(client.linkedContacts) : (client.linkedContacts || ''),
    shippingDetails: Array.isArray(client.shippingDetails) ? JSON.stringify(client.shippingDetails) : (client.shippingDetails || ''),
    status: client.status || 'Active'
  };
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCellValue(client, key) {
  switch (key) {
    case 'clientCode':
    case 'clientNo':
    case 'number':
      return client.clientCode || client.clientNo || '';
    case 'name':
      // "Business Name" column — business name first, person name as fallback
      return client.company || client.name || '';
    case 'contactPerson':
      return client.name || '';
    case 'company':
      return client.company || '';
    case 'value':
      return formatINR(client.value);
    case 'owner':
      return client.owner || '';
    case 'contact':
      return [client.phone, client.email].filter(Boolean).join(' ');
    case 'city':
      return client.city || '';
    case 'industry':
      return client.industry || '';
    case 'date':
      return formatDate(client.date);
    case 'phone':
      return client.phone || '';
    case 'email':
      return client.email || '';
    case 'lastFollowUp':
    case 'nextFollowUp':
      return '';
    case 'status':
      return client.status || '';
    default:
      return client[key] != null ? String(client[key]) : '';
  }
}

export function buildClientFormPrefill(raw) {
  const client = normalizeClient(raw);
  return {
    clientNo: client.clientNo || '',
    name: client.name || '',
    company: client.company || '',
    designation: client.designation || '',
    email: client.email || '',
    phone: client.phone || '',
    website: client.website || '',
    value: client.value && client.value !== 0 ? String(client.value) : '',
    owner: client.owner || 'Admin User',
    industry: client.industry || '',
    taxId: client.taxId || '',
    gstin: client.gstin || '',
    panNumber: client.panNumber || '',
    clientType: client.clientType || '',
    taxTreatment: client.taxTreatment || '',
    bankName: client.bankName || '',
    accountHolderName: client.accountHolderName || '',
    accountNumber: client.accountNumber || '',
    ifscCode: client.ifscCode || '',
    branch: client.branch || '',
    upiId: client.upiId || '',
    openingBalance: client.openingBalance && client.openingBalance !== 0 ? String(client.openingBalance) : '',
    address: client.address || '',
    city: client.city || '',
    state: client.state || '',
    pincode: client.pincode || '',
    country: client.country || 'India',
    internalNotes: typeof raw?.internalNotes === 'string' ? raw.internalNotes : ''
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

export function buildClientSearchString(client) {
  return [
    client.clientNo,
    client.name,
    client.company,
    client.phone,
    client.email,
    client.owner,
    client.city,
    client.status
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Map a client form object onto the target backend's LeadRequest shape.
 * Clients are modelled as leads with stage WON; fields the Lead model does
 * not know about are serialized into the internalNotes meta blob so they
 * survive the round trip.
 */
export function clientToLeadPayload(client) {
  const meta = {
    clientNo: client.clientNo || '',
    gstin: client.gstin || '',
    panNumber: client.panNumber || '',
    clientType: client.clientType || '',
    taxTreatment: client.taxTreatment || '',
    bankName: client.bankName || '',
    accountHolderName: client.accountHolderName || '',
    accountNumber: client.accountNumber || '',
    ifscCode: client.ifscCode || '',
    branch: client.branch || '',
    upiId: client.upiId || '',
    openingBalance: client.openingBalance !== undefined && client.openingBalance !== null && client.openingBalance !== '' ? Number(client.openingBalance) : undefined,
    alias: client.alias || '',
    mapNo: client.mapNo || '',
    category: client.category || '',
    paymentTerms: client.paymentTerms || '',
    creditLimit: client.creditLimit !== undefined && client.creditLimit !== null && client.creditLimit !== '' ? Number(client.creditLimit) : undefined,
    currency: client.currency || 'INR',
    linkedContacts: Array.isArray(client.linkedContacts) ? JSON.stringify(client.linkedContacts) : client.linkedContacts || '',
    shippingDetails: Array.isArray(client.shippingDetails) ? JSON.stringify(client.shippingDetails) : client.shippingDetails || '',
    status: client.status || 'Active'
  };
  // The backend LeadStatus enum has no Deleted value (deletion is a hard
  // delete), so only forward statuses the backend understands; anything
  // else stays in the meta blob only.
  const backendStatus = ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(
    String(client.status || '').toUpperCase()
  )
    ? String(client.status).toUpperCase()
    : undefined;
  return {
    leadName: client.name,
    companyName: client.company,
    designation: client.designation,
    email: client.email,
    phone: client.phone,
    website: client.website,
    estimatedValue: Number(client.value) || 0,
    assignedTo: client.owner,
    industry: client.industry,
    taxId: client.taxId,
    pan: client.panNumber || '',
    address: client.address,
    city: client.city,
    state: client.state,
    pincode: client.pincode,
    country: client.country || 'India',
    internalNotes: writeMeta(client.internalNotes || '', meta),
    pipelineStage: 'WON',
    ...(backendStatus ? { status: backendStatus } : {})
  };
}
