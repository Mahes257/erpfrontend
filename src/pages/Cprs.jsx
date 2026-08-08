import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Calculator,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { ConfirmDialog, useToast } from '../components/Common';
import ColumnsDropdown from '../components/LeadTable/ColumnsDropdown';
import {
  CprActionMenu,
  CprApprovalBadge,
  CprFilterPanel,
  CprKpiCards,
  CprPagination,
  CprStatusBadge,
  CprTable
} from '../components/CprTable';
import useClickOutside from '../hooks/useClickOutside';
import useCprs from '../hooks/useCprs';
import cprService from '../services/cprService';
import { exportCprsBulkCsv, exportCprsExcel, exportCprsPdf, printCprs } from '../utils/cprExportUtils';
import { buildExportFilename, downloadBlob, formatDate, formatINR } from '../utils/leadHelpers';

const STAGE_DISPLAY = {
  cw: 'CW',
  draft: 'Draft',
  'cost workout': 'CW',
  'pending approval': 'Approval',
  pending: 'Approval',
  approval: 'Approval',
  approved: 'Approved',
  converted: 'Converted'
};

const COLUMNS = [
  { key: 'checkbox', label: '', width: 48, always: true },
  { key: 'prNo', label: 'CPR No', width: 160, sortable: true, mandatory: true },
  { key: 'leadNo', label: 'Lead No', width: 120, sortable: true },
  { key: 'client', label: 'Client', width: 200, sortable: true },
  { key: 'description', label: 'Description', width: 260 },
  { key: 'project', label: 'Project', width: 170, sortable: true },
  { key: 'department', label: 'Department', width: 140, sortable: true },
  { key: 'createdBy', label: 'Created By', width: 140, sortable: true },
  { key: 'costWorkout', label: 'Cost Workout', width: 130, align: 'right' },
  { key: 'profitPercent', label: 'Profit %', width: 100, align: 'right' },
  { key: 'approval', label: 'Approval Status', width: 140 },
  { key: 'stage', label: 'Current Stage', width: 140 },
  { key: 'status', label: 'Status', width: 150, mandatory: true },
  { key: 'createdAt', label: 'Created Date', width: 120, sortable: true },
  { key: 'grandTotal', label: 'Total Amount', width: 130, align: 'right', sortable: true },
  { key: 'quotation', label: 'Converted Quotation', width: 160 },
  { key: 'actions', label: 'Actions', width: 110, align: 'center', mandatory: true }
];

function stageLabel(status) {
  return STAGE_DISPLAY[String(status || 'draft').toLowerCase()] || 'Draft';
}

