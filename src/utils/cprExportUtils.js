import { cprDocument } from './cprHelpers';
import { downloadBlob, formatDate, formatDateTime, formatINR, todayISO } from './leadHelpers';

export const CPR_EXPORT_COLUMNS = [
  { key: 'prNo', label: 'CPR No' },
  { key: 'leadNo', label: 'Lead No' },
  { key: 'client', label: 'Client' },
  { key: 'company', label: 'Company' },
  { key: 'description', label: 'Description' },
  { key: 'project', label: 'Project' },
  { key: 'department', label: 'Department' },
  { key: 'requestedBy', label: 'Requested By' },
  { key: 'priority', label: 'Priority' },
  { key: 'costWorkout', label: 'Cost Workout' },
  { key: 'profitPercent', label: 'Profit %' },
  { key: 'status', label: 'Status' },
  { key: 'approvalStatus', label: 'Approval' },
  { key: 'createdAt', label: 'Created Date' },
  { key: 'grandTotal', label: 'Total Amount' },
  { key: 'convertedToQtn', label: 'Quotation' }
];

export function cprCellValue(cpr, key) {
  switch (key) {
    case 'client':
      return cpr.client || cpr.clientName || '';
    case 'costWorkout':
      return cpr.costWorkout != null ? formatINR(cpr.costWorkout) : '';
    case 'profitPercent':
      return cpr.profitPercent != null ? `${cpr.profitPercent}%` : '';
    case 'status':
      return String(cpr.status || 'draft').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    case 'approvalStatus':
      return cpr.approvalStatus || '';
    case 'createdAt':
      return formatDate(cpr.createdAt || cpr.prDate);
    case 'grandTotal':
      return cpr.grandTotal != null ? formatINR(cpr.grandTotal) : '';
    default:
      return cpr[key] != null ? String(cpr[key]) : '';
  }
}

