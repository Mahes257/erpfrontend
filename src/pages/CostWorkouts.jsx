import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Calculator,
  CheckCheck,
  CheckCircle,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { ConfirmDialog, useToast } from '../components/Common';
import ColumnsDropdown from '../components/LeadTable/ColumnsDropdown';
import { CprActionMenu, CprPagination, CprTable } from '../components/CprTable';
import useClickOutside from '../hooks/useClickOutside';
import useCostWorkouts from '../hooks/useCostWorkouts';
import { cwStatusMeta } from '../utils/costWorkoutHelpers';
import { CW_STATUSES } from '../utils/costWorkoutConstants';
import { exportCwsBulkCsv, exportCwsCsv, exportCwsExcel, exportCwsPdf, printCws } from '../utils/cprExportUtils';
import { buildExportFilename, formatDate, formatINR } from '../utils/leadHelpers';

const KPI_CARDS = [
  { key: 'all', label: 'Total Cost Workouts', icon: Calculator, color: '#0A4F44' },
  { key: 'draft', label: 'Draft', icon: Pencil, color: '#6b7280' },
  { key: 'completed', label: 'Completed', icon: CheckCircle, color: '#059669' },
  { key: 'approved', label: 'Approved', icon: CheckCheck, color: '#16a34a' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, color: '#dc2626' },
  { key: 'totalvalue', label: 'Total Cost Value', icon: IndianRupee, color: '#ec4899', currency: true }
];

