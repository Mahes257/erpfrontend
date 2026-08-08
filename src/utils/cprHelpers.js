// Status values come from the original ERP's master data (vt_master_pr_statuses)
// plus the ERP's 'Submitted' value used when submitting for approval. The React
// backend persists an enum (draft / pending approval / approved / rejected /
// converted / archived / deleted), so display values are mapped to the closest
// backend-safe status on serialize (mirrors the ERP's own status field).
export const STATUS_OPTIONS = [
  'Draft', 'Pending', 'Open', 'Approved', 'Rejected', 'Closed', 'Cancelled', 'Submitted'
];

// Display status (ERP form) -> backend enum status.
const DISPLAY_TO_BACKEND_STATUS = {
  'Draft': 'draft',
  'Pending': 'pending approval',
  'Open': 'pending approval',
  'Approved': 'approved',
  'Rejected': 'rejected',
  'Closed': 'approved',
  'Cancelled': 'rejected',
  'Submitted': 'pending approval'
};

export function normalizeStatus(value) {
  const status = (value || 'draft').trim();
  return DISPLAY_TO_BACKEND_STATUS[status] || status;
}

// Jackson-safe string coercion. The backend DTO declares every one of these
// fields as String, so a stray array/object (e.g. a lead's `notes` list leaking
// into an auto-filled field) must never reach the JSON payload — Jackson would
// reject it with "Cannot deserialize value of type String from Array value".
// Arrays are joined into a comma-separated string, objects are JSON-stringified,
// and null/undefined become ''.
function toStr(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'object' && v !== null ? '' : String(v))).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function normalizeCpr(raw = {}) {
  const createdAt = raw.createdAt || raw.date || raw.updatedAt || '';
  return {
    ...raw,
    client: raw.client || raw.clientName || '',
    createdBy: raw.createdBy || raw.requestedBy || '',
    description: raw.description || '',
    status: raw.status || 'draft',
    approvalStatus: raw.approvalStatus || '',
    items: Array.isArray(raw.items) ? raw.items : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    quotationId: raw.quotationId ?? null,
    costWorkoutId: raw.costWorkoutId ?? null,
    costWorkoutCwNo: raw.costWorkoutCwNo || '',
    costWorkoutStatus: raw.costWorkoutStatus || '',
    createdAt
  };
}

export function serializeCpr(form = {}, items = []) {
  const sourceType = toStr(form.sourceType);
  const sourceId = form.sourceId != null ? String(form.sourceId) : '';
  // The ERP derives leadNo from the selected source (lead id when a lead is
  // selected, empty for clients) rather than from the text field. When editing
  // (sourceType not restorable from the API) the stored leadNo is preserved.
  const leadNo = sourceType === 'lead' ? sourceId : sourceType === 'client' ? '' : (form.leadNo || '');
  return {
    prNo: toStr(form.prNo),
    prDate: toStr(form.prDate),
    department: toStr(form.department),
    requestedBy: toStr(form.requestedBy),
    requiredDate: toStr(form.requiredDate),
    priority: toStr(form.priority),
    status: toStr(normalizeStatus(form.status)),
    sourceLead: toStr(form.sourceLead),
    // Payload parity with the ERP's collectData(): it sends sourceType/sourceId/
    // leadId/clientId so the backend could persist the real source identity.
    sourceType,
    sourceId,
    leadId: sourceType === 'lead' ? sourceId : '',
    clientId: sourceType === 'client' ? sourceId : '',
    clientName: toStr(form.clientName),
    contactPerson: toStr(form.contactPerson),
    phone: toStr(form.phone),
    email: toStr(form.email),
    company: toStr(form.company),
    gst: toStr(form.gst),
    project: toStr(form.project),
    leadNo: toStr(leadNo),
    pan: toStr(form.pan),
    vendor: toStr(form.vendor),
    billingAddress: toStr(form.billingAddress),
    shippingAddress: toStr(form.shippingAddress),
    remarks: toStr(form.remarks),
    description: toStr(form.description),
    costWorkout: form.costWorkout != null && form.costWorkout !== '' ? Number(form.costWorkout) : null,
    profitPercent: form.profitPercent != null && form.profitPercent !== '' ? Number(form.profitPercent) : null,
    items: items.map((item) => ({
      drawingNo: toStr(item.drawingNo),
      description: toStr(item.description),
      specification: toStr(item.specification),
      qty: item.qty != null && item.qty !== '' ? Number(item.qty) : 1,
      unit: toStr(item.unit),
      estimatedCost: item.estimatedCost != null && item.estimatedCost !== '' ? Number(item.estimatedCost) : 0,
      remarks: toStr(item.remarks),
      fileName: toStr(item.fileName),
      fileSize: item.fileSize != null && item.fileSize !== '' ? Number(item.fileSize) : 0,
      fileType: toStr(item.fileType)
    }))
  };
}

