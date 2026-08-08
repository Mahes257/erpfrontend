import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Copy,
  Download,
  Eye,
  FileDown,
  FileText,
  Filter,
  History,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { ConfirmDialog, Modal, SelectInput, useToast } from '../Common';
import ColumnsDropdown from '../LeadTable/ColumnsDropdown';
import { CprActionMenu, CprPagination } from '../CprTable';
import SalesKpiCards from './SalesKpiCards';
import SalesStatusBadge from './SalesStatusBadge';
import SalesFilterPanel from './SalesFilterPanel';
import useClickOutside from '../../hooks/useClickOutside';
import { formatDate, formatINR } from '../../utils/leadHelpers';
import { docNumber } from '../../utils/salesHelpers';

/**
 * Generic list page for a Sales Execution module.
 * config:
 *  - service, moduleKey, listRoute, newRoute, viewRoute, editRoute
 *  - title, icon, breadcrumb, noLabel ('Quotation No', ...)
 *  - columns: [{ key, label, width, sortable, align, render(row) }]
 *  - kpis: [{ key, label, valueOf(stats) }]
 *  - filters: [{ key, label, type, options, placeholder, queryParam }]
 *  - rowActions: fn(row, hook) -> [{ key, label, icon, danger }]
 *  - runRowAction: fn(key, row, hook, navigate)
 *  - newLabel: 'New Quotation'
 *  - searchPlaceholder
 */