function escapeCSV(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCprsCsv(cprs, filename) {
  const header = CPR_EXPORT_COLUMNS.map((c) => c.label);
  const body = cprs.map((cpr) => CPR_EXPORT_COLUMNS.map((c) => escapeCSV(cprCellValue(cpr, c.key))));
  const csv = [header, ...body].map((row) => row.join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// Mirrors the original ERP's bulkExport (pr-module.js): selected rows only,
// exact 7-column order, filename 'CPR_Bulk_YYYY-MM-DD.csv'.
export function exportCprsBulkCsv(selected, filename) {
  const headers = ['CPR No', 'Date', 'Client', 'Lead No', 'Department', 'Status', 'Amount'];
  const rows = selected.map((pr) => [
    escapeCSV(pr.prNo || pr.id || ''),
    escapeCSV(String(pr.createdAt || pr.prDate || '').substring(0, 10)),
    escapeCSV(pr.client || pr.clientName || ''),
    escapeCSV(pr.leadNo || ''),
    escapeCSV(pr.department || ''),
    escapeCSV(pr.status || ''),
    escapeCSV(pr.grandTotal || pr.subtotal || 0)
  ]);
  const csv = [headers, ...rows].map((row) => row.join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// Mirrors the original ERP's cwBulkExport (cost-workout-list.html): selected
// rows only, exact 10-column order, filename 'CostWorkout_Bulk_YYYY-MM-DD.csv'.
export function exportCwsBulkCsv(selected, filename) {
  const headers = ['CW No', 'CPR No', 'Customer', 'Company', 'Description', 'Prepared By', 'Total Cost', 'Profit %', 'Selling Price', 'Status'];
  const rows = selected.map((cw) => {
    const firstItem = cw.items && cw.items[0] ? cw.items[0] : null;
    const desc = firstItem ? firstItem.description || '' : '';
    return [
      escapeCSV(cw.cwNo || cw.id || ''),
      escapeCSV(cw.cprRef || ''),
      escapeCSV(cw.customerName || ''),
      escapeCSV(cw.companyName || ''),
      escapeCSV(desc),
      escapeCSV(cw.preparedBy || ''),
      escapeCSV(cw.subtotal || 0),
      escapeCSV(cw.profitPct != null ? `${cw.profitPct}%` : ''),
      escapeCSV(cw.sellingPrice || 0),
      escapeCSV(cw.status || '')
    ];
  });
  const csv = [headers, ...rows].map((row) => row.join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportCprsExcel(cprs, filename) {
  const XLSX = await import('xlsx');
  const header = CPR_EXPORT_COLUMNS.map((c) => c.label);
  const body = cprs.map((cpr) => CPR_EXPORT_COLUMNS.map((c) => cprCellValue(cpr, c.key)));
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CPRs');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportCprsPdf(cprs, filename) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.setTextColor(3, 47, 37);
  doc.text('CPR Report', 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${formatDate(todayISO())} - ${cprs.length} records`, 40, 55);

  const columns = CPR_EXPORT_COLUMNS.map((c) => ({ header: c.label, dataKey: c.key }));
  const body = cprs.map((cpr) => {
    const row = {};
    CPR_EXPORT_COLUMNS.forEach((c) => {
      row[c.key] = cprCellValue(cpr, c.key);
    });
    return row;
  });

  autoTable(doc, {
    startY: 70,
    columns,
    body,
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 40, bottom: 30 }
  });

  doc.save(`${filename}.pdf`);
}

export function printCprs(cprs) {
  const header = CPR_EXPORT_COLUMNS.map((c) => `<th>${c.label}</th>`).join('');
  const body = cprs
    .map((cpr) => `<tr>${CPR_EXPORT_COLUMNS.map((c) => `<td>${cprCellValue(cpr, c.key)}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CPR Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  h1 { color: #032f25; font-size: 20px; margin: 0 0 4px; }
  p.meta { color: #64748b; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #032f25; color: #f1f5f9; text-align: left; padding: 7px; text-transform: uppercase; font-size: 9px; letter-spacing: .04em; }
  tbody td { border-bottom: 1px solid #e2e8f0; padding: 6px 7px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  @media print { body { margin: 8mm; } thead { display: table-header-group; } }
</style>
</head>
<body>
<h1>CPR Report</h1>
<p class="meta">Generated on ${formatDate(todayISO())} - ${cprs.length} records</p>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ===== Cost Workout export helpers (matching the original ERP export layout) =====

export const CW_EXPORT_COLUMNS = [
  { key: 'cwNo', label: 'CW No' },
  { key: 'cprRef', label: 'CPR No' },
  { key: 'customerName', label: 'Customer' },
  { key: 'company', label: 'Company' },
  { key: 'description', label: 'Description' },
  { key: 'preparedBy', label: 'Prepared By' },
  { key: 'subtotal', label: 'Cost Amount' },
  { key: 'profitPct', label: 'Profit %' },
  { key: 'sellingPrice', label: 'Selling Price' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created Date' }
];

export function cwCellValue(cw, key) {
  switch (key) {
    case 'description':
      return Array.isArray(cw.items) && cw.items[0] ? cw.items[0].description || '' : '';
    case 'subtotal':
      return cw.subtotal != null ? formatINR(cw.subtotal) : '';
    case 'profitPct':
      return cw.profitPct != null ? `${cw.profitPct}%` : '';
    case 'sellingPrice':
      return cw.sellingPrice != null ? formatINR(cw.sellingPrice) : '';
    case 'status':
      return cw.status || '';
    case 'createdAt':
      return formatDate(cw.createdAt || cw.cwDate);
    default:
      return cw[key] != null ? String(cw[key]) : '';
  }
}

export function exportCwsCsv(cws, filename) {
  const header = CW_EXPORT_COLUMNS.map((c) => c.label);
  const body = cws.map((cw) => CW_EXPORT_COLUMNS.map((c) => escapeCSV(cwCellValue(cw, c.key))));
  const csv = [header, ...body].map((row) => row.join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportCwsExcel(cws, filename) {
  const XLSX = await import('xlsx');
  const header = CW_EXPORT_COLUMNS.map((c) => c.label);
  const body = cws.map((cw) => CW_EXPORT_COLUMNS.map((c) => cwCellValue(cw, c.key)));
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Workouts');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportCwsPdf(cws, filename) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.setTextColor(3, 47, 37);
  doc.text('Cost Workout Report', 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${formatDate(todayISO())} - ${cws.length} records`, 40, 55);

  const columns = CW_EXPORT_COLUMNS.map((c) => ({ header: c.label, dataKey: c.key }));
  const body = cws.map((cw) => {
    const row = {};
    CW_EXPORT_COLUMNS.forEach((c) => {
      row[c.key] = cwCellValue(cw, c.key);
    });
    return row;
  });

  autoTable(doc, {
    startY: 70,
    columns,
    body,
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 40, bottom: 30 }
  });

  doc.save(`${filename}.pdf`);
}

export function printCws(cws) {
  const header = CW_EXPORT_COLUMNS.map((c) => `<th>${c.label}</th>`).join('');
  const body = cws
    .map((cw) => `<tr>${CW_EXPORT_COLUMNS.map((c) => `<td>${cwCellValue(cw, c.key)}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Cost Workout Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  h1 { color: #032f25; font-size: 20px; margin: 0 0 4px; }
  p.meta { color: #64748b; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #032f25; color: #f1f5f9; text-align: left; padding: 7px; text-transform: uppercase; font-size: 9px; letter-spacing: .04em; }
  tbody td { border-bottom: 1px solid #e2e8f0; padding: 6px 7px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  @media print { body { margin: 8mm; } thead { display: table-header-group; } }
</style>
</head>
<body>
<h1>Cost Workout Report</h1>
<p class="meta">Generated on ${formatDate(todayISO())} - ${cws.length} records</p>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function docLines(cpr) {
  const d = cprDocument(cpr);
  const c = cpr;
  const lines = [
    { label: 'CPR No', value: c.prNo || '—' },
    { label: 'Date', value: formatDate(c.prDate || c.createdAt) || '—' },
    { label: 'Required By', value: formatDate(c.requiredDate) || '—' },
    { label: 'Department', value: c.department || '—' },
    { label: 'Requested By', value: c.requestedBy || c.createdBy || '—' },
    { label: 'Priority', value: c.priority || '—' },
    { label: 'Lead No', value: c.leadNo || '—' },
    { label: 'Project', value: c.project || '—' }
  ];
  return { d, lines };
}

export function buildCprPrintHtml(cpr, title = 'Purchase Request') {
  const { d, lines } = docLines(cpr);
  const c = cpr;
  const itemRows = d.items
    .map(
      (it, idx) =>
        `<tr><td>${idx + 1}</td><td>${it.drawingNo || '—'}</td><td>${it.description || '—'}</td><td>${it.specification || '—'}</td><td>${it.qty ?? '—'}</td><td>${it.unit || '—'}</td><td style="text-align:right">${formatINR(Number(it.estimatedCost) || 0)}</td><td style="text-align:right">${formatINR((Number(it.qty) || 0) * (Number(it.estimatedCost) || 0))}</td></tr>`
    )
    .join('');

  const infoRows = lines.map((l) => `<tr><td class="k">${l.label}</td><td>${l.value}</td></tr>`).join('');
  const summaryRows = [
    ['Estimated Total', formatINR(d.total)],
    ...(d.costWorkout > 0 ? [['Cost Workout', formatINR(d.costWorkout)]] : []),
    ...(d.profit != null ? [['Profit', formatINR(d.profit)]] : []),
    ...(d.marginPct != null ? [['Profit %', `${d.marginPct.toFixed(2)}%`]] : [])
  ]
    .map(([k, v]) => `<tr><td class="k">${k}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title} - ${c.prNo || ''}</title>
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
  <div class="meta">${c.prNo || ''} · Generated on ${formatDateTime(new Date().toISOString())}</div>
  <div class="cols">
    <div>
      <h3>Bill To</h3>
      <p><strong>${c.client || c.clientName || '—'}</strong></p>
      ${c.company ? `<p>${c.company}</p>` : ''}
      ${c.contactPerson ? `<p>${c.contactPerson}</p>` : ''}
      ${c.phone ? `<p>${c.phone}</p>` : ''}
      ${c.email ? `<p>${c.email}</p>` : ''}
      ${c.gst ? `<p>GST: ${c.gst}</p>` : ''}
      ${c.billingAddress ? `<p>${c.billingAddress}</p>` : ''}
    </div>
    <div>
      <h3>Details</h3>
      <table class="info">${infoRows}</table>
    </div>
  </div>
  <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Items</h3>
  <table>
    <thead><tr><th>#</th><th>Drawing No</th><th>Description</th><th>Specification</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>
      ${itemRows}
      <tr class="sum"><th colspan="7">Total</th><th>${formatINR(d.total)}</th></tr>
    </tbody>
  </table>
  ${d.costWorkout > 0 ? `<table class="summary">${summaryRows}</table>` : ''}
  ${c.remarks ? `<h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px">Remarks</h3><div class="remarks">${c.remarks}</div>` : ''}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

export async function exportCprDocumentPdf(cpr, filename) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const { d, lines } = docLines(cpr);
  const c = cpr;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  doc.setFontSize(20);
  doc.setTextColor(3, 47, 37);
  doc.text('VISHAK TECH', 40, 45);
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`${c.prNo || ''}`, 40, 62);

  doc.setFontSize(9);
  lines.forEach((l, i) => {
    doc.setTextColor(100, 116, 139);
    doc.text(l.label, 40, 85 + i * 14);
    doc.setTextColor(51, 65, 85);
    doc.text(String(l.value || ''), 170, 85 + i * 14);
  });

  autoTable(doc, {
    startY: 205,
    head: [['#', 'Drawing No', 'Description', 'Specification', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: d.items.map((it, idx) => [
      String(idx + 1),
      it.drawingNo || '—',
      it.description || '—',
      it.specification || '—',
      String(it.qty ?? '—'),
      it.unit || '—',
      formatINR(Number(it.estimatedCost) || 0),
      formatINR((Number(it.qty) || 0) * (Number(it.estimatedCost) || 0))
    ]),
    foot: [['', '', '', '', '', '', 'Total', formatINR(d.total)]],
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [3, 47, 37], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  if (d.costWorkout > 0) {
    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 205) + 20,
      head: [['Cost Summary', '']],
      body: [
        ['Estimated Total', formatINR(d.total)],
        ['Cost Workout', formatINR(d.costWorkout)],
        ...(d.profit != null ? [['Profit', formatINR(d.profit)]] : []),
        ...(d.marginPct != null ? [['Profit %', `${d.marginPct.toFixed(2)}%`]] : [])
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [3, 47, 37], textColor: 255 },
      columnStyles: { 1: { halign: 'right' } }
    });
  }

  if (c.remarks) {
    const y = (doc.lastAutoTable?.finalY || 205) + 20;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Remarks', 40, y);
    doc.setTextColor(71, 85, 105);
    doc.splitTextToSize(String(c.remarks), 500).slice(0, 12).forEach((line, i) => {
      doc.text(line, 40, y + 14 + i * 12);
    });
  }

  doc.save(`${filename}.pdf`);
}
