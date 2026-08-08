import { buildExportFilename, downloadBlob, getCellValue, formatDate } from './followUpHelpers';
import { exportExcelReport, exportPdfDetailedReport, exportPdfSummaryReport } from './reportExportUtils';

export const FOLLOWUP_EXPORT_FORMATS = [
  { key: 'pdf-summary', label: 'PDF Summary', icon: 'FileText', hint: 'Summary + status breakdown' },
  { key: 'pdf-detailed', label: 'PDF Detailed', icon: 'FileText', hint: 'Full column detail' },
  { key: 'excel', label: 'Excel', icon: 'FileSpreadsheet', hint: '.xlsx workbook' },
  { key: 'csv', label: 'CSV', icon: 'FileDown', hint: 'Comma separated values' },
  { key: 'print', label: 'Print', icon: 'Printer', hint: 'Printable HTML view' }
];

export function getFollowUpExportFormat(key) {
  return FOLLOWUP_EXPORT_FORMATS.find((format) => format.key === key) || null;
}

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toCsv(followUps, columns) {
  const visible = columns.filter((col) => col.visible !== false && col.key !== 'actions');
  const header = visible.map((col) => col.label).join(',');
  const rows = followUps.map((followUp) =>
    visible.map((col) => escapeCsv(getCellValue(followUp, col.key))).join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportFollowUpData(format, followUps, columns, prefix = 'followups') {
  const filename = buildExportFilename(prefix);
  switch (format) {
    case 'pdf-summary': {
      const draft = followUps.filter((f) => f.status === 'Draft').length;
      const pending = followUps.filter((f) => f.status === 'Pending').length;
      const completed = followUps.filter((f) => f.status === 'Completed').length;
      const cancelled = followUps.filter((f) => f.status === 'Cancelled').length;
      return exportPdfSummaryReport({
        title: 'Follow-up Summary Report',
        subtitle: `Generated on ${formatDate(new Date().toISOString())}`,
        summaryTables: [
          {
            headers: ['Metric', 'Value'],
            rows: [
              ['Total Follow-ups', String(followUps.length)],
              ['Draft', String(draft)],
              ['Pending', String(pending)],
              ['Completed', String(completed)],
              ['Cancelled', String(cancelled)]
            ]
          }
        ],
        rows: followUps,
        columns,
        getCellValue,
        filename
      });
    }
    case 'pdf-detailed':
      return exportPdfDetailedReport({
        title: 'Follow-up Detailed Report',
        subtitle: `Generated on ${formatDate(new Date().toISOString())}`,
        rows: followUps,
        columns,
        getCellValue,
        filename
      });
    case 'excel':
      return exportExcelReport({ rows: followUps, columns, getCellValue, filename, sheetName: 'Follow-ups' });
    case 'csv': {
      const blob = new Blob(['\uFEFF' + toCsv(followUps, columns)], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${filename}.csv`);
      break;
    }
    case 'print': {
      const visible = columns.filter((col) => col.visible !== false && col.key !== 'actions');
      const rowsHtml = followUps
        .map(
          (followUp) =>
            `<tr>${visible.map((col) => `<td>${escapeHtml(getCellValue(followUp, col.key))}</td>`).join('')}</tr>`
        )
        .join('');
      const head = `<tr>${visible.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')}</tr>`;
      const html = `<html><head><title>Follow-ups</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style></head><body><h1>Follow-ups Report</h1><table>${head}${rowsHtml}</table></body></html>`;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
      break;
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
