import { DOC_PREFIXES } from '../constants/salesConstants';

// ===== Shared numeric helpers =====

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function round2(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

export function roundOff(value) {
  const n = round2(value);
  return Math.round(n);
}

// ===== Item line calculation (matches original ERP: qty × rate, discount, GST, amount) =====

export function lineAmount(item) {
  const qty = num(item.qty, 1);
  const rate = num(item.rate);
  const total = round2(qty * rate);
  const discount = round2((total * num(item.discountPct)) / 100);
  const taxable = round2(total - discount);
  const tax = round2((taxable * num(item.gstRate)) / 100);
  return { qty, rate, total, discount, taxable, tax, amount: round2(taxable + tax) };
}

export function computeTotals(items = [], { discountPct = 0, charges = 0, roundOffEnabled = false } = {}) {
  const lines = items.map(lineAmount);
  const subTotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const discount = round2((subTotal * num(discountPct)) / 100);
  const cgstTotal = round2(lines.reduce((sum, l) => sum + l.tax / 2, 0));
  const sgstTotal = round2(lines.reduce((sum, l) => sum + l.tax / 2, 0));
  const taxTotal = round2(lines.reduce((sum, l) => sum + l.tax, 0));
  const chargesValue = round2(num(charges));
  const grandTotal = round2(subTotal - discount + taxTotal + chargesValue);
  const finalGrand = roundOffEnabled ? roundOff(grandTotal) : grandTotal;
  return {
    lines,
    subTotal,
    discount,
    discountPct: num(discountPct),
    cgstTotal,
    sgstTotal,
    taxTotal,
    charges: chargesValue,
    grandTotal: round2(finalGrand),
    roundOffAmount: round2(finalGrand - grandTotal)
  };
}

// ===== Normalizers =====

function normalizeBase(raw) {
  return {
    ...raw,
    id: raw.id,
    client: raw.client || raw.clientName || '',
    clientName: raw.clientName || raw.client || '',
    status: raw.status || 'draft',
    items: Array.isArray(raw.items) ? raw.items : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    createdAt: raw.createdAt || raw.date || raw.updatedAt || ''
  };
}

export function normalizeQuotation(raw = {}) {
  return normalizeBase(raw);
}

export function normalizeSalesContract(raw = {}) {
  return normalizeBase(raw);
}

export function normalizeSalesOrder(raw = {}) {
  return normalizeBase(raw);
}

export function normalizeDeliveryChallan(raw = {}) {
  return normalizeBase(raw);
}

export function normalizeProformaInvoice(raw = {}) {
  return normalizeBase(raw);
}

export function normalizeInvoice(raw = {}) {
  return normalizeBase(raw);
}

export function normalizePaymentReceipt(raw = {}) {
  return normalizeBase(raw);
}

export function normalizeCreditNote(raw = {}) {
  return normalizeBase(raw);
}

export const NORMALIZERS = {
  quotation: normalizeQuotation,
  salesContract: normalizeSalesContract,
  salesOrder: normalizeSalesOrder,
  deliveryChallan: normalizeDeliveryChallan,
  proformaInvoice: normalizeProformaInvoice,
  invoice: normalizeInvoice,
  paymentReceipt: normalizePaymentReceipt,
  creditNote: normalizeCreditNote
};

// ===== Generic serializers (empty values dropped, items mapped) =====

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

function mapItems(items) {
  // Only real item rows may be persisted. Group/description/image rows are
  // design-time only (like the old ERP) — skipping them here prevents them
  // from ever reaching the backend as junk line items.
  return (Array.isArray(items) ? items : [])
    .filter((item) => !item || !item.rowType || item.rowType === 'item')
    .map((item) =>
    clean({
      productId: item.productId,
      productName: item.productName || item.product || '',
      // sku was previously dropped here — the backend persists it (QuotationItemRequest.sku)
      sku: item.sku || '',
      description: item.description || '',
      hsn: item.hsn || '',
      // backend field is uom (QuotationItemRequest.uom); accept both spellings so the
      // stored unit/UOM survives save + refresh
      uom: item.unit || item.uom || '',
      qty: item.qty != null && item.qty !== '' ? Number(item.qty) : 1,
      rate: item.rate != null && item.rate !== '' ? Number(item.rate) : 0,
      discountPct: item.discountPct != null && item.discountPct !== '' ? Number(item.discountPct) : 0,
      gstRate: item.gstRate != null && item.gstRate !== '' ? Number(item.gstRate) : 0,
      amount: item.amount != null && item.amount !== '' ? Number(item.amount) : 0
    })
  );
}

export function serializeQuotation(form = {}, items = []) {
  return clean({
    quotationNo: form.quotationNo,
    reference: form.reference,
    quotationDate: form.quotationDate,
    validUntil: form.validUntil,
    leadNo: form.leadNo,
    sourceCw: form.sourceCw,
    sourceCpr: form.sourceCpr,
    fromCompany: form.fromCompany,
    fromName: form.fromName,
    fromAddress: form.fromAddress,
    fromGstin: form.fromGstin,
    fromPan: form.fromPan,
    fromEmail: form.fromEmail,
    fromPhone: form.fromPhone,
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    email: form.email,
    phone: form.phone,
    address: form.address,
    city: form.city,
    state: form.state,
    pin: form.pin,
    country: form.country,
    gstin: form.gstin,
    pan: form.pan,
    billingAddress: form.billingAddress,
    billingCity: form.billingCity,
    billingState: form.billingState,
    billingPin: form.billingPin,
    shipSameAsBill: !!form.shipSameAsBill,
    shippingAddress: form.shippingAddress,
    shippingCity: form.shippingCity,
    shippingState: form.shippingState,
    shippingPin: form.shippingPin,
    taxType: form.taxType,
    currency: form.currency,
    exchangeRate:
      form.exchangeRate != null && form.exchangeRate !== '' ? Number(form.exchangeRate) : undefined,
    baseCurrency: form.baseCurrency || undefined,
    numberFormat: form.numberFormat,
    status: form.status || 'draft',
    salesPerson: form.salesPerson,
    paymentTerms: form.paymentTerms,
    deliveryTerms: form.deliveryTerms,
    remarks: form.remarks,
    terms: form.terms,
    discount: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    freight: form.freight != null && form.freight !== '' ? Number(form.freight) : 0,
    insurance: form.insurance != null && form.insurance !== '' ? Number(form.insurance) : 0,
    signatureType: form.signatureType,
    signatureLabel: form.signatureLabel,
    hsnView: form.hsnView,
    displayUnit: form.displayUnit,
    additionalInfo: form.additionalInfo,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    items: mapItems(items)
  });
}

export function serializeSalesContract(form = {}, items = []) {
  return clean({
    scNo: form.scNo,
    poRef: form.poRef,
    contractDate: form.contractDate,
    leadNo: form.leadNo,
    qtnRef: form.qtnRef,
    status: form.status || 'draft',
    currency: form.currency,
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    email: form.email,
    phone: form.phone,
    city: form.city,
    state: form.state,
    billingAddress: form.billingAddress,
    shippingAddress: form.shippingAddress,
    gstin: form.gstin,
    pan: form.pan,
    paymentTerms: form.paymentTerms,
    deliveryTerms: form.deliveryTerms,
    salesExecutive: form.salesExecutive,
    validity: form.validity,
    duration: form.duration,
    warranty: form.warranty,
    commercialTerms: form.commercialTerms,
    scope: form.scope,
    exclusions: form.exclusions,
    remarks: form.remarks,
    discount: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    items: mapItems(items)
  });
}

export function serializeSalesOrder(form = {}, items = []) {
  return clean({
    soNo: form.soNo,
    customerPo: form.customerPo,
    orderDate: form.orderDate,
    leadNo: form.leadNo,
    scRef: form.scRef,
    qtnRef: form.qtnRef,
    status: form.status || 'draft',
    currency: form.currency,
    priority: form.priority,
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    email: form.email,
    phone: form.phone,
    city: form.city,
    state: form.state,
    billingAddress: form.billingAddress,
    shippingAddress: form.shippingAddress,
    gstin: form.gstin,
    pan: form.pan,
    paymentTerms: form.paymentTerms,
    salesExecutive: form.salesExecutive,
    deliveryDate: form.deliveryDate,
    deliveryTerms: form.deliveryTerms,
    terms: form.terms,
    remarks: form.remarks,
    discount: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    items: mapItems(items)
  });
}

export function serializeDeliveryChallan(form = {}, items = []) {
  return clean({
    dcNo: form.dcNo,
    soRef: form.soRef,
    dcDate: form.dcDate,
    scRef: form.scRef,
    status: form.status || 'draft',
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    email: form.email,
    phone: form.phone,
    billingAddress: form.billingAddress,
    shippingAddress: form.shippingAddress,
    city: form.city,
    state: form.state,
    transportCompany: form.transportCompany,
    vehicleNumber: form.vehicleNumber,
    driverName: form.driverName,
    driverPhone: form.driverPhone,
    lrNumber: form.lrNumber,
    ewayBill: form.ewayBill,
    dispatchDate: form.dispatchDate,
    deliveryDate: form.deliveryDate,
    notes: form.notes,
    terms: form.terms,
    discount: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    items: mapItems(items)
  });
}

export function serializeProformaInvoice(form = {}, items = []) {
  return clean({
    piNo: form.piNo,
    piDate: form.piDate,
    referenceNo: form.referenceNo,
    validTill: form.validTill,
    source: form.source,
    sourceRef: form.sourceRef,
    status: form.status || 'draft',
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    gstin: form.gstin,
    pan: form.pan,
    email: form.email,
    phone: form.phone,
    billingAddress: form.billingAddress,
    shipSameAsBill: !!form.shipSameAsBill,
    shippingAddress: form.shippingAddress,
    bankName: form.bankName,
    bankAccount: form.bankAccount,
    bankIfsc: form.bankIfsc,
    bankBranch: form.bankBranch,
    bankType: form.bankType,
    bankUpi: form.bankUpi,
    terms: form.terms,
    notes: form.notes,
    // ERP proforma uses a PERCENTAGE discount (Discount % input → Discount
    // Amount display); the backend computes the flat amount from this pct.
    discountPct: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    items: mapItems(items)
  });
}

export function serializeInvoice(form = {}, items = []) {
  return clean({
    invoiceNo: form.invoiceNo,
    companyName: form.companyName,
    companyGstin: form.companyGstin,
    companyPan: form.companyPan,
    companyState: form.companyState,
    companyAddress: form.companyAddress,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate,
    referenceNo: form.referenceNo,
    source: form.source,
    sourceRef: form.sourceRef,
    status: form.status || 'draft',
    paymentStatus: form.paymentStatus || 'unpaid',
    bankName: form.bankName,
    bankAccount: form.bankAccount,
    bankIfsc: form.bankIfsc,
    bankBranch: form.bankBranch,
    bankType: form.bankType,
    bankUpi: form.bankUpi,
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    gstin: form.gstin,
    pan: form.pan,
    email: form.email,
    phone: form.phone,
    billingAddress: form.billingAddress,
    shipSameAsBill: !!form.shipSameAsBill,
    shippingAddress: form.shippingAddress,
    terms: form.terms,
    notes: form.notes,
    discountPct: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    items: mapItems(items)
  });
}

export function serializePaymentReceipt(form = {}) {
  return clean({
    receiptNo: form.receiptNo,
    companyName: form.companyName,
    companyGstin: form.companyGstin,
    companyPan: form.companyPan,
    companyState: form.companyState,
    companyAddress: form.companyAddress,
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    gstin: form.gstin,
    email: form.email,
    phone: form.phone,
    paymentDate: form.paymentDate,
    paymentMode: form.paymentMode,
    bankName: form.bankName,
    branch: form.branch,
    chequeTx: form.chequeTx,
    referenceNo: form.referenceNo,
    status: form.status || 'draft',
    source: form.source,
    invoiceRef: form.invoiceRef,
    amount: form.amount != null && form.amount !== '' ? Number(form.amount) : 0,
    remarks: form.remarks
  });
}

export function serializeCreditNote(form = {}, items = []) {
  return clean({
    cnNo: form.cnNo,
    cnDate: form.cnDate,
    status: form.status || 'draft',
    source: form.source,
    sourceRef: form.sourceRef,
    reason: form.reason,
    refundAmount: form.refundAmount != null && form.refundAmount !== '' ? Number(form.refundAmount) : 0,
    returnQty: form.returnQty != null && form.returnQty !== '' ? Number(form.returnQty) : 0,
    reasonDetail: form.reasonDetail,
    inventoryImpact: form.inventoryImpact,
    companyName: form.companyName,
    companyGstin: form.companyGstin,
    companyPan: form.companyPan,
    companyState: form.companyState,
    companyAddress: form.companyAddress,
    clientId: form.clientId != null && form.clientId !== '' ? Number(form.clientId) : null,
    clientName: form.clientName,
    contactPerson: form.contactPerson,
    gstin: form.gstin,
    email: form.email,
    phone: form.phone,
    discountPct: form.discountPct != null && form.discountPct !== '' ? Number(form.discountPct) : 0,
    charges: form.charges != null && form.charges !== '' ? Number(form.charges) : 0,
    items: mapItems(items)
  });
}

export const SERIALIZERS = {
  quotation: serializeQuotation,
  salesContract: serializeSalesContract,
  salesOrder: serializeSalesOrder,
  deliveryChallan: serializeDeliveryChallan,
  proformaInvoice: serializeProformaInvoice,
  invoice: serializeInvoice,
  paymentReceipt: serializePaymentReceipt,
  creditNote: serializeCreditNote
};

// ===== Document display helpers =====

export function docNumber(doc, moduleKey) {
  const field = {
    quotation: 'quotationNo',
    salesContract: 'scNo',
    salesOrder: 'soNo',
    deliveryChallan: 'dcNo',
    proformaInvoice: 'piNo',
    invoice: 'invoiceNo',
    paymentReceipt: 'receiptNo',
    creditNote: 'cnNo'
  }[moduleKey];
  return doc?.[field] || '';
}

export function buildDocLink(doc, moduleKey) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const route = {
    quotation: 'quotations',
    salesContract: 'sales-contracts',
    salesOrder: 'sales-orders',
    deliveryChallan: 'delivery-challans',
    proformaInvoice: 'proforma-invoices',
    invoice: 'invoices',
    paymentReceipt: 'payment-receipts',
    creditNote: 'credit-notes'
  }[moduleKey];
  return `${origin}/${route}/${doc.id}`;
}

