import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileDown,
  FileSpreadsheet,
  FileText,
  Printer,
  IndianRupee,
  ListChecks
} from 'lucide-react';
import cprService from '../services/cprService';
import { normalizeCpr } from '../utils/cprHelpers';
import {
  exportCprReportsCsv,
  exportCprReportsExcel,
  exportCprReportsPdf,
  fmtReportAmount,
  fmtReportDate,
  printCprReports
} from '../utils/cprReportUtils';
import { useToast } from '../components/Common';
import useClickOutside from '../hooks/useClickOutside';

const REPORT_STYLES = {
  table: 'w-full text-left border-collapse',
  thead: 'bg-[#0A4F44] text-white text-[11px] uppercase tracking-[0.04em]',
  th: 'px-4 py-3 font-semibold whitespace-nowrap',
  td: 'px-4 py-2.5 border-b border-slate-100 align-middle text-[13px] text-slate-600',
  empty: 'text-center px-4 py-8 text-[13px] text-slate-400'
};

function ReportTable({ columns, rows, renderCell, emptyText, footerText }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className={REPORT_STYLES.table}>
          <thead className={REPORT_STYLES.thead}>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={REPORT_STYLES.th}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={REPORT_STYLES.empty}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  {columns.map((col) => (
                    <td key={col.key} className={REPORT_STYLES.td}>
                      {renderCell ? renderCell(row, col) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end items-center px-4 py-2.5 border-t border-slate-100 text-[12px] text-slate-500">
        <span className="font-medium">{footerText}</span>
      </div>
    </>
  );
}

function ReportCard({ icon: Icon, iconColor, title, children }) {
  return (
    <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const KPI_CARDS = [
  { key: 'pending', label: 'Pending', icon: Clock, color: '#d97706', bg: '#fffbeb' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2, color: '#059669', bg: '#ecfdf5' },
  { key: 'converted', label: 'Converted', icon: FileText, color: '#2563eb', bg: '#eff6ff' },
  { key: 'totalValue', label: 'Total Value', icon: IndianRupee, color: '#059669', bg: '#d1fae5', currency: true }
];

export default function CprReports() {
  const navigate = useNavigate();
  const toast = useToast();
  const [cprs, setCprs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen);

  useEffect(() => {
    let cancelled = false;
    // Real backend summary (aggregated from MySQL). The CPR list is fetched only
    // for export/print of the underlying records.
    cprService
      .getReportsSummary()
      .then((res) => {
        if (!cancelled) setSummary(res?.data ?? res ?? null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    cprService
      .listAllCprs()
      .then((list) => {
        if (!cancelled) setCprs(list.map(normalizeCpr));
      })
      .catch(() => {
        if (!cancelled) setCprs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reports = useMemo(() => {
    // All report data comes from the backend summary endpoint (MySQL). The CPR
    // list is only used for export/print of the underlying records.
    const kpis = summary?.kpis || {};
    return {
      kpis: {
        pending: kpis.pending ?? 0,
        approved: kpis.approved ?? 0,
        converted: kpis.converted ?? 0,
        totalValue: Number(kpis.totalValue) || 0
      },
      pending: Array.isArray(summary?.pending) ? summary.pending : [],
      approved: Array.isArray(summary?.approved) ? summary.approved : [],
      converted: Array.isArray(summary?.converted) ? summary.converted : [],
      deptSummary: Array.isArray(summary?.deptSummary) ? summary.deptSummary : [],
      vendorSummary: Array.isArray(summary?.vendorSummary) ? summary.vendorSummary : [],
      monthlySummary: Array.isArray(summary?.monthlySummary) ? summary.monthlySummary : [],
      costAnalysis: Array.isArray(summary?.costAnalysis) ? summary.costAnalysis : []
    };
  }, [summary]);

  const exportAll = async (format) => {
    setExportOpen(false);
    if (cprs.length === 0) {
      toast.error('No data available to export');
      return;
    }
    const filename = `CPR_Reports_${new Date().toISOString().substring(0, 10)}`;
    try {
      if (format === 'pdf') await exportCprReportsPdf(cprs, filename);
      else if (format === 'excel') await exportCprReportsExcel(cprs, filename);
      else if (format === 'csv') await exportCprReportsCsv(cprs, filename);
      else await printCprReports(cprs);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err?.message || `Export failed (${format})`);
    }
  };

  const linkCpr = (row) => (
    <button
      type="button"
      onClick={() => navigate(`/cprs/${row.id}`)}
      className="text-[#0B4A3D] font-semibold hover:underline cursor-pointer"
    >
      {row.prNo || row.id}
    </button>
  );

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales</span>
        <span>&gt;</span>
        <span>Customer Purchase Request</span>
        <span>&gt;</span>
        <span className="text-slate-600">Reports</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 tracking-tight">
          <ListChecks className="w-6 h-6 text-[#0B4A3D]" />
          CPR Reports
        </h1>
        <button
          type="button"
          onClick={() => navigate('/cprs')}
          className="flex items-center gap-2 bg-surface border border-slate-200 text-slate-600 text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to CPR
        </button>
      </div>

      {loading ? (
        <div className="bg-surface border border-slate-200 rounded-xl shadow-sm p-12 flex items-center justify-center text-sm text-slate-400">
          Loading reports...
        </div>
      ) : (
        <>
          {/* ===== KPI GRID ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {KPI_CARDS.map((k) => {
              const Icon = k.icon;
              const value = k.currency
                ? fmtReportAmount(reports.kpis[k.key])
                : String(reports.kpis[k.key]);
              return (
                <div key={k.key} className="bg-surface border border-slate-200 rounded-xl shadow-sm p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: k.bg, color: k.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[22px] font-extrabold text-slate-900 leading-tight truncate">{value}</div>
                    <div className="text-[13px] text-slate-500 font-medium">{k.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== EXPORT TOOLBAR ===== */}
          <div className="flex justify-end mb-6 select-none">
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-400" /> Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                  {[
                    { label: 'Export PDF', icon: FileText, fn: () => exportAll('pdf') },
                    { label: 'Export Excel', icon: FileSpreadsheet, fn: () => exportAll('excel') },
                    { label: 'Export CSV', icon: FileDown, fn: () => exportAll('csv') },
                    { label: 'Print', icon: Printer, fn: () => exportAll('print') }
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.fn}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <item.icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== 1. PENDING PRs ===== */}
          <ReportCard icon={Clock} iconColor="#d97706" title="Pending Purchase Requests">
            <ReportTable
              columns={[
                { key: 'prNo', label: 'PR No' },
                { key: 'date', label: 'Date' },
                { key: 'department', label: 'Department' },
                { key: 'requestedBy', label: 'Requested By' },
                { key: 'status', label: 'Status' },
                { key: 'amount', label: 'Amount' }
              ]}
              rows={reports.pending}
              renderCell={(row, col) => {
                switch (col.key) {
                  case 'prNo':
                    return linkCpr(row);
                  case 'date':
                    return fmtReportDate(row.prDate || row.createdAt);
                  case 'requestedBy':
                    return row.requestedBy || row.createdBy || '-';
                  case 'amount':
                    return <span className="font-semibold text-slate-800">{fmtReportAmount(row.grandTotal ?? row.subtotal)}</span>;
                  default:
                    return row[col.key] || '-';
                }
              }}
              emptyText="No pending records."
              footerText={`${reports.pending.length} records`}
            />
          </ReportCard>

          {/* ===== 2. APPROVED PRs ===== */}
          <ReportCard icon={CheckCircle2} iconColor="#059669" title="Approved Purchase Requests">
            <ReportTable
              columns={[
                { key: 'prNo', label: 'PR No' },
                { key: 'date', label: 'Date' },
                { key: 'department', label: 'Department' },
                { key: 'approvedBy', label: 'Approved By' },
                { key: 'approvalDate', label: 'Approval Date' },
                { key: 'amount', label: 'Amount' }
              ]}
              rows={reports.approved}
              renderCell={(row, col) => {
                switch (col.key) {
                  case 'prNo':
                    return linkCpr(row);
                  case 'date':
                    return fmtReportDate(row.prDate || row.createdAt);
                  case 'approvedBy':
                    return row.approvedBy || '-';
                  case 'approvalDate':
                    return fmtReportDate(row.approvalDate);
                  case 'amount':
                    return <span className="font-semibold text-slate-800">{fmtReportAmount(row.grandTotal ?? row.subtotal)}</span>;
                  default:
                    return row[col.key] || '-';
                }
              }}
              emptyText="No approved records."
              footerText={`${reports.approved.length} records`}
            />
          </ReportCard>

          {/* ===== 3. CONVERTED TO PO ===== */}
          <ReportCard icon={FileText} iconColor="#2563eb" title="Converted to Purchase Order">
            <ReportTable
              columns={[
                { key: 'prNo', label: 'PR No' },
                { key: 'poNo', label: 'PO No' },
                { key: 'date', label: 'Date' },
                { key: 'department', label: 'Department' },
                { key: 'amount', label: 'Amount' }
              ]}
              rows={reports.converted}
              renderCell={(row, col) => {
                switch (col.key) {
                  case 'prNo':
                    return linkCpr(row);
                  case 'poNo':
                    return row.convertedToQtn || row.convertedToPO || '-';
                  case 'date':
                    return fmtReportDate(row.prDate || row.createdAt);
                  case 'amount':
                    return <span className="font-semibold text-slate-800">{fmtReportAmount(row.grandTotal ?? row.subtotal)}</span>;
                  default:
                    return row[col.key] || '-';
                }
              }}
              emptyText="No converted records."
              footerText={`${reports.converted.length} records`}
            />
          </ReportCard>

          {/* ===== 4. DEPARTMENT-WISE SUMMARY ===== */}
          <ReportCard icon={Building2} iconColor="#7c3aed" title="Department-wise PR Summary">
            <ReportTable
              columns={[
                { key: 'department', label: 'Department' },
                { key: 'count', label: 'Total PRs' },
                { key: 'approved', label: 'Approved' },
                { key: 'pending', label: 'Pending' },
                { key: 'total', label: 'Total Amount' }
              ]}
              rows={reports.deptSummary}
              renderCell={(row, col) => {
                if (col.key === 'department') return <strong className="text-slate-800">{row.department}</strong>;
                if (col.key === 'total') return fmtReportAmount(row.total);
                return row[col.key];
              }}
              emptyText="No data."
              footerText={`${reports.deptSummary.length} departments`}
            />
          </ReportCard>

          {/* ===== 5. VENDOR-WISE SUMMARY ===== */}
          <ReportCard icon={Building2} iconColor="#ea580c" title="Vendor-wise PR Summary">
            <ReportTable
              columns={[
                { key: 'vendor', label: 'Vendor' },
                { key: 'count', label: 'Total PRs' },
                { key: 'total', label: 'Total Amount' }
              ]}
              rows={reports.vendorSummary}
              renderCell={(row, col) => {
                if (col.key === 'vendor') return <strong className="text-slate-800">{row.vendor}</strong>;
                if (col.key === 'total') return fmtReportAmount(row.total);
                return row[col.key];
              }}
              emptyText="No vendor data recorded on CPRs."
              footerText={`${reports.vendorSummary.length} vendors`}
            />
          </ReportCard>

          {/* ===== 6. MONTHLY SUMMARY ===== */}
          <ReportCard icon={CalendarDays} iconColor="#0891b2" title="Monthly PR Summary">
            <ReportTable
              columns={[
                { key: 'month', label: 'Month' },
                { key: 'count', label: 'Total PRs' },
                { key: 'approved', label: 'Approved' },
                { key: 'converted', label: 'Converted' },
                { key: 'total', label: 'Amount' }
              ]}
              rows={reports.monthlySummary}
              renderCell={(row, col) => {
                if (col.key === 'month') return <strong className="text-slate-800">{row.month}</strong>;
                if (col.key === 'total') return fmtReportAmount(row.total);
                return row[col.key];
              }}
              emptyText="No data."
              footerText={`${reports.monthlySummary.length} months`}
            />
          </ReportCard>

          {/* ===== 7. COST ANALYSIS ===== */}
          <ReportCard icon={ListChecks} iconColor="#f97316" title="Cost Analysis by Category">
            <ReportTable
              columns={[
                { key: 'category', label: 'Category' },
                { key: 'count', label: 'Count' },
                { key: 'total', label: 'Total Amount' }
              ]}
              rows={reports.costAnalysis}
              renderCell={(row, col) => {
                if (col.key === 'category') return <strong className="text-slate-800">{row.category}</strong>;
                if (col.key === 'total') return fmtReportAmount(row.total);
                return row[col.key];
              }}
              emptyText="No cost workout data recorded yet."
              footerText={`${reports.costAnalysis.length} categories`}
            />
          </ReportCard>
        </>
      )}
    </div>
  );
}
