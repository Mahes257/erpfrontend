import { buildExportFilename, downloadBlob, getCellValue, formatINR, formatDate } from './clientHelpers';
import { exportExcelReport, exportPdfDetailedReport, exportPdfSummaryReport } from './reportExportUtils';

export const CLIENT_EXPORT_FORMATS = [
  { key: 'pdf-summary', label: 'PDF Summary', icon: 'FileText', hint: 'Summary + portfolio breakdown' },
  { key: 'pdf-detailed', label: 'PDF Detailed', icon: 'FileText', hint: 'Full column detail' },
  { key: 'excel', label: 'Excel', icon: 'FileSpreadsheet', hint: '.xlsx workbook' },
  { key: 'csv', label: 'CSV', icon: 'FileDown', hint: 'Comma separated values' },
  { key: 'print', label: 'Print', icon: 'Printer', hint: 'Printable HTML view' }
];

export function getClientExportFormat(key) {
  return CLIENT_EXPORT_FORMATS.find((format) => format.key === key) || null;
}

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(clients, columns) {
  const visible = columns.filter((col) => col.visible !== false && col.key !== 'actions');
  const header = visible.map((col) => col.label).join(',');
  const rows = clients.map((client) =>
    visible.map((col) => escapeCsv(getCellValue(client, col.key))).join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportClientData(format, clients, columns, prefix = 'clients') {
  const filename = buildExportFilename(prefix);
  switch (format) {
    case 'pdf-summary': {
      const totalValue = clients.reduce((sum, client) => sum + (Number(client.value) || 0), 0);
      const active = clients.filter((c) => c.status === 'Active').length;
      const inactive = clients.filter((c) => c.status === 'Inactive').length;
      const archived = clients.filter((c) => c.status === 'Archived').length;
      return exportPdfSummaryReport({
        title: 'Client Summary Report',
        subtitle: `Generated on ${formatDate(new Date().toISOString())}`,
        summaryTables: [
          {
            headers: ['Metric', 'Value'],
            rows: [
              ['Total Clients', String(clients.length)],
              ['Active Clients', String(active)],
              ['Inactive Clients', String(inactive)],
              ['Archived Clients', String(archived)],
              ['Portfolio Value', formatINR(totalValue)]
            ]
          }
        ],
        rows: clients,
        columns,
        getCellValue,
        filename
      });
    }
    case 'pdf-detailed':
      return exportPdfDetailedReport({
        title: 'Client Detailed Report',
        subtitle: `Generated on ${formatDate(new Date().toISOString())}`,
        rows: clients,
        columns,
        getCellValue,
        filename
      });
    case 'excel':
      return exportExcelReport({ rows: clients, columns, getCellValue, filename, sheetName: 'Clients' });
    case 'csv': {
      const blob = new Blob(['\uFEFF' + toCsv(clients, columns)], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${filename}.csv`);
      break;
    }
    case 'print': {
      const visible = columns.filter((col) => col.visible !== false && col.key !== 'actions');
      const rowsHtml = clients
        .map(
          (client) =>
            `<tr>${visible.map((col) => `<td>${escapeHtml(getCellValue(client, col.key))}</td>`).join('')}</tr>`
        )
        .join('');
      const head = `<tr>${visible.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')}</tr>`;
      const html = `<html><head><title>Clients</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style></head><body><h1>Clients Report</h1><table>${head}${rowsHtml}</table></body></html>`;
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

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
