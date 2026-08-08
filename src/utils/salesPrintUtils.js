import { computeTotals, docNumber } from './salesHelpers';
import { formatDate, formatDateTime, formatINR } from './leadHelpers';

const ITEM_HEADERS = ['#', 'Product', 'Description', 'HSN', 'Unit', 'Qty', 'Rate', 'Disc %', 'GST %', 'Amount'];

function itemRowsHtml(items) {
  return items
    .map(
      (it, idx) =>
        `<tr><td>${idx + 1}</td><td>${it.productName || it.product || '—'}</td><td>${it.description || '—'}</td><td>${it.hsn || '—'}</td><td>${it.unit || '—'}</td><td style="text-align:right">${it.qty ?? '—'}</td><td style="text-align:right">${formatINR(Number(it.rate) || 0)}</td><td style="text-align:right">${it.discountPct ?? 0}%</td><td style="text-align:right">${it.gstRate ?? 0}%</td><td style="text-align:right">${formatINR(Number(it.amount) || 0)}</td></tr>`
    )
    .join('');
}

export function buildSalesPrintHtml(doc, title, moduleKey) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const totals = computeTotals(items, {
    discountPct: doc.discountPct ?? doc.discount ?? 0,
    charges: doc.charges ?? 0,
    roundOffEnabled: moduleKey === 'invoice'
  });
  const no = docNumber(doc, moduleKey);

  const summaryRows = [
    ['Sub Total', formatINR(totals.subTotal)],
    ['Discount', `− ${formatINR(totals.discount)}`],
    ['CGST', formatINR(totals.cgstTotal)],
    ['SGST', formatINR(totals.sgstTotal)],
    ['Tax Total', formatINR(totals.taxTotal)],
    ['Charges', formatINR(totals.charges)],
    ...(moduleKey === 'invoice' ? [['Round Off', formatINR(totals.roundOffAmount)]] : []),
    ['Grand Total', formatINR(totals.grandTotal)]
  ]
    .map(([k, v]) => `<tr><td class="k">${k}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`)
    .join('');

  // Payment receipts carry a single amount (no item grid) — render a receipt layout.
  if (moduleKey === 'paymentReceipt') {
    const receiptRows = [
      ['Receipt No', no || '—'],
      ['Payment Date', formatDate(doc.paymentDate || doc.createdAt)],
      ['Payment Mode', doc.paymentMode || '—'],
      ['Bank Name', doc.bankName || '—'],
      ['Branch', doc.branch || '—'],
      ['Cheque / Tx No', doc.chequeTx || '—'],
      ['Reference No', doc.referenceNo || '—'],
      ['Invoice Ref', doc.invoiceRef || '—'],
      ['Amount Received', formatINR(doc.amount ?? 0)],
      ['Status', doc.status || '—']
    ]
      .map(([k, v]) => `<tr><td class="k">${k}</td><td style="font-weight:600">${v}</td></tr>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title} - ${no || ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  .brand { color: #032f25; font-size: 22px; font-weight: 800; }
  .doc-title { font-size: 14px; color: #64748b; margin-top: 2px; }
  .meta { font-size: 11px; color: #64748b; margin: 4px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  td.k { width: 200px; color: #64748b; }
  .amount td { font-size: 16px; font-weight: 800; color: #032f25; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
  <div class="brand">VISHAK TECH</div>
  <div class="doc-title">${title}</div>
  <div class="meta">${no || ''} · Generated on ${formatDateTime(new Date().toISOString())}</div>
  <table>
    ${receiptRows}
    <tr class="amount"><td class="k">Amount Received</td><td>${formatINR(doc.amount ?? 0)}</td></tr>
  </table>
  ${doc.remarks ? `<div style="font-size:12px;color:#475569;white-space:pre-wrap"><strong>Remarks:</strong> ${doc.remarks}</div>` : ''}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
  }

  // Module-specific info block: transport details for Delivery Challans (ERP
  // delivery-challan-print.html) and source/validity for Proforma Invoices.
  const moduleInfoBlock =
    moduleKey === 'deliveryChallan'
      ? `<div style="display:flex;gap:32px;margin:0 0 20px">
          <div>
            <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Transport</h3>
            <p style="margin:2px 0;font-size:12px"><strong>${doc.transportCompany || '—'}</strong></p>
            ${doc.vehicleNumber ? `<p style="margin:2px 0;font-size:12px">Vehicle: ${doc.vehicleNumber}</p>` : ''}
            ${doc.driverName ? `<p style="margin:2px 0;font-size:12px">Driver: ${doc.driverName}${doc.driverPhone ? ` (${doc.driverPhone})` : ''}</p>` : ''}
            ${doc.lrNumber ? `<p style="margin:2px 0;font-size:12px">LR No: ${doc.lrNumber}</p>` : ''}
            ${doc.ewayBill ? `<p style="margin:2px 0;font-size:12px">E-Way Bill: ${doc.ewayBill}</p>` : ''}
            ${doc.dispatchDate ? `<p style="margin:2px 0;font-size:12px">Dispatch: ${formatDate(doc.dispatchDate)}</p>` : ''}
            ${doc.deliveryDate ? `<p style="margin:2px 0;font-size:12px">Expected Delivery: ${formatDate(doc.deliveryDate)}</p>` : ''}
          </div>
          <div>
            <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Challan</h3>
            ${doc.soRef ? `<p style="margin:2px 0;font-size:12px">SO Ref: ${doc.soRef}</p>` : ''}
            ${doc.scRef ? `<p style="margin:2px 0;font-size:12px">Contract Ref: ${doc.scRef}</p>` : ''}
            ${doc.status ? `<p style="margin:2px 0;font-size:12px">Status: ${doc.status}</p>` : ''}
          </div>
        </div>`
      : moduleKey === 'proformaInvoice' && (doc.validTill || doc.source || doc.referenceNo)
        ? `<div style="display:flex;gap:32px;margin:0 0 20px">
            <div>
              <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Proforma</h3>
              ${doc.referenceNo ? `<p style="margin:2px 0;font-size:12px">Reference: ${doc.referenceNo}</p>` : ''}
              ${doc.source ? `<p style="margin:2px 0;font-size:12px">Source: ${doc.source}</p>` : ''}
              ${doc.sourceRef ? `<p style="margin:2px 0;font-size:12px">Source Ref: ${doc.sourceRef}</p>` : ''}
              ${doc.validTill ? `<p style="margin:2px 0;font-size:12px">Valid Till: ${formatDate(doc.validTill)}</p>` : ''}
            </div>
          </div>`
        : '';

  const companyBlock = doc.companyName
    ? `
      <div>
        <h3>From</h3>
        <p><strong>${doc.companyName}</strong></p>
        ${doc.companyAddress ? `<p>${doc.companyAddress}</p>` : ''}
        ${doc.companyGstin ? `<p>GSTIN: ${doc.companyGstin}</p>` : ''}
        ${doc.companyPan ? `<p>PAN: ${doc.companyPan}</p>` : ''}
      </div>`
    : '';

  const bankBlock =
    doc.bankName || doc.bankAccount || doc.bankIfsc
      ? `
      <div>
        <h3>Bank Details</h3>
        ${doc.bankName ? `<p>Bank: ${doc.bankName}</p>` : ''}
        ${doc.bankAccount ? `<p>A/C: ${doc.bankAccount}</p>` : ''}
        ${doc.bankIfsc ? `<p>IFSC: ${doc.bankIfsc}</p>` : ''}
        ${doc.bankBranch ? `<p>Branch: ${doc.bankBranch}</p>` : ''}
        ${doc.bankUpi ? `<p>UPI: ${doc.bankUpi}</p>` : ''}
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title} - ${no || ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  .brand { color: #032f25; font-size: 22px; font-weight: 800; }
  .doc-title { font-size: 14px; color: #64748b; margin-top: 2px; }
  .meta { font-size: 11px; color: #64748b; margin: 4px 0 16px; }
  .cols { display: flex; gap: 32px; margin-bottom: 20px; }
  .cols h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin: 0 0 6px; }
  .cols p { margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
  thead th { background: #032f25; color: #f1f5f9; text-align: left; padding: 7px 8px; text-transform: uppercase; font-size: 9px; letter-spacing: .04em; }
  tbody td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
  tr.sum th { background: #f1f5f9; color: #032f25; text-align: right; padding: 7px 8px; }
  .info td.k { width: 150px; color: #64748b; }
  .info td { padding: 3px 8px; font-size: 12px; }
  .summary { width: 320px; margin-left: auto; }
  .summary td.k { width: 140px; color: #64748b; }
  .summary td { padding: 4px 8px; font-size: 12px; }
  .total-row td { font-size: 14px; font-weight: 800; color: #032f25; border-top: 2px solid #032f25; }
  .remarks { font-size: 12px; color: #475569; white-space: pre-wrap; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
  <div class="brand">VISHAK TECH</div>
  <div class="doc-title">${title}</div>
  <div class="meta">${no || ''} · Generated on ${formatDateTime(new Date().toISOString())}</div>
  <div class="cols">
    ${companyBlock}
    <div>
      <h3>Bill To</h3>
      <p><strong>${doc.clientName || doc.client || '—'}</strong></p>
      ${doc.contactPerson ? `<p>${doc.contactPerson}</p>` : ''}
      ${doc.phone ? `<p>${doc.phone}</p>` : ''}
      ${doc.email ? `<p>${doc.email}</p>` : ''}
      ${doc.gstin ? `<p>GSTIN: ${doc.gstin}</p>` : ''}
      ${doc.pan ? `<p>PAN: ${doc.pan}</p>` : ''}
      ${doc.billingAddress ? `<p>${doc.billingAddress}</p>` : ''}
      ${doc.shippingAddress && doc.shippingAddress !== doc.billingAddress ? `<p><strong>Ship To:</strong> ${doc.shippingAddress}</p>` : ''}
    </div>
    ${bankBlock}
  </div>
  ${moduleInfoBlock}
  <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Items</h3>
  <table>
    <thead><tr>${ITEM_HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${itemRowsHtml(items)}
      <tr class="sum"><th colspan="9">Total</th><th>${formatINR(totals.grandTotal)}</th></tr>
    </tbody>
  </table>
  <table class="summary">${summaryRows}</table>
  ${doc.remarks ? `<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Remarks</h3><div class="remarks">${doc.remarks}</div>` : ''}
  ${doc.notes ? `<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Notes</h3><div class="remarks">${doc.notes}</div>` : ''}
  ${doc.terms ? `<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Terms</h3><div class="remarks">${doc.terms}</div>` : ''}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

export async function exportSalesDocumentPdf(doc, title, moduleKey, filename) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const items = Array.isArray(doc.items) ? doc.items : [];
  const totals = computeTotals(items, {
    discountPct: doc.discountPct ?? doc.discount ?? 0,
    charges: doc.charges ?? 0,
    roundOffEnabled: moduleKey === 'invoice'
  });
  const no = docNumber(doc, moduleKey);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

  pdf.setFontSize(20);
  pdf.setTextColor(3, 47, 37);
  pdf.text('VISHAK TECH', 40, 45);
  pdf.setFontSize(11);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${title} · ${no || ''}`, 40, 62);

  const infoLines = [
    ['Date', formatDate(doc[`${moduleKey === 'invoice' ? 'invoice' : moduleKey === 'quotation' ? 'quotation' : moduleKey === 'salesContract' ? 'contract' : moduleKey === 'salesOrder' ? 'order' : moduleKey === 'deliveryChallan' ? 'challan' : moduleKey === 'proformaInvoice' ? 'proforma' : moduleKey === 'paymentReceipt' ? 'payment' : 'creditNote'}Date`] || doc.createdAt)],
    ['Client', doc.clientName || doc.client || '—'],
    ['Contact', doc.contactPerson || '—'],
    ['Phone', doc.phone || '—'],
    ['Email', doc.email || '—'],
    ['GSTIN', doc.gstin || '—'],
    ...(moduleKey === 'deliveryChallan'
      ? [
          ['SO Ref', doc.soRef || '—'],
          ['Transport', doc.transportCompany || '—'],
          ['Vehicle', doc.vehicleNumber || '—'],
          ['Driver', doc.driverName || '—'],
          ['LR No', doc.lrNumber || '—'],
          ['E-Way Bill', doc.ewayBill || '—'],
          ['Dispatch', formatDate(doc.dispatchDate)],
          ['Expected Delivery', formatDate(doc.deliveryDate)]
        ]
      : moduleKey === 'proformaInvoice'
        ? [
            ['Reference', doc.referenceNo || '—'],
            ['Valid Till', formatDate(doc.validTill)],
            ['Source', doc.source || '—'],
            ['Source Ref', doc.sourceRef || '—']
          ]
        : [])
  ].filter(([, v]) => v && v !== '—');

  autoTable(pdf, {
    startY: 80,
    head: [['Field', 'Value']],
    body: infoLines,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } }
  });

  // Payment receipts carry a single amount — render a receipt body instead of an item table.
  if (moduleKey === 'paymentReceipt') {
    const receiptBody = [
      ['Receipt No', no || '—'],
      ['Payment Date', formatDate(doc.paymentDate || doc.createdAt)],
      ['Payment Mode', doc.paymentMode || '—'],
      ['Bank Name', doc.bankName || '—'],
      ['Branch', doc.branch || '—'],
      ['Cheque / Tx No', doc.chequeTx || '—'],
      ['Reference No', doc.referenceNo || '—'],
      ['Invoice Ref', doc.invoiceRef || '—'],
      ['Status', doc.status || '—']
    ];
    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || 80) + 16,
      head: [['Field', 'Value']],
      body: receiptBody,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 } }
    });
    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || 200) + 14,
      head: [['Amount Received', '']],
      body: [['', formatINR(doc.amount ?? 0)]],
      theme: 'grid',
      styles: { fontSize: 13, fontStyle: 'bold', textColor: [3, 47, 37] },
      headStyles: { fillColor: [3, 47, 37], textColor: 255 },
      columnStyles: { 1: { halign: 'right' } }
    });
  } else {
    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || 80) + 16,
      head: [ITEM_HEADERS],
      body: items.map((it, idx) => [
        String(idx + 1),
        it.productName || it.product || '—',
        it.description || '—',
        it.hsn || '—',
        it.unit || '—',
        String(it.qty ?? '—'),
        formatINR(Number(it.rate) || 0),
        `${it.discountPct ?? 0}%`,
        `${it.gstRate ?? 0}%`,
        formatINR(Number(it.amount) || 0)
      ]),
      styles: { fontSize: 7.5, cellPadding: 3, textColor: [30, 41, 59] },
      headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    autoTable(pdf, {
      startY: (pdf.lastAutoTable?.finalY || 200) + 14,
      head: [['Summary', '']],
      body: [
        ['Sub Total', formatINR(totals.subTotal)],
        ['Discount', `− ${formatINR(totals.discount)}`],
        ['CGST', formatINR(totals.cgstTotal)],
        ['SGST', formatINR(totals.sgstTotal)],
        ['Tax Total', formatINR(totals.taxTotal)],
        ['Charges', formatINR(totals.charges)],
        ...(moduleKey === 'invoice' ? [['Round Off', formatINR(totals.roundOffAmount)]] : []),
        ['Grand Total', formatINR(totals.grandTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });
  }

  const notes = [doc.remarks, doc.notes, doc.terms].filter(Boolean).join('\n\n');
  if (notes) {
    const y = (pdf.lastAutoTable?.finalY || 300) + 16;
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Notes / Terms', 40, y);
    pdf.setTextColor(71, 85, 105);
    pdf.splitTextToSize(notes, 500).slice(0, 14).forEach((line, i) => {
      pdf.text(line, 40, y + 14 + i * 12);
    });
  }

  pdf.save(`${filename}.pdf`);
}

export function buildSalesCsvRow(doc, moduleKey, columns) {
  return columns.map((col) => {
    if (col.render) return col.render(doc);
    return doc[col.key] != null ? String(doc[col.key]) : '';
  });
}