export default function SalesListPage({ config }) {
  const navigate = useNavigate();
  const toast = useToast();
  const hook = config.useHook();

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
    exportParams,
    archive,
    restore,
    remove,
    duplicate,
    bulkArchive,
    bulkRestore,
    bulkDelete
  } = hook;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columnsState, setColumnsState] = useState(config.columns);
  const [confirm, setConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // ERP change-status flow: statuses come from the module's status filter options.
  const statusOptions =
    config.filters?.find((f) => f.key === 'status')?.options ||
    config.statuses ||
    [];

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

  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));

  const buildRowActions = (row) => {
    if (subtab === 2) {
      return [
        { key: 'restore', label: 'Restore', icon: RotateCcw },
        { key: 'permanentDelete', label: 'Permanent Delete', icon: Trash2, danger: true }
      ];
    }
    if (config.rowMenu) {
      return typeof config.rowMenu === 'function' ? config.rowMenu(row, hook) : config.rowMenu;
    }
    const items = [
      { key: 'view', label: `View ${config.title}`, icon: Eye },
      { key: 'edit', label: 'Edit', icon: Pencil },
      { key: 'duplicate', label: 'Duplicate', icon: Copy },
      { key: 'activityLog', label: 'Activity Log', icon: History },
      { divider: true }
    ];
    if (config.rowActions) {
      items.push(...config.rowActions(row, hook));
    }
    if (String(row.status || '').toLowerCase() === 'archived') {
      items.push({ key: 'restore', label: 'Restore', icon: RotateCcw });
    } else {
      items.push({ key: 'archive', label: 'Archive', icon: Archive });
    }
    items.push({ key: 'delete', label: 'Delete', icon: Trash2, danger: true });
    return items;
  };

  const runRowAction = (key, row) => {
    switch (key) {
      case 'view':
        navigate(config.viewRoute(row));
        break;
      case 'edit':
        navigate(config.editRoute(row));
        break;
      case 'duplicate':
        duplicateRow(row);
        break;
      case 'activityLog':
        navigate(`${config.viewRoute(row)}?tab=activities`);
        break;
      case 'archive':
        setConfirm({ type: 'archive', ids: [row.id], label: docNumber(row, config.moduleKey) || config.title });
        break;
      case 'restore':
        setConfirm({ type: 'restore', ids: [row.id], label: docNumber(row, config.moduleKey) || config.title });
        break;
      case 'delete':
        setConfirm({ type: 'delete', ids: [row.id], label: docNumber(row, config.moduleKey) || config.title });
        break;
      case 'permanentDelete':
        setConfirm({ type: 'permanentDelete', ids: [row.id], label: docNumber(row, config.moduleKey) || config.title });
        break;
      case 'changeStatus': {
        setStatusValue(row.status || '');
        setStatusTarget({ ids: [row.id], label: docNumber(row, config.moduleKey) || config.title });
        break;
      }
      default: {
        const result = config.onRowAction?.(key, row, hook, navigate);
        if (result && typeof result.then === 'function') {
          result
            .then((res) => {
              if (res?.ok) toast.success(res.message || 'Action completed');
              else if (res?.error) toast.error(res.error?.message || 'Action failed');
            })
            .catch((err) => toast.error(err?.message || 'Action failed'));
        }
        break;
      }
    }
  };

  const duplicateRow = async (row) => {
    const res = await duplicate(row.id);
    if (res.ok) {
      const data = res.data?.data ?? {};
      toast.success(`${config.title} duplicated as ${docNumber(data, config.moduleKey) || ''}`.trim());
    } else {
      toast.error(res.error?.message || `Failed to duplicate ${config.title.toLowerCase()}`);
    }
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    const { type, ids, label } = confirm;
    let res;
    if (type === 'archive') res = ids.length === 1 ? await archive(ids[0]) : await bulkArchive(ids);
    else if (type === 'restore') res = ids.length === 1 ? await restore(ids[0]) : await bulkRestore(ids);
    else if (type === 'delete') res = ids.length === 1 ? await remove(ids[0]) : await bulkDelete(ids);
    else if (type === 'permanentDelete') res = await bulkDelete(ids);

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

  const applyStatusChange = async () => {
    if (!statusTarget || !statusValue) return;
    setStatusSaving(true);
    try {
      for (const id of statusTarget.ids) {
        const res = await hook.changeStatus(id, statusValue);
        if (!res.ok) {
          toast.error(res.error?.message || 'Failed to change status');
          return;
        }
      }
      toast.success(`${statusTarget.label} moved to ${statusValue}`);
      setStatusTarget(null);
      setStatusValue('');
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err?.message || 'Failed to change status');
    } finally {
      setStatusSaving(false);
    }
  };

  const exportRows = async () => {
    try {
      const blob = await config.service.exportCsv(exportParams());
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config.title.replace(/\s+/g, '_')}_List_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`${config.title} list exported as CSV`);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
    setExportOpen(false);
  };

  const printRows = () => {
    setExportOpen(false);
    if (data.length === 0) {
      toast.error('No data available to print');
      return;
    }
    const printable = columnsState.filter((col) => col.always || !col.hidden).filter((col) => col.key !== 'checkbox' && col.key !== 'actions');
    const header = printable.map((col) => `<th>${col.label}</th>`).join('');
    const body = data
      .map((row) => `<tr>${printable.map((col) => `<td>${String(row[col.key] ?? '—')}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${config.title} Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
  h1 { color: #032f25; font-size: 20px; margin: 0 0 4px; }
  p.meta { color: #64748b; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #032f25; color: #f1f5f9; text-align: left; padding: 7px; text-transform: uppercase; font-size: 9px; }
  tbody td { border-bottom: 1px solid #e2e8f0; padding: 6px 7px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
</style>
</head>
<body>
<h1>${config.title} Report</h1>
<p class="meta">Generated on ${new Date().toISOString().slice(0, 10)} - ${data.length} records</p>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) {
      toast.error('Popup blocked. Please allow pop-ups to print.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const renderCell = (col, row) => {
    if (col.render) return col.render(row, navigate);
    const value = row[col.key];
    switch (col.key) {
      case 'status':
        return <SalesStatusBadge status={value} />;
      case 'createdAt':
      case 'date':
        return <span className="text-slate-500">{formatDate(value)}</span>;
      default:
        if (col.align === 'right') {
          return value != null && value !== '' ? (
            <span className="font-bold text-slate-800 text-right block">{formatINR(value)}</span>
          ) : (
            <span className="text-slate-300 text-[11px] block text-right">—</span>
          );
        }
        return value != null && value !== '' ? String(value) : '—';
    }
  };

  const confirmConfigs = {
    archive: { title: `Archive ${config.title}`, message: `Archive ${confirm?.label}?`, confirmLabel: 'Archive', variant: 'warning', icon: Archive },
    restore: { title: `Restore ${config.title}`, message: `Restore ${confirm?.label} to active records?`, confirmLabel: 'Restore', variant: 'default', icon: RotateCcw },
    delete: { title: `Delete ${config.title}`, message: `Move ${confirm?.label} to trash?`, confirmLabel: 'Delete', variant: 'danger', icon: Trash2 },
    permanentDelete: { title: 'Delete Permanently?', message: `Permanently delete ${confirm?.label}? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger', icon: Trash2 }
  };

  const kpiCards = config.kpis.map((kpi) => ({
    key: kpi.key,
    label: kpi.label,
    value: kpi.valueOf(stats),
    icon: kpi.icon,
    color: kpi.color
  }));

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* ===== BREADCRUMB ===== */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 select-none">
        <span>VISHAK TECH</span>
        <span>&gt;</span>
        <span>Sales Execution</span>
        <span>&gt;</span>
        <span>{config.title}</span>
        <span>&gt;</span>
        <span className="text-slate-600">{config.title} List</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 tracking-tight">
          <config.icon className="w-6 h-6 text-[#0B4A3D]" />
          {config.titlePlural || `${config.title}s`}
        </h1>
        <button
          type="button"
          onClick={() => navigate(config.newRoute)}
          className="flex items-center gap-2 bg-[#0B4A3D] hover:bg-[#083D34] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer select-none w-fit"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> {config.newLabel}
        </button>
      </div>

      {/* ===== KPI CARDS ===== */}
      <SalesKpiCards cards={kpiCards} activeKpi={activeKpi} onSelect={selectKpi} />

      {/* ===== SUBTAB SEGMENTED CONTROL ===== */}
      <div className="inline-flex items-center gap-2 p-1 bg-slate-100 border border-slate-200 rounded-lg mb-4 select-none">
        {[
          { label: 'Active', count: tabCounts.active },
          { label: 'Archived', count: tabCounts.archived },
          { label: 'Deleted', count: tabCounts.deleted }
        ].map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => switchSubtab(index)}
            className={`flex items-center gap-1.5 px-5 h-9 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              subtab === index ? 'bg-[#0B4A3D] text-white shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                subtab === index ? 'bg-white text-[#0B4A3D]' : 'bg-slate-200 text-slate-500'
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
              placeholder={config.searchPlaceholder}
              aria-label={`Search ${config.titlePlural || config.title}`}
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
                  { label: 'Export CSV', icon: FileDown, fn: exportRows },
                  { label: 'Print', icon: Printer, fn: printRows }
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

          <ColumnsDropdown columns={columnsState} onToggle={toggleColumn} disabledKeys={['checkbox', 'status', 'actions']} />

          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
            Showing {totalCount === 0 ? '0-0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)}`} of {totalCount}
          </span>
        </div>
      </div>

      {/* ===== FILTER PANEL ===== */}
      <SalesFilterPanel open={showFilters} filters={filters} onChange={setFilter} onReset={resetFilters} fields={config.filters} />

      {/* ===== BULK ACTION BAR ===== */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-[#0B4A3D]/5 border border-[#0B4A3D]/20 rounded-lg mb-4">
          <span className="text-xs font-bold text-slate-700">
            <strong>{selectedIds.size}</strong> selected
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {subtab === 2 ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirm({ type: 'restore', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({ type: 'permanentDelete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-surface border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirm({ type: 'delete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusValue('');
                    setStatusTarget({ ids: [...selectedIds], label: `${selectedIds.size} record(s)` });
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" /> Change Status
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({ type: 'archive', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
                <button
                  type="button"
                  onClick={exportRows}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== TABLE CARD ===== */}
      <div className="bg-surface border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: config.tableMinWidth || 1000 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide ${
                      col.align === 'right' ? 'text-right' : ''
                    } ${col.sortable ? 'cursor-pointer hover:text-[#0B4A3D] select-none' : ''}`}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    {col.key === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(e) => selectAll(e.target.checked)}
                        aria-label="Select all on page"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-[#0B4A3D] focus:ring-[#0B4A3D] cursor-pointer"
                      />
                    ) : (
                      <>
                        {col.label}
                        {col.sortable && (
                          <span className="ml-1 text-slate-300">
                            {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </span>
                        )}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-16 text-center">
                    <div className="inline-block h-6 w-6 rounded-full border-2 border-slate-200 border-t-[#0B4A3D] animate-spin" />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-16 text-center">
                    <FileText className="w-9 h-9 text-slate-300 mx-auto mb-3" />
                    <div className="text-sm font-bold text-slate-600 mb-1">No {config.titlePlural || config.title} found</div>
                    <div className="text-xs text-slate-400 mb-4">
                      {searchInput || Object.keys(filters).length
                        ? 'Try adjusting your search or filters.'
                        : `Create your first ${config.title.toLowerCase()} to get started.`}
                    </div>
                    {!searchInput && Object.keys(filters).length === 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(config.newRoute)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> {config.newLabel}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    {visibleColumns.map((col) => (
                      <td key={col.key} className={`px-3 py-2.5 text-xs ${col.align === 'right' ? 'text-right' : ''}`}>
                        {col.key === 'checkbox' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={(e) => toggleSelect(row.id, e.target.checked)}
                            aria-label={`Select ${docNumber(row, config.moduleKey) || row.id}`}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#0B4A3D] focus:ring-[#0B4A3D] cursor-pointer"
                          />
                        ) : col.key === 'actions' ? (
                          <CprActionMenu items={buildRowActions(row)} onAction={(key) => runRowAction(key, row)} />
                        ) : (
                          renderCell(col, row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

      {/* ===== CHANGE STATUS DIALOG (ERP change-status flow) ===== */}
      <Modal
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        title="Change Status"
        maxWidth="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setStatusTarget(null)}
              className="text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyStatusChange}
              disabled={!statusValue || statusSaving}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {statusSaving ? 'Saving...' : 'Change Status'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            Move <strong>{statusTarget?.label}</strong> to a new status:
          </div>
          <SelectInput value={statusValue} onChange={(e) => setStatusValue(e.target.value)} aria-label="New status">
            <option value="">Select status</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </SelectInput>
        </div>
      </Modal>
    </div>
  );
}