export function cprToForm(raw) {
  const cpr = normalizeCpr(raw);
  // The ERP's edit flow shows 'Submitted' only when the stored status is
  // Submitted, otherwise 'Draft' — mirror that exactly.
  const rawStatus = String(cpr.status || '').toLowerCase();
  const status = rawStatus === 'submitted' || rawStatus === 'pending approval' ? 'Submitted' : 'Draft';
  return {
    prNo: cpr.prNo || '',
    prDate: (cpr.prDate || cpr.date || '').slice(0, 10),
    department: cpr.department || '',
    requestedBy: cpr.requestedBy || '',
    requiredDate: (cpr.requiredDate || '').slice(0, 10),
    priority: cpr.priority || '',
    status,
    sourceLead: cpr.sourceLead || '',
    sourceType: cpr.sourceType || '',
    sourceId: cpr.sourceId != null ? String(cpr.sourceId) : '',
    clientName: cpr.clientName || '',
    contactPerson: cpr.contactPerson || '',
    phone: cpr.phone || '',
    email: cpr.email || '',
    company: cpr.company || '',
    gst: cpr.gst || '',
    project: cpr.project || '',
    leadNo: cpr.leadNo || '',
    pan: cpr.pan || '',
    vendor: cpr.vendor || '',
    billingAddress: cpr.billingAddress || '',
    shippingAddress: cpr.shippingAddress || '',
    remarks: cpr.remarks || '',
    description: cpr.description || '',
    costWorkout: cpr.costWorkout != null ? String(cpr.costWorkout) : '',
    profitPercent: cpr.profitPercent != null ? String(cpr.profitPercent) : ''
  };
}

export function cprToRequest(cpr, overrides = {}) {
  const form = cprToForm(cpr);
  const items = Array.isArray(cpr.items) ? cpr.items : [];
  return { ...serializeCpr(form, items), ...overrides };
}

export function cprDocument(cpr = {}) {
  const items = Array.isArray(cpr.items) ? cpr.items : [];
  const total = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.estimatedCost) || 0), 0);
  const costWorkout = Number(cpr.costWorkout) || 0;
  const profit = costWorkout > 0 ? total - costWorkout : null;
  const profitOnCost = costWorkout > 0 && total > 0 ? (profit / costWorkout) * 100 : null;
  const marginPct = total > 0 && profit != null ? (profit / total) * 100 : null;
  return { items, total, costWorkout, profit, profitOnCost, marginPct };
}

export function buildCprLink(cpr) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/cprs/${cpr.id}`;
}

export function shareCpr(cpr) {
  const url = buildCprLink(cpr);
  const text = `${cpr.prNo || 'CPR'}${cpr.client ? ` · ${cpr.client}` : ''} — ${url}`;
  const tryShare = () =>
    navigator.share ? navigator.share({ title: cpr.prNo || 'CPR', text, url }) : Promise.reject(new Error('no-share'));
  return tryShare()
    .then(() => ({ ok: true, action: 'share' }))
    .catch((err) => {
      if (err && err.name === 'AbortError') return { ok: true, action: 'cancelled' };
      if (err && err.message === 'no-share') return navigator.clipboard.writeText(url).then(() => ({ ok: true, action: 'copy' }));
      return navigator.clipboard
        .writeText(url)
        .then(() => ({ ok: true, action: 'copy' }))
        .catch((clipboardError) => ({ ok: false, error: clipboardError }));
    });
}

export function emailCpr(cpr) {
  try {
    const subject = encodeURIComponent(`${cpr.prNo || 'CPR'}${cpr.client ? ` - ${cpr.client}` : ''}`);
    const body = encodeURIComponent(
      `Dear ${cpr.contactPerson || 'Sir/Madam'},\n\nPlease find the purchase request ${cpr.prNo} for your reference.\n\n` +
        `${cpr.description ? `Description: ${cpr.description}\n` : ''}` +
        `${cpr.requiredDate ? `Required by: ${cpr.requiredDate}\n` : ''}\n` +
        `Reference: ${buildCprLink(cpr)}`
    );
    window.location.href = `mailto:${cpr.email || ''}?subject=${subject}&body=${body}`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to open email client' };
  }
}