const COLUMNS = [
  { key: 'checkbox', label: '', width: 48, always: true },
  { key: 'date', label: 'Date', width: 120, sortable: true },
  { key: 'cwNo', label: 'CW No', width: 160, sortable: true, mandatory: true },
  { key: 'cprRef', label: 'CPR No', width: 160, sortable: true },
  { key: 'customerName', label: 'Customer', width: 200, sortable: true },
  { key: 'company', label: 'Company', width: 200, sortable: true },
  { key: 'description', label: 'Description', width: 260 },
  { key: 'preparedBy', label: 'Prepared By', width: 150, sortable: true },
  { key: 'subtotal', label: 'Cost Amount', width: 130, align: 'right', sortable: true },
  { key: 'profitPct', label: 'Profit %', width: 100, align: 'right', sortable: true },
  { key: 'sellingPrice', label: 'Selling Price', width: 130, align: 'right', sortable: true },
  { key: 'status', label: 'Status', width: 130, mandatory: true },
  { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
];

// ERP bulk-selection-toolbar.css .btn.btn-sm.btn-ghost class chain (shared with CPR List)
const BULK_GHOST_BTN = 'btn btn-sm btn-ghost';

function itemDescription(cw) {
  const items = Array.isArray(cw.items) ? cw.items : [];
  return items.map((it) => it.description || '').filter(Boolean).join(', ');
}

function CwStatusBadge({ status }) {
  const meta = cwStatusMeta(status);
  return (
    <span className={`cpr-badge ${meta.className} inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold whitespace-nowrap`}>
      {meta.label}
    </span>
  );
}

export default function CostWorkouts() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    data,
    totalCount,
    loading,
    stats,
    tabCounts,
    pagination: { page, pageSize, totalPages },
    searchInput,
    sortKey,
    sortDir,
    filters,
    activeKpi,
    subtab,
    setSearch,
    clearSearch,
    setFilter,
    resetFilters,
    selectKpi,
    switchSubtab,
    goToPage,
    changePageSize,
    toggleSort,
    archiveCw,
    restoreCw,
    deleteCw,
    permanentDeleteCw,
    submitCw,
    duplicateCw,
    bulkArchive,
    bulkRestore,
    bulkDelete,
    bulkPermanentDelete
  } = useCostWorkouts();

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columnsState, setColumnsState] = useState(COLUMNS);
  const [confirm, setConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen);

  const pageRows = data;

  const toggleColumn = (key) => {
    setColumnsState((prev) => prev.map((col) => (col.key === key ? { ...col, hidden: !col.hidden } : col)));
  };

  const visibleColumns = columnsState.filter((col) => col.always || !col.hidden);

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) pageRows.forEach((row) => next.add(row.id));
      else pageRows.forEach((row) => next.delete(row.id));
      return next;
    });
  };

  // ERP action-menu.js 'cost-workout' generator replica: exact items, order,
  // labels and subtab behaviour. Deleted tab shows Restore + Permanent Delete;
  // Active/Archived tabs show the full ERP menu.
  const buildRowActions = (row) => {
    if (subtab === 2) {
      return [
        { key: 'restore', label: 'Restore', icon: RotateCcw },
        { divider: true },
        { key: 'permanentDelete', label: 'Permanent Delete', icon: XCircle, danger: true }
      ];
    }
    const status = String(row.status || 'draft').toLowerCase();
    const items = [
      { key: 'view', label: 'View', icon: Eye },
      { key: 'edit', label: 'Edit', icon: Pencil },
      { key: 'continueWorkout', label: 'Continue Workout', icon: Calculator },
      { key: 'duplicate', label: 'Duplicate', icon: Copy }
    ];
    items.push({ divider: true });
    // ERP: Submit for Approval — only for drafts.
    if (status === 'draft' || status === '') {
      items.push({ key: 'submit', label: 'Submit for Approval', icon: Send });
      items.push({ divider: true });
    }
    // ERP: Open CPR — only when a linked CPR reference exists.
    if (row.cprRef) {
      items.push({ key: 'openCpr', label: 'Open CPR', icon: ClipboardList });
      items.push({ divider: true });
    }
    items.push({ key: 'activityLog', label: 'Activity Log', icon: Clock });
    items.push({ divider: true });
    if (status === 'archived') items.push({ key: 'restore', label: 'Restore', icon: RotateCcw });
    else items.push({ key: 'archive', label: 'Archive', icon: Archive });
    items.push({ key: 'delete', label: 'Delete', icon: Trash2, danger: true });
    return items;
  };

  const runRowAction = (key, row) => {
    switch (key) {
      case 'view':
        navigate(`/cost-workouts/${row.id}`);
        break;
      case 'edit':
      case 'continueWorkout':
        // ERP: Edit and Continue Workout both open the create/edit form.
        navigate(`/cost-workouts/${row.id}/edit`);
        break;
      case 'duplicate':
        duplicateRow(row);
        break;
      case 'submit':
        setConfirm({ type: 'submit', ids: [row.id], label: row.cwNo });
        break;
      case 'openCpr':
        // ERP: opens the linked CPR record. Prefer the numeric cprId (the CPR
        // view endpoint requires a Long id); fall back to the CPR list when
        // only the prNo string reference is available.
        if (row.cprId) navigate(`/cprs/${row.cprId}`);
        else navigate('/cprs');
        break;
      case 'activityLog':
        navigate(`/cost-workouts/${row.id}`);
        break;
      case 'archive':
        setConfirm({ type: 'archive', ids: [row.id], label: row.cwNo });
        break;
      case 'restore':
        setConfirm({ type: 'restore', ids: [row.id], label: row.cwNo });
        break;
      case 'delete':
        setConfirm({ type: 'delete', ids: [row.id], label: row.cwNo });
        break;
      case 'permanentDelete':
        setConfirm({ type: 'permanentDelete', ids: [row.id], label: row.cwNo });
        break;
      default:
        break;
    }
  };

  const duplicateRow = async (row) => {
    const res = await duplicateCw(row.id);
    if (res.ok) {
      const data = res.data?.data ?? {};
      toast.success(`Cost Workout duplicated as ${data.cwNo || row.cwNo}`);
    } else {
      toast.error(res.error?.message || 'Failed to duplicate Cost Workout');
    }
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    const { type, ids, label } = confirm;
    let res;
    if (type === 'archive') {
      res = ids.length === 1 ? await archiveCw(ids[0]) : await bulkArchive(ids);
    } else if (type === 'restore') {
      res = ids.length === 1 ? await restoreCw(ids[0]) : await bulkRestore(ids);
    } else if (type === 'delete') {
      res = ids.length === 1 ? await deleteCw(ids[0]) : await bulkDelete(ids);
    } else if (type === 'permanentDelete') {
      res = ids.length === 1 ? await permanentDeleteCw(ids[0]) : await bulkPermanentDelete(ids);
    } else if (type === 'submit') {
      // ERP parity: submit is a single-row action (draft CWs only). A bulk path
      // must never swallow per-item failures, so keep it explicit.
      if (ids.length === 1) {
        res = await submitCw(ids[0]);
      } else {
        const results = await Promise.all(ids.map((id) => submitCw(id)));
        res = results.every((r) => r && r.ok) ? { ok: true } : { ok: false, error: { message: 'One or more submissions failed' } };
      }
    }
    if (res?.ok) {
      if (type === 'submit') toast.success(confirm?.count != null ? `${confirm.count} CW(s) submitted for approval` : `${label} submitted for approval`);
      else if (type === 'archive') toast.success(confirm?.count != null ? `${confirm.count} CW(s) archived` : `${label} archived`);
      else if (type === 'restore') toast.success(confirm?.count != null ? `${confirm.count} CW(s) restored` : `${label} restored`);
      else if (type === 'delete') toast.success(confirm?.count != null ? `${confirm.count} CW(s) moved to trash` : `${label} moved to trash`);
      else if (type === 'permanentDelete') toast.success(confirm?.count != null ? `${confirm.count} CW(s) permanently deleted` : `${label} permanently deleted`);
    } else {
      toast.error(res?.error?.message || 'Operation failed');
    }
    setSelectedIds(new Set());
    setConfirm(null);
  };

  const exportCurrent = () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to export');
      return;
    }
    exportCwsCsv(data, buildExportFilename('Cost_Workout_List'));
    toast.success('Cost Workout list exported as CSV');
  };

  const exportPdf = async () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to export');
      return;
    }
    try {
      await exportCwsPdf(data, buildExportFilename('Cost_Workout_List'));
      toast.success('Cost Workout list exported as PDF');
    } catch (err) {
      toast.error(err?.message || 'PDF export failed');
    }
  };

  const exportExcel = async () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to export');
      return;
    }
    try {
      await exportCwsExcel(data, buildExportFilename('Cost_Workout_List'));
      toast.success('Cost Workout list exported as Excel');
    } catch (err) {
      toast.error(err?.message || 'Excel export failed');
    }
  };

  const exportPrint = () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to print');
      return;
    }
    printCws(data);
  };

  // ERP cwBulkExport (cost-workout-list.html): selected rows only, exact 10-column
  // CSV, filename 'CostWorkout_Bulk_YYYY-MM-DD.csv', selection cleared after.
  const exportSelected = () => {
    if (selectedIds.size === 0) {
      toast.warning('No items selected');
      return;
    }
    const rows = data.filter((cw) => selectedIds.has(cw.id));
    exportCwsBulkCsv(rows, `CostWorkout_Bulk_${new Date().toISOString().substring(0, 10)}`);
    setSelectedIds(new Set());
  };

  const renderCell = (key, row) => {
    switch (key) {
      case 'date':
        return <span className="text-slate-500">{formatDate(row.cwDate)}</span>;
      case 'cwNo':
        return (
          <button
            type="button"
            onClick={() => navigate(`/cost-workouts/${row.id}`)}
            className="text-[#0B4A3D] hover:underline font-semibold cursor-pointer"
          >
            {row.cwNo}
          </button>
        );
      case 'cprRef':
        return <span className="font-medium">{row.cprRef || '—'}</span>;
      case 'customerName':
        return <span className="font-semibold text-slate-700">{row.customerName || '—'}</span>;
      case 'company':
        return row.company || '—';
      case 'description':
        return <span title={itemDescription(row)}>{itemDescription(row) || '—'}</span>;
      case 'preparedBy':
        return row.preparedBy || '—';
      case 'subtotal':
        return <span className="text-right font-medium">{formatINR(row.subtotal)}</span>;
      case 'profitPct':
        return <span className="text-right">{row.profitPct != null ? `${row.profitPct}%` : '—'}</span>;
      case 'sellingPrice':
        return <span className="text-right font-medium">{formatINR(row.sellingPrice)}</span>;
      case 'status':
        return <CwStatusBadge status={row.status} />;
      default:
        return '—';
    }
  };

  const confirmConfigs = {
    archive: {
      title: confirm?.count != null ? 'Archive Selected' : 'Archive Cost Workout',
      message: confirm?.count != null ? `Archive ${confirm.count} selected CW(s)?` : 'Archive this Cost Workout?',
      confirmLabel: 'Archive', variant: 'default', icon: Archive
    },
    restore: {
      title: confirm?.count != null ? 'Restore Selected' : 'Restore Cost Workout',
      message: confirm?.count != null ? `Restore ${confirm.count} selected CW(s)?` : 'Restore this Cost Workout?',
      confirmLabel: 'Restore', variant: 'default', icon: RotateCcw
    },
    delete: {
      title: confirm?.count != null ? 'Delete Selected' : 'Delete Cost Workout',
      message: confirm?.count != null ? `Delete ${confirm.count} selected CW(s)? They will be moved to trash.` : 'Are you sure?',
      confirmLabel: 'Delete', variant: 'danger', icon: Trash2
    },
    permanentDelete: {
      title: confirm?.count != null ? 'Permanently Delete Selected?' : 'Permanently Delete?',
      message: confirm?.count != null ? `Delete ${confirm.count} CW(s) permanently? This cannot be undone.` : 'This cannot be undone. Delete permanently?',
      confirmLabel: 'Delete Forever', variant: 'danger', icon: Trash2
    },
    submit: {
      title: 'Submit for Approval',
      message: 'Submit this Cost Workout for review?',
      confirmLabel: 'Submit', variant: 'default', icon: Send
    }
  };

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
        <span className="text-slate-600">Cost Workout List</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 tracking-tight">
          <Calculator className="w-6 h-6 text-[#0B4A3D]" />
          Cost Workout
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/cost-workouts/new')}
            className="flex items-center gap-2 bg-[#0B4A3D] hover:bg-[#083D34] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer select-none w-fit"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Create New Cost Workout
          </button>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6 select-none">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          const active = activeKpi === card.key;
          const value = card.currency ? formatINR(stats.totalValue) : stats[card.key];
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => selectKpi(card.key)}
              className={`flex items-center gap-3 bg-surface rounded-xl p-3.5 shadow-sm transition-all cursor-pointer text-left ${
                active
                  ? 'border-2 border-[#0B4A3D] shadow-[0_2px_10px_rgba(11,74,61,0.15)]'
                  : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" style={{ color: card.color }} />
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-900 truncate leading-tight">{value}</div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">{card.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== SALES TAB (ERP sales-tabs) ===== */}
      <div className="flex gap-0.5 mb-4 border-b border-[#e5e7eb] select-none">
        <button
          type="button"
          onClick={() => switchSubtab(0)}
          className="flex items-center gap-2 px-5 py-2.5 bg-transparent text-[#0A4F44] border-b-2 border-[#0A4F44] text-[13px] font-semibold cursor-pointer"
        >
          All Cost Workouts
          <span className="text-[11px] bg-[#E8F0EE] text-[#0A4F44] px-2 py-0.5 rounded-[10px] font-semibold">{tabCounts.active}</span>
        </button>
      </div>

      {/* ===== SUBTAB SEGMENTED CONTROL (ERP segmented-control.css replica) ===== */}
      <div className="inline-flex items-center gap-0.5 p-1 bg-[#f8fafc] border border-[#e5e7eb] rounded-[10px] mb-3 select-none w-fit">
        {[
          { label: 'Active', count: tabCounts.active },
          { label: 'Archived', count: tabCounts.archived },
          { label: 'Deleted', count: tabCounts.deleted }
        ].map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => switchSubtab(index)}
            className={`flex items-center gap-1.5 px-5 h-9 rounded-lg text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${
              subtab === index
                ? 'bg-[#0F5B4C] text-white font-semibold border-2 border-[#0F5B4C] shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                : 'bg-white text-[#64748b] border border-[#e5e7eb] hover:bg-[#f3f4f6] hover:text-[#374151] hover:border-[#d1d5db]'
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-[10px] text-[11px] font-semibold leading-none transition-all ${
                subtab === index ? 'bg-white text-[#0F5B4C]' : 'bg-[#e5e7eb] text-[#64748b]'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className="bg-surface border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row items-center justify-between gap-4 mb-4 shadow-sm">
        <div className="flex-1 w-full flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none shrink-0"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search CW No, CPR No, Customer, Company..."
              aria-label="Search Cost Workouts"
              className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-10 pr-9 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50 focus:bg-surface transition-all shadow-inner"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end select-none">
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" /> Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                {[
                  { label: 'Export PDF', icon: FileText, fn: exportPdf },
                  { label: 'Export Excel', icon: FileSpreadsheet, fn: exportExcel },
                  { label: 'Export CSV', icon: FileDown, fn: exportCurrent },
                  { label: 'Print', icon: Printer, fn: exportPrint }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      item.fn();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <item.icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <ColumnsDropdown columns={columnsState} onToggle={toggleColumn} disabledKeys={['cwNo', 'customer', 'status', 'actions']} />

          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
            Showing {totalCount === 0 ? '0-0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)}`} of {totalCount}
          </span>
        </div>
      </div>

      {/* ===== FILTER PANEL ===== */}
      {showFilters && (
        <div className="bg-surface border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { key: 'status', label: 'Status', type: 'select', options: CW_STATUSES.map((s) => s.label), placeholder: 'All Statuses' },
              { key: 'cprRef', label: 'CPR No', type: 'text', placeholder: 'Search CPR No...' },
              { key: 'cwNo', label: 'CW No', type: 'text', placeholder: 'Search CW No...' },
              { key: 'customer', label: 'Customer', type: 'text', placeholder: 'Search customer...' },
              { key: 'company', label: 'Company', type: 'text', placeholder: 'Search company...' },
              { key: 'preparedBy', label: 'Prepared By', type: 'text', placeholder: 'Search preparer...' },
              { key: 'dateFrom', label: 'Date From', type: 'date' },
              { key: 'dateTo', label: 'Date To', type: 'date' }
            ].map((field) => (
              <div key={field.key} className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    value={filters[field.key] || ''}
                    onChange={(e) => setFilter(field.key, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600/50 cursor-pointer"
                  >
                    <option value="">{field.placeholder}</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={filters[field.key] || ''}
                    onChange={(e) => setFilter(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-600/50"
                  />
                )}
              </div>
            ))}
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-surface border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BULK ACTION BAR (ERP bulk-selection-toolbar.css port) ===== */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count">
            <strong>{selectedIds.size}</strong> selected
          </span>
          <div className="bulk-actions">
            {/* All 5 ERP bulk actions in ONE horizontal row (ERP bulk-selection-toolbar.css) */}
            <button
              type="button"
              onClick={() => setConfirm({ type: 'restore', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} Cost Workout(s)` })}
              className={BULK_GHOST_BTN}
            >
              <RotateCcw className="w-3 h-3" /> Restore
            </button>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'delete', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} Cost Workout(s)` })}
              className={BULK_GHOST_BTN}
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'permanentDelete', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} Cost Workout(s)` })}
              className={BULK_GHOST_BTN}
            >
              <Trash2 className="w-3 h-3" /> Permanently Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'archive', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} Cost Workout(s)` })}
              className={BULK_GHOST_BTN}
            >
              <Archive className="w-3 h-3" /> Archive
            </button>
            <button
              type="button"
              onClick={exportSelected}
              className={BULK_GHOST_BTN}
            >
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        </div>
      )}

      {/* ===== TABLE CARD ===== */}
      <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <CprTable
          columns={visibleColumns}
          rows={pageRows}
          loading={loading}
          subtab={subtab}
          searchQuery={searchInput}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          renderCell={renderCell}
          actionMenu={(row) => (
            <CprActionMenu items={buildRowActions(row)} onAction={(key) => runRowAction(key, row)} />
          )}
          onClearSearch={clearSearch}
          onNewCpr={() => navigate('/cost-workouts/new')}
          onGoActive={() => switchSubtab(0)}
          emptyTitle="Cost Workout"
          foundTitle="No Cost Workouts Found"
          foundMessage="Create your first Cost Workout to get started."
          emptyActionLabel="New Cost Workout"
        />
        {!loading && (
          <CprPagination
            total={totalCount}
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        )}
      </div>

      {/* ===== CONFIRM DIALOG ===== */}
      {confirm && (
        <ConfirmDialog
          open={confirm !== null}
          title={confirmConfigs[confirm.type].title}
          message={confirmConfigs[confirm.type].message}
          confirmLabel={confirmConfigs[confirm.type].confirmLabel}
          variant={confirmConfigs[confirm.type].variant}
          icon={confirmConfigs[confirm.type].icon}
          onConfirm={executeConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
