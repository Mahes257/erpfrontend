import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { ConfirmDialog, EditableMasterDropdown, Modal, SelectInput, useToast } from '../../components/Common';
import ColumnsDropdown from '../../components/LeadTable/ColumnsDropdown';
import { CprActionMenu, CprPagination } from '../../components/CprTable';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import useClickOutside from '../../hooks/useClickOutside';
import { formatDate, formatINR } from '../../utils/leadHelpers';
import { docNumber, normalizeQuotation } from '../../utils/salesHelpers';
import { quotationListConfig } from '../../config/salesPageConfigs';
import './quotation-module.css';

/**
 * Quotation List page — visual 1:1 with the ERP Purchase module's
 * purchase-list.html (po-* layout) while keeping every Quotation list
 * action intact (search, KPI filters, filters, sort, bulk ops, export,
 * print, archive/restore/delete, change status, convert, email, PDF).
 * Data flow is identical to the shared SalesListPage: the config's
 * useSalesModule hook drives all state and mutations.
 */
export default function QuotationListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const hook = quotationListConfig.useHook();

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
  const [columnsState, setColumnsState] = useState(quotationListConfig.columns);
  const [confirm, setConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const statusOptions =
    quotationListConfig.filters?.find((f) => f.key === 'status')?.options ||
    quotationListConfig.statuses ||
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
    if (quotationListConfig.rowMenu) {
      return typeof quotationListConfig.rowMenu === 'function'
        ? quotationListConfig.rowMenu(row, hook)
        : quotationListConfig.rowMenu;
    }
    const items = [
      { key: 'view', label: `View ${quotationListConfig.title}`, icon: Eye },
      { key: 'edit', label: 'Edit', icon: Pencil },
      { key: 'duplicate', label: 'Duplicate', icon: Copy },
      { key: 'activityLog', label: 'Activity Log', icon: History },
      { divider: true }
    ];
    if (quotationListConfig.rowActions) {
      items.push(...quotationListConfig.rowActions(row, hook));
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
        navigate(quotationListConfig.viewRoute(row));
        break;
      case 'edit':
        navigate(quotationListConfig.editRoute(row));
        break;
      case 'duplicate':
        duplicateRow(row);
        break;
      case 'activityLog':
        navigate(`${quotationListConfig.viewRoute(row)}?tab=activities`);
        break;
      case 'archive':
        setConfirm({ type: 'archive', ids: [row.id], label: docNumber(row, quotationListConfig.moduleKey) || quotationListConfig.title });
        break;
      case 'restore':
        setConfirm({ type: 'restore', ids: [row.id], label: docNumber(row, quotationListConfig.moduleKey) || quotationListConfig.title });
        break;
      case 'delete':
        setConfirm({ type: 'delete', ids: [row.id], label: docNumber(row, quotationListConfig.moduleKey) || quotationListConfig.title });
        break;
      case 'permanentDelete':
        setConfirm({ type: 'permanentDelete', ids: [row.id], label: docNumber(row, quotationListConfig.moduleKey) || quotationListConfig.title });
        break;
      case 'changeStatus': {
        setStatusValue(row.status || '');
        setStatusTarget({ ids: [row.id], label: docNumber(row, quotationListConfig.moduleKey) || quotationListConfig.title });
        break;
      }
      default: {
        const result = quotationListConfig.onRowAction?.(key, row, hook, navigate);
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
      toast.success(`${quotationListConfig.title} duplicated as ${docNumber(data, quotationListConfig.moduleKey) || ''}`.trim());
    } else {
      toast.error(res.error?.message || `Failed to duplicate ${quotationListConfig.title.toLowerCase()}`);
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

  // ---- Export (PDF / Excel) of the currently filtered & sorted rows ----
  // Walks every page of the active filter/sort query (the backend caps page
  // size at 200) so the file contains ALL matching quotations, then builds
  // the file client-side using only the visible columns.
  const fetchAllFilteredRows = async () => {
    const params = { ...exportParams() };
    delete params.page;
    delete params.size;
    const rows = [];
    const PAGE_SIZE = 200;
    for (let pageIndex = 0; pageIndex <= 250; pageIndex += 1) {
      const res = await quotationListConfig.service.list({ ...params, page: pageIndex, size: PAGE_SIZE });
      const pageRows = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : res?.content ?? res?.data?.content ?? [];
      if (!Array.isArray(pageRows) || pageRows.length === 0) break;
      rows.push(...pageRows.map(normalizeQuotation));
      const total = res?.totalElements ?? res?.data?.totalElements ?? pageRows.length;
      if (rows.length >= total || pageRows.length < PAGE_SIZE) break;
    }
    return rows;
  };

  const exportColumns = () => visibleColumns.filter((col) => col.key !== 'checkbox' && col.key !== 'actions');

  const exportCellValue = (col, row) => {
    switch (col.key) {
      case 'quotationDate':
      case 'validUntil':
      case 'createdAt':
        return formatDate(row[col.key]);
      case 'items':
        return Array.isArray(row.items) ? row.items.length : row.itemsCount ?? '';
      case 'grandTotal':
        return row.grandTotal != null && row.grandTotal !== '' ? formatINR(row.grandTotal) : '';
      case 'status':
        return String(row.status || '').replace(/^\w/, (c) => c.toUpperCase());
      default:
        return row[col.key] != null && row[col.key] !== '' ? String(row[col.key]) : '';
    }
  };

  const exportToExcel = async () => {
    setExportOpen(false);
    try {
      const rows = await fetchAllFilteredRows();
      if (rows.length === 0) {
        toast.error('No data available to export');
        return;
      }
      const cols = exportColumns();
      const header = cols.map((c) => c.label);
      const body = rows.map((row) => cols.map((col) => exportCellValue(col, row)));
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotations');
      XLSX.writeFile(workbook, `Quotations_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Quotation list exported as Excel');
    } catch (err) {
      toast.error(err?.message || 'Excel export failed');
    }
  };

  const exportToPdf = async () => {
    setExportOpen(false);
    try {
      const rows = await fetchAllFilteredRows();
      if (rows.length === 0) {
        toast.error('No data available to export');
        return;
      }
      const cols = exportColumns();
      const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(16);
      doc.setTextColor(3, 47, 37);
      doc.text('Quotation List Report', 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on ${new Date().toISOString().slice(0, 10)} - ${rows.length} records`, 40, 55);
      autoTable(doc, {
        startY: 70,
        head: [cols.map((c) => c.label)],
        body: rows.map((row) => cols.map((col) => exportCellValue(col, row))),
        styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
        headStyles: { fillColor: [3, 47, 37], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 70, bottom: 30 }
      });
      doc.save(`Quotations_List_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Quotation list exported as PDF');
    } catch (err) {
      toast.error(err?.message || 'PDF export failed');
    }
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
            <span className="qpo-amount block text-right">{formatINR(value)}</span>
          ) : (
            <span className="text-slate-300 text-[11px] block text-right">—</span>
          );
        }
        return value != null && value !== '' ? String(value) : '—';
    }
  };

  const confirmConfigs = {
    archive: {
      title: `Archive ${quotationListConfig.title}`,
      message: `Archive ${confirm?.label}?`,
      confirmLabel: 'Archive',
      variant: 'warning',
      icon: Archive
    },
    restore: {
      title: `Restore ${quotationListConfig.title}`,
      message: `Restore ${confirm?.label} to active records?`,
      confirmLabel: 'Restore',
      variant: 'default',
      icon: RotateCcw
    },
    delete: {
      title: `Delete ${quotationListConfig.title}`,
      message: `Move ${confirm?.label} to trash?`,
      confirmLabel: 'Delete',
      variant: 'danger',
      icon: Trash2
    },
    permanentDelete: {
      title: 'Delete Permanently?',
      message: `Permanently delete ${confirm?.label}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      icon: Trash2
    }
  };

  const kpiCards = quotationListConfig.kpis.map((kpi) => ({
    key: kpi.key,
    label: kpi.label,
    value: kpi.valueOf(stats),
    icon: kpi.icon,
    color: kpi.color
  }));

  const activeKpiName = kpiCards.find((k) => k.key === activeKpi)?.label || 'All';

  const kpiIconClass = (color) => {
    const map = {
      '#3b82f6': 'sky',
      '#f59e0b': 'amber',
      '#d97706': 'amber',
      '#16a34a': 'emerald',
      '#10b981': 'emerald',
      '#059669': 'green',
      '#dc2626': 'red',
      '#ef4444': 'red',
      '#8b5cf6': 'purple',
      '#7c3aed': 'purple',
      '#9ca3af': 'gray',
      '#0b4a3d': 'blue',
      '#ec4899': 'pink',
      '#6b7280': 'gray',
      '#2563eb': 'sky',
      '#0284c7': 'sky',
      '#15803d': 'green'
    };
    return map[String(color || '').toLowerCase()] || 'gray';
  };

  return (
    <div className="qpo-page">
      {/* ===== BREADCRUMB ===== */}
      <div className="qpo-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <ChevronDown />
        <a onClick={() => navigate('/quotations')}>Sales Execution</a>
        <ChevronDown />
        <span>Quotation List</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="qpo-page-header">
        <div>
          <h1>
            <quotationListConfig.icon /> Quotations
          </h1>
          <p className="qpo-page-header-subtitle">Manage, approve and track all quotations.</p>
        </div>
        <div className="qpo-header-actions">
          <button type="button" className="qpo-btn qpo-btn-primary" onClick={() => navigate(quotationListConfig.newRoute)}>
            <Plus /> Create Quotation
          </button>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="qpo-kpi-cards">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const active = activeKpi === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => selectKpi(card.key)}
              className={`qpo-kpi-card${active ? ' active' : ''}`}
            >
              <div className={`qpo-kpi-icon ${kpiIconClass(card.color)}`}>
                <Icon />
              </div>
              <div>
                <div className="qpo-kpi-count">{card.value}</div>
                <div className="qpo-kpi-label">{card.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== ACTIVE FILTER INDICATOR ===== */}
      <div className="qpo-filter-active">
        {activeKpi !== 'all' && (
          <>
            <span>
              <Filter /> Active filter: <strong>{activeKpiName}</strong>
            </span>
            <button type="button" className="qpo-clear-btn visible" onClick={() => selectKpi('all')}>
              <X /> Clear Filter
            </button>
          </>
        )}
      </div>

      {/* ===== SUBTAB (Active / Archived / Deleted) ===== */}
      <div className="qpo-tabs" style={{ marginBottom: 14 }}>
        {[
          { label: 'Active', count: tabCounts.active },
          { label: 'Archived', count: tabCounts.archived },
          { label: 'Deleted', count: tabCounts.deleted }
        ].map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => switchSubtab(index)}
            className={`qpo-tab${subtab === index ? ' active' : ''}`}
          >
            {tab.label}
            <span className="qpo-badge qpo-badge-gray" style={{ padding: '0px 7px', fontSize: 10 }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className="qpo-toolbar">
        <div className="qpo-toolbar-left">
          <div className="qpo-search-box">
            <Search />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Quotation No, Client, Sales Person..."
              aria-label="Search quotation list"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex' }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>
          <button type="button" className="qpo-btn qpo-btn-ghost qpo-btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter /> {showFilters ? 'Hide Filters' : 'Filters'} <ChevronDown style={{ width: 10, height: 10 }} />
          </button>
          <button type="button" className="qpo-btn qpo-btn-ghost qpo-btn-sm" onClick={resetFilters}>
            <X /> Clear
          </button>
          <button type="button" className="qpo-btn qpo-btn-ghost qpo-btn-sm" onClick={hook.refresh}>
            <RefreshCw /> Refresh
          </button>
        </div>
        <div className="qpo-toolbar-right">
          <div style={{ position: 'relative' }} ref={exportRef}>
            <button type="button" className="qpo-btn qpo-btn-primary-outline qpo-btn-sm" onClick={() => setExportOpen((prev) => !prev)}>
              <Download /> Export <ChevronDown style={{ width: 10, height: 10 }} />
            </button>
            {exportOpen && (
              <div className="qpo-export-menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 15px 40px rgba(0,0,0,0.12)', minWidth: 210, padding: 6, marginTop: 4 }}>
                <button type="button" onClick={exportToPdf} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: '#374151', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  <FileDown style={{ width: 14, height: 14, color: '#dc2626' }} /> Export to PDF
                </button>
                <div style={{ height: 1, background: '#e5e7eb', margin: '4px 8px' }} />
                <button type="button" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', fontSize: 13, color: '#374151', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  <FileSpreadsheet style={{ width: 14, height: 14, color: '#059669' }} /> Export to Excel
                </button>
              </div>
            )}
          </div>
          <ColumnsDropdown columns={columnsState} onToggle={toggleColumn} disabledKeys={['checkbox', 'status', 'actions']} />
          <span className="qpo-page-info" style={{ marginLeft: 4 }}>
            Showing {totalCount === 0 ? '0-0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)}`} of {totalCount}
          </span>
        </div>
      </div>

      {/* ===== FILTER PANEL ===== */}
      <div className={`qpo-filters${showFilters ? ' show' : ''}`}>
        <div className="qpo-filter-grid">
          {quotationListConfig.filters.map((field) => (
            <div key={field.key} className="qpo-filter-group">
              <label>{field.label}</label>
              {field.type === 'select' && field.masterKey ? (
                <EditableMasterDropdown
                  masterKey={field.masterKey}
                  value={filters[field.key] || ''}
                  placeholder={field.placeholder || 'All'}
                  onChange={(v) => setFilter(field.key, v)}
                />
              ) : field.type === 'select' ? (
                <select value={filters[field.key] || ''} onChange={(e) => setFilter(field.key, e.target.value)}>
                  <option value="">{field.placeholder || 'All'}</option>
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
                />
              )}
            </div>
          ))}
        </div>
        <div className="qpo-filter-actions">
          <button type="button" className="qpo-btn qpo-btn-primary qpo-btn-sm" onClick={() => setShowFilters(false)}>
            <Search /> Apply
          </button>
          <button type="button" className="qpo-btn qpo-btn-ghost qpo-btn-sm" onClick={resetFilters}>
            <RotateCcw /> Reset
          </button>
        </div>
      </div>

      {/* ===== BULK BAR ===== */}
      <div className={`qpo-bulk-bar${selectedIds.size > 0 ? ' visible' : ''}`}>
        <span>
          <strong className="qpo-bulk-count">{selectedIds.size}</strong> selected
        </span>
        <div className="qpo-bulk-actions">
          <button type="button" className="qpo-bulk-btn" onClick={exportToExcel}>
            <Download /> Export
          </button>
          {subtab === 2 ? (
            <>
              <button type="button" className="qpo-bulk-btn" onClick={() => setConfirm({ type: 'restore', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                <RotateCcw /> Restore
              </button>
              <button type="button" className="qpo-bulk-btn qpo-bulk-btn-danger" onClick={() => setConfirm({ type: 'permanentDelete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                <Trash2 /> Delete Permanently
              </button>
            </>
          ) : (
            <>
              <button type="button" className="qpo-bulk-btn" onClick={() => setConfirm({ type: 'delete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                <Trash2 /> Delete
              </button>
              <button
                type="button"
                className="qpo-bulk-btn"
                onClick={() => {
                  setStatusValue('');
                  setStatusTarget({ ids: [...selectedIds], label: `${selectedIds.size} record(s)` });
                }}
              >
                <Tag /> Change Status
              </button>
              <button type="button" className="qpo-bulk-btn" onClick={() => setConfirm({ type: 'archive', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                <Archive /> Archive
              </button>
              <button type="button" className="qpo-bulk-btn" onClick={exportToExcel}>
                <Download /> Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===== TABLE ===== */}
      <div className="qpo-table-card">
        <div className="qpo-table-wrap">
          <table className="qpo-table" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.key === 'checkbox' ? 'qpo-th-check' : ''}${col.align === 'right' ? ' qpo-th-right' : ''}${sortKey === col.key ? ' sorted' : ''}`}
                    style={{ width: col.width }}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    {col.key === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(e) => selectAll(e.target.checked)}
                        aria-label="Select all on page"
                      />
                    ) : (
                      <>
                        {col.label}
                        {col.sortable && <span className="qpo-sort-icon">{sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#0b4a3d', animation: 'qpo-spin 0.8s linear infinite' }} />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length}>
                    <div className="qpo-empty">
                      <FileText />
                      <h4>No Records Found</h4>
                      <p>
                        {searchInput || Object.keys(filters).length
                          ? 'Adjust your filters or search to find quotations.'
                          : 'Create a new quotation to get started.'}
                      </p>
                      {!searchInput && Object.keys(filters).length === 0 && (
                        <button type="button" className="qpo-btn qpo-btn-primary" onClick={() => navigate(quotationListConfig.newRoute)}>
                          <Plus /> {quotationListConfig.newLabel}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id}>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className={col.align === 'right' ? 'qpo-th-right' : undefined} style={col.key === 'actions' ? { textAlign: 'center' } : undefined}>
                        {col.key === 'checkbox' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={(e) => toggleSelect(row.id, e.target.checked)}
                            aria-label={`Select ${docNumber(row, quotationListConfig.moduleKey) || row.id}`}
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

      {/* ===== CHANGE STATUS DIALOG ===== */}
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
              className="qpo-btn qpo-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyStatusChange}
              disabled={!statusValue || statusSaving}
              className="qpo-btn qpo-btn-primary"
            >
              {statusSaving ? 'Saving...' : 'Change Status'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
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
      <style>{`@keyframes qpo-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