export function shareDocument(doc, moduleKey, label) {
  const url = buildDocLink(doc, moduleKey);
  const text = `${docNumber(doc, moduleKey) || label}${doc.client ? ` · ${doc.client}` : ''} — ${url}`;
  return navigator.share
    ? navigator.share({ title: docNumber(doc, moduleKey) || label, text, url }).then(
        () => ({ ok: true, action: 'share' }),
        (err) => {
          if (err?.name === 'AbortError') return { ok: true, action: 'cancelled' };
          return navigator.clipboard.writeText(url).then(() => ({ ok: true, action: 'copy' }));
        }
      )
    : navigator.clipboard.writeText(url).then(() => ({ ok: true, action: 'copy' }));
}

export function emailDocument(doc, moduleKey, label) {
  try {
    const subject = encodeURIComponent(`${docNumber(doc, moduleKey) || label}${doc.client ? ` - ${doc.client}` : ''}`);
    const body = encodeURIComponent(
      `Dear ${doc.contactPerson || 'Sir/Madam'},\n\nPlease find the ${label} ${docNumber(doc, moduleKey) || ''} for your reference.\n\n` +
        `Reference: ${buildDocLink(doc, moduleKey)}`
    );
    window.location.href = `mailto:${doc.email || ''}?subject=${subject}&body=${body}`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to open email client' };
  }
}

export function whatsappDocument(doc, moduleKey, label) {
  try {
    const text = encodeURIComponent(
      `Hello${doc.contactPerson ? ' ' + doc.contactPerson : ''},\n\nPlease find the ${label} ${docNumber(doc, moduleKey) || ''} for your reference.\n\n` +
        `Reference: ${buildDocLink(doc, moduleKey)}`
    );
    const phone = doc.phone ? doc.phone.replace(/[^0-9]/g, '') : '';
    const url = `https://wa.me/${phone ? '91' + (phone.startsWith('91') ? phone.slice(2) : phone) : ''}?text=${text}`;
    window.open(url, '_blank');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to open WhatsApp' };
  }
}

export function prefixFor(moduleKey) {
  return DOC_PREFIXES[moduleKey] || '';
}
