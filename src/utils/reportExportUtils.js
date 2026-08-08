const PDF_GREEN = [3, 47, 37];

function visibleColumns(columns) {
  return columns.filter((col) => col.visible !== false && col.key !== 'actions');
}

function buildRows(rows, columns, getCellValue) {
  const visible = visibleColumns(columns);
  const body = rows.map((row) => visible.map((col) => getCellValue(row, col.key)));
  return { visible, body };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportExcelReport({ rows, columns, getCellValue, filename, sheetName = 'Report' }) {
  const XLSX = await import('xlsx');
  const { visible, body } = buildRows(rows, columns, getCellValue);
  const aoa = [visible.map((c) => c.label), ...body];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function applyTable(doc, autoTable, { visible, body }, startY) {
  autoTable(doc, {
    startY,
    head: [visible.map((c) => c.label)],
    body,
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: PDF_GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 40, bottom: 30 }
  });
}

export async function exportPdfDetailedReport({ title, subtitle, rows, columns, getCellValue, filename }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.setTextColor(...PDF_GREEN);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${subtitle} - ${rows.length} records`, 40, 55);
  applyTable(doc, autoTable, buildRows(rows, columns, getCellValue), 70);
  doc.save(`${filename}-detailed.pdf`);
}

export async function exportPdfSummaryReport({ title, subtitle, summaryTables, rows, columns, getCellValue, filename }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.setTextColor(...PDF_GREEN);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${subtitle} - ${rows.length} records`, 40, 55);
  let y = 70;
  for (const table of summaryTables) {
    autoTable(doc, {
      startY: y,
      head: [table.headers],
      body: table.rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: PDF_GREEN, textColor: 255 },
      columnStyles: { 1: { halign: 'right' } }
    });
    y = (doc.lastAutoTable?.finalY || y) + 20;
  }
  applyTable(doc, autoTable, buildRows(rows, columns, getCellValue), y);
  doc.save(`${filename}-summary.pdf`);
}

export function printReport({ title, subtitle, rows, columns, getCellValue }) {
  const visible = visibleColumns(columns);
  const header = visible.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${visible.map((c) => `<td>${escapeHtml(getCellValue(row, c.key))}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  h1 { color: #166534; font-size: 20px; margin: 0 0 4px; }
  p.meta { color: #64748b; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #166534; color: #f1f5f9; text-align: left; padding: 8px; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  tbody td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  @media print { body { margin: 8mm; } thead { display: table-header-group; } }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">${subtitle} - ${rows.length} records</p>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) {
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
