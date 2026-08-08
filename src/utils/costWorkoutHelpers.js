import { CW_STATUS_META } from './costWorkoutConstants';

export function isLeadTimeCategory(category) {
  return String(category || '').toLowerCase() === 'lead time';
}

export function normalizeCw(raw = {}) {
  return {
    ...raw,
    cwNo: raw.cwNo || raw.id || '',
    cwDate: raw.cwDate || raw.date || '',
    status: raw.status || 'draft',
    preparedBy: raw.preparedBy || '',
    customerName: raw.customerName || raw.customer || '',
    cprRef: raw.cprRef || '',
    company: raw.company || '',
    items: Array.isArray(raw.items) ? raw.items : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    subtotal: Number(raw.subtotal) || 0,
    profitPct: Number(raw.profitPct) || 0,
    profitAmt: Number(raw.profitAmt) || 0,
    sellingPrice: Number(raw.sellingPrice) || 0,
    discountPct: Number(raw.discountPct) || 0,
    discountAmt: Number(raw.discountAmt) || 0,
    gstPct: raw.gstPct !== undefined && raw.gstPct !== null && raw.gstPct !== '' ? Number(raw.gstPct) : 18,
    gstAmt: Number(raw.gstAmt) || 0,
    grandTotal: Number(raw.grandTotal) || 0,
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments
      : raw.attachmentsJson && typeof raw.attachmentsJson === 'string'
        ? safeParseJson(raw.attachmentsJson)
        : []
  };
}