function truncate(value, max = 60) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}...` : text || '-';
}

// ERP bulk-selection-toolbar.css .btn.btn-sm.btn-ghost class chain
const BULK_GHOST_BTN = 'btn btn-sm btn-ghost';

export default function Cprs() {
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
    sortKey: sortField,
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
    exportParams,
    convertCpr,
    archiveCpr,
    restoreCpr,
    deleteCpr,
    duplicateCpr,
    bulkArchive,
    bulkRestore,
    bulkDelete,
    bulkPermanentDelete
  } = useCprs();

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columnsState, setColumnsState] = useState(COLUMNS);
  const [confirm, setConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen);

  const pageRows = data;

  const toggleColumn = (key) => {
    setColumnsState((prev) =>
      prev.map((col) => (col.key === key ? { ...col, hidden: !col.hidden } : col))
    );
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

  const buildRowActions = (row) => {
    if (subtab === 2) {
      return [
        { key: 'restore', label: 'Restore', icon: RotateCcw },
        { key: 'permanentDelete', label: 'Permanent Delete', icon: Trash2, danger: true }
      ];
    }
    const status = String(row.status || '').toLowerCase();
    const items = [
      { key: 'view', label: 'View CPR', icon: Eye },
      { key: 'edit', label: 'Edit', icon: Pencil },
      { key: 'duplicate', label: 'Duplicate', icon: Copy },
      { key: 'costWorkout', label: 'Cost Workout', icon: Calculator }
    ];
    // ERP pr-module.js: Convert to Quotation only for approved CPRs without an
    // existing quotation; otherwise Open Quotation. Each pushes its own divider.
    if (status === 'approved' && !row.convertedToQtn) {
      items.push({ key: 'convertToQuotation', label: 'Convert to Quotation', icon: FileText });
      items.push({ divider: true });
    } else if (row.convertedToQtn) {
      items.push({ key: 'openQuotation', label: 'Open Quotation', icon: FileText });
      items.push({ divider: true });
    }
    items.push({ divider: true });
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
        navigate(`/cprs/${row.id}`);
        break;
      case 'edit':
        navigate(`/cprs/${row.id}/edit`);
        break;
      case 'duplicate':
        duplicateRow(row);
        break;
      case 'costWorkout':
        navigate(`/cost-workouts/new?cpr=${row.id}`);
        break;
      case 'convertToQuotation':
        convertToQuotationRow(row);
        break;
      case 'openQuotation':
        navigate(`/quotations/${row.quotationId || row.id}/view`);
        break;
      case 'activityLog':
        navigate(`/cprs/${row.id}?tab=activities`);
        break;
      case 'archive':
        runArchive(row);
        break;
      case 'restore':
        runRestore(row);
        break;
      case 'delete':
        setConfirm({ type: 'delete', ids: [row.id], label: row.prNo });
        break;
      case 'permanentDelete':
        setConfirm({ type: 'permanentDelete', ids: [row.id], label: row.prNo });
        break;
      default:
        break;
    }
  };

  const duplicateRow = async (row) => {
    const res = await duplicateCpr(row.id);
    if (res.ok) {
      const data = res.data?.data ?? {};
      toast.success(`CPR duplicated as ${data.prNo || row.prNo}`);
    } else {
      toast.error(res.error?.message || 'Failed to duplicate CPR');
    }
  };

  // ERP toggleArchive (pr-module.js): single-row archive runs directly, no confirm.
  const runArchive = async (row) => {
    const res = await archiveCpr(row.id);
    if (res?.ok) toast.success('CPR status updated');
    else toast.error(res?.error?.message || 'Failed to update CPR status');
  };

  // ERP restoreCPR (pr-module.js): single-row restore runs directly, no confirm.
  const runRestore = async (row) => {
    const res = await restoreCpr(row.id);
    if (res?.ok) toast.success('CPR restored');
    else toast.error(res?.error?.message || 'Failed to restore CPR');
  };

  // ERP convertToQuotation (pr-module.js): convert an approved CPR into a quotation.
  const convertToQuotationRow = async (row) => {
    const res = await convertCpr(row.id);
    if (res?.ok) toast.success('CPR converted to quotation');
    else toast.error(res?.error?.message || 'Failed to convert CPR to quotation');
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    const { type, ids, label } = confirm;
    let res;
    if (type === 'archive') {
      res = ids.length === 1 ? await archiveCpr(ids[0]) : await bulkArchive(ids);
    } else if (type === 'restore') {
      res = ids.length === 1 ? await restoreCpr(ids[0]) : await bulkRestore(ids);
    } else if (type === 'delete') {
      res = ids.length === 1 ? await deleteCpr(ids[0]) : await bulkDelete(ids);
    } else if (type === 'permanentDelete') {
      res = await bulkPermanentDelete(ids);
    }
    if (res?.ok) {
      if (type === 'archive') toast.success(`${label} archived`);
      else if (type === 'restore') toast.success(`${label} restored`);
      else if (type === 'delete') toast.success(`${label} moved to trash`);
      else if (type === 'permanentDelete') toast.success(`${label} permanently deleted`);
    } else {
      toast.error(res?.error?.message || 'Operation failed');
    }
    setSelectedIds(new Set());
    setConfirm(null);
  };

  const exportRows = async () => {
    try {
      const blob = await cprService.exportCprs(exportParams());
      downloadBlob(blob, `CPR_List_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CPR list exported as CSV');
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
    setExportOpen(false);
  };

  // Mirrors the ERP's bulkExport (pr-module.js): exports ONLY the selected rows
  // as CSV with the exact 7-column layout, then clears the selection.
  const bulkExportSelected = () => {
    const ids = [...selectedIds];
    const selected = data.filter((pr) => ids.includes(pr.id) || ids.includes(pr.prNo));
    if (!selected.length) {
      toast.warning('Selected records not found');
      setSelectedIds(new Set());
      return;
    }
    const today = new Date().toISOString().substring(0, 10);
    exportCprsBulkCsv(selected, `CPR_Bulk_${today}`);
    setSelectedIds(new Set());
  };

  const exportExcel = async () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to export');
      return;
    }
    try {
      await exportCprsExcel(data, buildExportFilename('CPR_List'));
      toast.success('CPR list exported as Excel');
    } catch (err) {
      toast.error(err?.message || 'Excel export failed');
    }
  };

  const exportPdf = async () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to export');
      return;
    }
    try {
      await exportCprsPdf(data, buildExportFilename('CPR_List'));
      toast.success('CPR list exported as PDF');
    } catch (err) {
      toast.error(err?.message || 'PDF export failed');
    }
  };

  const exportPrint = () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to print');
      return;
    }
    printCprs(data);
  };

  const renderCell = (key, row) => {
    switch (key) {
      case 'prNo':
        return (
          <button
            type="button"
            onClick={() => navigate(`/cprs/${row.id}`)}
            className="text-[#0B4A3D] hover:underline font-semibold cursor-pointer"
          >
            {row.prNo}
          </button>
        );
      case 'leadNo':
        return <span className="font-medium">{row.leadNo || '—'}</span>;
      case 'client':
        return <span className="font-semibold text-slate-700">{row.client || '—'}</span>;
      case 'description':
        return <span title={row.description || ''}>{truncate(row.description)}</span>;
      case 'project':
        return row.project || '—';
      case 'department':
        return row.department || '—';
      case 'createdBy':
        return row.createdBy || '—';
      case 'costWorkout':
        return row.costWorkout != null && row.costWorkout !== '' ? (
          <span className="font-medium text-right block">{formatINR(row.costWorkout)}</span>
        ) : (
          <span className="text-slate-300 text-[11px] block text-right">—</span>
        );
      case 'profitPercent':
        return row.profitPercent != null && row.profitPercent !== '' ? (
          <span className="text-right block">{Number(row.profitPercent).toFixed(2)}%</span>
        ) : (
          <span className="text-slate-300 text-[11px] block text-right">—</span>
        );
      case 'approval':
        return <CprApprovalBadge status={row.approvalStatus} />;
      case 'stage':
        return <span className="font-medium">{stageLabel(row.status)}</span>;
      case 'status':
        return <CprStatusBadge status={row.status} />;
      case 'createdAt':
        return <span className="text-slate-500">{formatDate(row.createdAt)}</span>;
      case 'grandTotal':
        return row.grandTotal != null && row.grandTotal !== '' ? (
          <span className="font-bold text-slate-800 text-right block">{formatINR(row.grandTotal)}</span>
        ) : (
          <span className="text-slate-300 text-[11px] block text-right">—</span>
        );
      case 'quotation':
        return row.convertedToQtn ? (
          <button
            type="button"
            onClick={() => navigate(`/quotations/${row.quotationId || row.id}/view`)}
            className="inline-flex items-center gap-1 text-[#2563eb] hover:underline font-medium cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" /> {row.convertedToQtn}
          </button>
        ) : (
          <span className="text-slate-300 text-[11px]">—</span>
        );
      default:
        return '—';
    }
  };

  const confirmConfigs = {
    archive: {
      title: confirm?.count != null ? 'Archive Selected CPRs' : 'Archive CPR',
      message: confirm?.count != null ? `Archive ${confirm.count} selected CPR(s)?` : `Archive ${confirm?.label}?`,
      confirmLabel: 'Archive', variant: 'default', icon: Archive
    },
    restore: {
      title: confirm?.count != null ? 'Restore Selected CPRs' : 'Restore CPR',
      message: confirm?.count != null ? `Restore ${confirm.count} selected CPR(s)?` : `Restore ${confirm?.label} to active CPRs?`,
      confirmLabel: 'Restore', variant: 'default', icon: RotateCcw
    },
    delete: {
      title: confirm?.count != null ? 'Delete Selected CPRs' : 'Delete CPR',
      message: confirm?.count != null ? `Delete ${confirm.count} selected CPR(s)? They will be moved to trash.` : 'This CPR will be moved to trash.',
      confirmLabel: 'Delete', variant: 'danger', icon: Trash2
    },
    permanentDelete: {
      title: 'Permanently Delete',
      message: confirm?.count != null ? `Delete ${confirm.count} CPR(s) permanently? This cannot be undone.` : 'This action cannot be undone.',
      confirmLabel: 'Delete', variant: 'danger', icon: Trash2
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
        <span className="text-slate-600">CPR List</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 tracking-tight">
          <ClipboardList className="w-6 h-6 text-[#0B4A3D]" />
          Customer Purchase Requests (CPR)
        </h1>
        <button
          type="button"
          onClick={() => navigate('/cprs/new')}
          className="flex items-center gap-2 bg-[#0B4A3D] hover:bg-[#083D34] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer select-none w-fit"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> New CPR
        </button>
      </div>

      {/* ===== KPI CARDS ===== */}
      <CprKpiCards stats={stats} activeKpi={activeKpi} onSelect={selectKpi} />

      {/* ===== SALES TAB (ERP sales-tabs) ===== */}
      <div className="flex gap-0.5 mb-4 border-b border-[#e5e7eb] select-none">
        <button
          type="button"
          onClick={() => switchSubtab(0)}
          className="flex items-center gap-2 px-5 py-2.5 bg-transparent text-[#0A4F44] border-b-2 border-[#0A4F44] text-[13px] font-semibold cursor-pointer"
        >
          All CPRs
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
              placeholder="Search CPR No, Client, Lead No..."
              aria-label="Search CPRs"
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
                  { label: 'Export CSV', icon: FileDown, fn: exportRows },
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

          <ColumnsDropdown columns={columnsState} onToggle={toggleColumn} disabledKeys={['prNo', 'client', 'status', 'actions']} />

          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
            Showing {totalCount === 0 ? '0-0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)}`} of {totalCount}
          </span>
        </div>
      </div>

      {/* ===== FILTER PANEL ===== */}
      <CprFilterPanel
        open={showFilters}
        filters={filters}
        onChange={setFilter}
        onReset={resetFilters}
      />

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
              onClick={() => setConfirm({ type: 'restore', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} CPR(s)` })}
              className={BULK_GHOST_BTN}
            >
              <RotateCcw className="w-3 h-3" /> Restore
            </button>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'delete', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} CPR(s)` })}
              className={BULK_GHOST_BTN}
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'permanentDelete', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} CPR(s)` })}
              className={BULK_GHOST_BTN}
            >
              <Trash2 className="w-3 h-3" /> Permanently Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirm({ type: 'archive', ids: [...selectedIds], count: selectedIds.size, label: `${selectedIds.size} CPR(s)` })}
              className={BULK_GHOST_BTN}
            >
              <Archive className="w-3 h-3" /> Archive
            </button>
            <button
              type="button"
              onClick={bulkExportSelected}
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
          sortKey={sortField}
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
          onNewCpr={() => navigate('/cprs/new')}
          onGoActive={() => switchSubtab(0)}
          emptyTitle="CPR"
          foundTitle="No CPR Found"
          foundMessage="Create your first Customer Purchase Request to get started."
          emptyActionLabel="New CPR"
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