function safeParseJson(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Exact calculation flow from the original ERP (js/cost-workout.js cwUpdateTotals):
 *   itemTotal  = Σ qty × rate over category rows (Lead Time categories contribute 0)
 *   subtotal   = Σ itemTotal
 *   profitAmt  = subtotal × profitPct / 100
 *   selling    = subtotal + profitAmt
 *   discountAmt= selling × discountPct / 100
 *   gstAmt     = (selling − discountAmt) × gstPct / 100
 *   grandTotal = (selling − discountAmt) + gstAmt
 */
export function calcCwTotals(items = [], profitPct = 0, discountPct = 0, gstPct = 18) {
  let subtotal = 0;
  const rows = [];

  items.forEach((item) => {
    const categories = Array.isArray(item.categories) ? item.categories : [];
    let itemTotal = 0;
    categories.forEach((cat) => {
      const qty = Number(cat.qty) || 0;
      const rate = Number(cat.rate) || 0;
      const leadTime = isLeadTimeCategory(cat.category);
      const amount = leadTime ? 0 : qty * rate;
      if (!leadTime) itemTotal += amount;
      rows.push({ ...cat, category: cat.category || 'Material Cost', qty, rate, amount });
    });
    subtotal += itemTotal;
  });

  const pProfit = Number(profitPct) || 0;
  const pDiscount = Number(discountPct) || 0;
  const pGst = gstPct === null || gstPct === undefined || gstPct === '' ? 18 : Number(gstPct) || 0;

  const profitAmt = (subtotal * pProfit) / 100;
  const sellingPrice = subtotal + profitAmt;
  const discountAmt = (sellingPrice * pDiscount) / 100;
  const afterDiscount = sellingPrice - discountAmt;
  const gstAmt = (afterDiscount * pGst) / 100;
  const grandTotal = afterDiscount + gstAmt;

  return {
    rows,
    subtotal: round2(subtotal),
    profitPct: pProfit,
    profitAmt: round2(profitAmt),
    sellingPrice: round2(sellingPrice),
    discountPct: pDiscount,
    discountAmt: round2(discountAmt),
    gstPct: pGst,
    gstAmt: round2(gstAmt),
    grandTotal: round2(grandTotal)
  };
}

export function cwDocument(cw = {}) {
  const normalized = normalizeCw(cw);
  return calcCwTotals(
    normalized.items,
    normalized.profitPct,
    normalized.discountPct,
    normalized.gstPct
  );
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function serializeCw(form = {}, items = []) {
  return {
    cwNo: form.cwNo || '',
    cwDate: form.cwDate || '',
    status: form.status || 'draft',
    preparedBy: form.preparedBy || '',
    contactPerson: form.contactPerson || '',
    department: form.department || '',
    sourceLead: form.sourceLead || '',
    customerName: form.customerName || '',
    cprRef: form.cprRef || '',
    cprId: form.cprId != null && form.cprId !== '' ? Number(form.cprId) : null,
    phone: form.phone || '',
    email: form.email || '',
    company: form.company || '',
    gst: form.gst || '',
    pan: form.pan || '',
    linkedCpr: form.linkedCpr || '',
    billingAddress: form.billingAddress || '',
    shippingAddress: form.shippingAddress || '',
    remarks: form.remarks || '',
    profitPct: form.profitPct !== undefined && form.profitPct !== null && form.profitPct !== ''
      ? Number(form.profitPct) : 0,
    discountPct: form.discountPct !== undefined && form.discountPct !== null && form.discountPct !== ''
      ? Number(form.discountPct) : 0,
    gstPct: form.gstPct !== undefined && form.gstPct !== null && form.gstPct !== ''
      ? Number(form.gstPct) : 18,
    items: items.map((item) => ({
      description: item.description || '',
      qty: item.qty !== undefined && item.qty !== null && item.qty !== '' ? Number(item.qty) : 1,
      unit: item.unit || '',
      categories: (Array.isArray(item.categories) ? item.categories : []).map((cat) => ({
        category: cat.category || 'Material Cost',
        qty: Number(cat.qty) || 0,
        unit: cat.unit || 'Nos',
        rate: Number(cat.rate) || 0,
        notes: cat.notes || ''
      })),
      ...(Array.isArray(form.attachments) && form.attachments.length > 0
        ? {
            attachments: form.attachments
              .map((f) => ({
                name: f.name || f.fileName || '',
                size: Number(f.size) || 0,
                type: f.type || f.fileType || '',
                data: f.data || f.content || ''
              }))
              .filter((f) => f.name && f.data)
          }
        : {})
    }))
  };
}

export function cwToForm(raw) {
  const cw = normalizeCw(raw);
  return {
    cwNo: cw.cwNo || '',
    cwDate: (cw.cwDate || '').slice(0, 10),
    status: cw.status === 'completed' ? 'completed' : 'draft',
    preparedBy: cw.preparedBy || '',
    contactPerson: cw.contactPerson || '',
    department: cw.department || '',
    sourceLead: cw.sourceLead || '',
    customerName: cw.customerName || '',
    cprRef: cw.cprRef || '',
    cprId: cw.cprId != null ? String(cw.cprId) : '',
    phone: cw.phone || '',
    email: cw.email || '',
    company: cw.company || '',
    gst: cw.gst || '',
    pan: cw.pan || '',
    linkedCpr: cw.linkedCpr || '',
    billingAddress: cw.billingAddress || '',
    shippingAddress: cw.shippingAddress || '',
    remarks: cw.remarks || '',
    profitPct: cw.profitPct != null ? String(cw.profitPct) : '0',
    discountPct: cw.discountPct != null ? String(cw.discountPct) : '0',
    gstPct: cw.gstPct != null ? String(cw.gstPct) : '18',
    attachments: Array.isArray(cw.attachments)
      ? cw.attachments.map((f) => ({
          name: f.name || '',
          size: Number(f.size) || 0,
          type: f.type || '',
          data: f.data || ''
        }))
      : []
  };
}

export function cwStatusMeta(status) {
  const key = String(status || 'draft').toLowerCase();
  return CW_STATUS_META[key] || CW_STATUS_META.draft;
}

export function cwStatusLabel(status) {
  return cwStatusMeta(status).label;
}

export function buildCwLink(cw) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/cost-workouts/${cw.id}`;
}

export function shareCw(cw) {
  const url = buildCwLink(cw);
  const text = `${cw.cwNo || 'Cost Workout'}${cw.customerName ? ` · ${cw.customerName}` : ''} — ${url}`;
  const tryShare = () =>
    navigator.share ? navigator.share({ title: cw.cwNo || 'Cost Workout', text, url }) : Promise.reject(new Error('no-share'));
  return tryShare()
    .then(() => ({ ok: true, action: 'share' }))
    .catch((err) => {
      if (err && err.name === 'AbortError') return { ok: true, action: 'cancelled' };
      return navigator.clipboard
        .writeText(url)
        .then(() => ({ ok: true, action: 'copy' }))
        .catch((clipboardError) => ({ ok: false, error: clipboardError }));
    });
}

export function emailCw(cw) {
  try {
    const subject = encodeURIComponent(`${cw.cwNo || 'Cost Workout'}${cw.customerName ? ` - ${cw.customerName}` : ''}`);
    const doc = cwDocument(cw);
    const body = encodeURIComponent(
      `Dear Sir/Madam,\n\nPlease find the Cost Workout ${cw.cwNo} for your reference.\n\n` +
        `Customer: ${cw.customerName || '-'}\n` +
        `CPR Reference: ${cw.cprRef || '-'}\n` +
        `Subtotal: ${doc.subtotal}\nGrand Total: ${doc.grandTotal}\n\n` +
        `Reference: ${buildCwLink(cw)}`
    );
    window.location.href = `mailto:${cw.email || ''}?subject=${subject}&body=${body}`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to open email client' };
  }
}
