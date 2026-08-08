import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
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
  RotateCcw,
  Search,
  Sparkles,
  Tags,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { ConfirmDialog, useToast } from '../../components/Common';
import ColumnsDropdown from '../../components/LeadTable/ColumnsDropdown';
import { CprActionMenu, CprPagination } from '../../components/CprTable';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import useClickOutside from '../../hooks/useClickOutside';
import { formatDate, formatINR } from '../../utils/leadHelpers';
import { docNumber, normalizeSalesContract } from '../../utils/salesHelpers';
import { salesContractListConfig } from '../../config/salesPageConfigs';
import './sales-contract-module.css';

/**
 * Sales Contract List page — visual 1:1 with the ERP reference page
 * (sales-contracts.html): breadcrumb → page header (+Create New Contract)
 * → 8 KPI cards → module tabs (Overview / Suggested Contracts / Manage
 * Clients / Tag-wise Report) → segmented control (Active / Archived /
 * Deleted) → active-filter strip → toolbar (Show Filters | search, Export,
 * Columns) → filter panel → bulk bar (Approve / Archive / Export / Delete)
 * → white table card → pagination.
 *
 * Every Sales Contract list action stays intact (search, KPI filters,
 * filters, sort, bulk ops, export, archive/restore/delete, approve,
 * convert, email, print, PDF). Data flow is identical to the shared
 * SalesListPage: the config's useSalesModule hook drives all state and
 * mutations.
 */
export default function SalesContractListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const hook = salesContractListConfig.useHook();

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
    approve,
    bulkArchive,
    bulkRestore,
    bulkDelete
  } = hook;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columnsState, setColumnsState] = useState(salesContractListConfig.columns);
  const [confirm, setConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // ERP module tabs: Overview (the list) + three placeholder views.
  const [moduleTab, setModuleTab] = useState('overview');

  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen);

  const pageRows = data;

  const moduleTabs = [
    { key: 'overview', label: 'Overview', icon: ClipboardList, desc: '' },
    { key: 'suggested', label: 'Suggested Contracts', icon: Sparkles, desc: 'AI-powered suggestions will appear here.' },
    { key: 'clients', label: 'Manage Clients', icon: Users, desc: 'Client management interface will appear here.' },
    { key: 'tagwise', label: 'Tag-wise Report', icon: Tags, desc: 'Tag-wise reporting will appear here.' }
  ];

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
    if (salesContractListConfig.rowMenu) {
      return typeof salesContractListConfig.rowMenu === 'function'
        ? salesContractListConfig.rowMenu(row, hook)
        : salesContractListConfig.rowMenu;
    }
    const items = [
      { key: 'view', label: `View ${salesContractListConfig.title}`, icon: Eye },
      { key: 'edit', label: 'Edit', icon: Pencil },
      { key: 'duplicate', label: 'Duplicate', icon: Copy },
      { key: 'activityLog', label: 'Activity Log', icon: History },
      { divider: true }
    ];
    if (salesContractListConfig.rowActions) {
      items.push(...salesContractListConfig.rowActions(row, hook));
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
        navigate(salesContractListConfig.viewRoute(row));
        break;
      case 'edit':
        navigate(salesContractListConfig.editRoute(row));
        break;
      case 'duplicate':
        duplicateRow(row);
        break;
      case 'activityLog':
        navigate(`${salesContractListConfig.viewRoute(row)}?tab=activities`);
        break;
      case 'archive':
        setConfirm({ type: 'archive', ids: [row.id], label: docNumber(row, salesContractListConfig.moduleKey) || salesContractListConfig.title });
        break;
      case 'restore':
        setConfirm({ type: 'restore', ids: [row.id], label: docNumber(row, salesContractListConfig.moduleKey) || salesContractListConfig.title });
        break;
      case 'delete':
        setConfirm({ type: 'delete', ids: [row.id], label: docNumber(row, salesContractListConfig.moduleKey) || salesContractListConfig.title });
        break;
      case 'permanentDelete':
        setConfirm({ type: 'permanentDelete', ids: [row.id], label: docNumber(row, salesContractListConfig.moduleKey) || salesContractListConfig.title });
        break;
      default: {
        const result = salesContractListConfig.onRowAction?.(key, row, hook, navigate);
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
      toast.success(`${salesContractListConfig.title} duplicated as ${docNumber(data, salesContractListConfig.moduleKey) || ''}`.trim());
    } else {
      toast.error(res.error?.message || `Failed to duplicate ${salesContractListConfig.title.toLowerCase()}`);
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

  // Bulk Approve (ERP bulk bar: Approve → Archive → Export → Delete).
  const applyBulkApprove = async () => {
    const rows = pageRows.filter((row) => selectedIds.has(row.id));
    if (rows.length === 0) return;
    try {
      const results = await Promise.all(rows.map((row) => approve(row.id)));
      const failed = results.filter((res) => res && !res.ok);
      if (failed.length === 0) toast.success(`${rows.length} record(s) approved`);
      else toast.error(`${failed.length} record(s) could not be approved`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err?.message || 'Failed to approve records');
    }
  };

  // ---- Export (PDF / Excel) of the currently filtered & sorted rows ----
  // Walks every page of the active filter/sort query (the backend caps page
  // size at 200) so the file contains ALL matching sales contracts, then
  // builds the file client-side using only the visible columns.
  const fetchAllFilteredRows = async () => {
    const params = { ...exportParams() };
    delete params.page;
    delete params.size;
    const rows = [];
    const PAGE_SIZE = 200;
    for (let pageIndex = 0; pageIndex <= 250; pageIndex += 1) {
      const res = await salesContractListConfig.service.list({ ...params, page: pageIndex, size: PAGE_SIZE });
      const pageRows = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : res?.content ?? res?.data?.content ?? [];
      if (!Array.isArray(pageRows) || pageRows.length === 0) break;
      rows.push(...pageRows.map(normalizeSalesContract));
      const total = res?.totalElements ?? res?.data?.totalElements ?? pageRows.length;
      if (rows.length >= total || pageRows.length < PAGE_SIZE) break;
    }
    return rows;
  };

  const exportColumns = () => visibleColumns.filter((col) => col.key !== 'checkbox' && col.key !== 'actions');

  const exportCellValue = (col, row) => {
    switch (col.key) {
      case 'contractDate':
      case 'createdAt':
        return formatDate(row[col.key]);
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Contracts');
      XLSX.writeFile(workbook, `Sales_Contracts_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Sales Contract list exported as Excel');
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
      doc.text('Sales Contract List Report', 40, 40);
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
      doc.save(`Sales_Contracts_List_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Sales Contract list exported as PDF');
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
      case 'contractDate':
      case 'createdAt':
      case 'date':
        return <span className="text-slate-500">{formatDate(value)}</span>;
      case 'scNo':
        return value != null && value !== '' ? (
          <button
            type="button"
            className="scp-order-link"
            onClick={() => navigate(salesContractListConfig.viewRoute(row))}
          >
            {value}
          </button>
        ) : (
          '—'
        );
      default:
        if (col.align === 'right') {
          return value != null && value !== '' ? (
            <span className="scp-amount block text-right">{formatINR(value)}</span>
          ) : (
            <span className="text-slate-300 text-[11px] block text-right">—</span>
          );
        }
        return value != null && value !== '' ? String(value) : '—';
    }
  };

  const confirmConfigs = {
    archive: {
      title: `Archive ${salesContractListConfig.title}`,
      message: `Archive ${confirm?.label}?`,
      confirmLabel: 'Archive',
      variant: 'warning',
      icon: Archive
    },
    restore: {
      title: `Restore ${salesContractListConfig.title}`,
      message: `Restore ${confirm?.label} to active records?`,
      confirmLabel: 'Restore',
      variant: 'default',
      icon: RotateCcw
    },
    delete: {
      title: `Delete ${salesContractListConfig.title}`,
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

  const kpiCards = salesContractListConfig.kpis.map((kpi) => ({
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
    <div className="scp-page">
      {/* ===== BREADCRUMB ===== */}
      <div className="scp-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <ChevronDown />
        <a onClick={() => navigate('/sales-contracts')}>Sales Execution</a>
        <ChevronDown />
        <span>Sales Contract List</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="scp-page-header">
        <div>
          <h1>
            <salesContractListConfig.icon /> Sales Contracts
          </h1>
          <p className="scp-page-header-subtitle">Manage, approve and track all sales contracts.</p>
        </div>
        <div className="scp-header-actions">
          <button type="button" className="scp-btn scp-btn-primary" onClick={() => navigate(salesContractListConfig.newRoute)}>
            <Plus /> Create New Contract
          </button>
        </div>
      </div>

      {/* ===== KPI CARDS (balanced 4x2 grid, 120px, matching ERP reference) ===== */}
      <div className="scp-kpi-cards">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const active = activeKpi === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => selectKpi(card.key)}
              className={`scp-kpi-card${active ? ' active' : ''}`}
            >
              <div className="scp-kpi-top">
                <div className={`scp-kpi-icon ${kpiIconClass(card.color)}`}>
                  <Icon />
                </div>
                <div className="scp-kpi-count">{card.value}</div>
              </div>
              <div className="scp-kpi-label">{card.label}</div>
            </button>
          );
        })}
      </div>

      {/* ===== MODULE TABS (Overview / Suggested Contracts / Manage Clients / Tag-wise Report) ===== */}
      <div className="scp-tabs">
        {moduleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setModuleTab(tab.key)}
              className={`scp-tab${moduleTab === tab.key ? ' active' : ''}`}
            >
              <Icon /> {tab.label}
            </button>
          );
        })}
      </div>

      {moduleTab !== 'overview' ? (
        /* ===== NON-OVERVIEW TAB EMPTY STATES (matching ERP reference) ===== */
        <div className="scp-empty-state">
          {(() => {
            const tab = moduleTabs.find((t) => t.key === moduleTab);
            const Icon = tab.icon;
            return (
              <>
                <Icon />
                <h4>{tab.label}</h4>
                <p>{tab.desc}</p>
              </>
            );
          })()}
        </div>
      ) : (
        <>
          {/* ===== SEGMENTED CONTROL (Active / Archived / Deleted) ===== */}
          <div className="scp-segmented">
            {[
              { label: 'Active', count: tabCounts.active },
              { label: 'Archived', count: tabCounts.archived },
              { label: 'Deleted', count: tabCounts.deleted }
            ].map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => switchSubtab(index)}
                className={`scp-segmented-option${subtab === index ? ' active' : ''}`}
              >
                {tab.label}
                <span className="scp-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* ===== ACTIVE FILTER INDICATOR ===== */}
          <div className="scp-filter-active">
            {activeKpi !== 'all' && (
              <>
                <span>
                  <Filter /> Active filter: <strong>{activeKpiName}</strong>
                </span>
                <button type="button" className="scp-clear-btn visible" onClick={() => selectKpi('all')}>
                  <X /> Clear Filter
                </button>
              </>
            )}
          </div>

          {/* ===== TOOLBAR: Show Filters | Search, Export, Columns (matching ERP reference) ===== */}
          <div className="scp-toolbar">
            <div className="scp-toolbar-left">
              <button type="button" className="scp-btn scp-btn-ghost scp-btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
                <Filter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
            <div className="scp-toolbar-right">
              <div className="scp-search-box">
                <Search />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SC No, Client, Amount, Status..."
                  aria-label="Search sales contracts"
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
              <div style={{ position: 'relative' }} ref={exportRef}>
                <button type="button" className="scp-btn scp-btn-primary-outline scp-btn-sm" onClick={() => setExportOpen((prev) => !prev)}>
                  <Download /> Export <ChevronDown style={{ width: 10, height: 10 }} />
                </button>
                {exportOpen && (
                  <div className="scp-export-menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 15px 40px rgba(0,0,0,0.12)', minWidth: 210, padding: 6, marginTop: 4 }}>
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
            </div>
          </div>

          {/* ===== FILTER PANEL (Status / Client / Date From / Date To + Reset) ===== */}
          <div className={`scp-filters${showFilters ? ' show' : ''}`}>
            <div className="scp-filter-grid">
              {salesContractListConfig.filters.map((field) => (
                <div key={field.key} className="scp-filter-group">
                  <label>{field.label}</label>
                  {field.type === 'select' ? (
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
            <div className="scp-filter-actions">
              <button type="button" className="scp-btn scp-btn-ghost scp-btn-sm" onClick={resetFilters}>
                <RotateCcw /> Reset
              </button>
            </div>
          </div>

          {/* ===== BULK BAR (Approve / Archive / Export / Delete — matching ERP reference) ===== */}
          <div className={`scp-bulk-bar${selectedIds.size > 0 ? ' visible' : ''}`}>
            <span>
              <strong className="scp-bulk-count">{selectedIds.size}</strong> selected
            </span>
            <div className="scp-bulk-actions">
              {subtab === 2 ? (
                <>
                  <button type="button" className="scp-bulk-btn" onClick={() => setConfirm({ type: 'restore', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                    <RotateCcw /> Restore
                  </button>
                  <button type="button" className="scp-bulk-btn" onClick={exportToExcel}>
                    <Download /> Export
                  </button>
                  <button type="button" className="scp-bulk-btn scp-bulk-btn-danger" onClick={() => setConfirm({ type: 'permanentDelete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                    <Trash2 /> Delete Permanently
                  </button>
                </>
              ) : subtab === 1 ? (
                <>
                  <button type="button" className="scp-bulk-btn" onClick={() => setConfirm({ type: 'restore', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                    <RotateCcw /> Restore
                  </button>
                  <button type="button" className="scp-bulk-btn" onClick={exportToExcel}>
                    <Download /> Export
                  </button>
                  <button type="button" className="scp-bulk-btn" onClick={() => setConfirm({ type: 'delete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                    <Trash2 /> Delete
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="scp-bulk-btn" onClick={applyBulkApprove}>
                    <CheckCircle2 /> Approve
                  </button>
                  <button type="button" className="scp-bulk-btn" onClick={() => setConfirm({ type: 'archive', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                    <Archive /> Archive
                  </button>
                  <button type="button" className="scp-bulk-btn" onClick={exportToExcel}>
                    <Download /> Export
                  </button>
                  <button type="button" className="scp-bulk-btn" onClick={() => setConfirm({ type: 'delete', ids: [...selectedIds], label: `${selectedIds.size} record(s)` })}>
                    <Trash2 /> Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ===== TABLE ===== */}
          <div className="scp-table-card">
            <div className="scp-table-wrap">
              <table className="scp-table" style={{ minWidth: 1180 }}>
                <thead>
                  <tr>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`${col.key === 'checkbox' ? 'scp-th-check' : ''}${col.align === 'right' ? ' scp-th-right' : ''}${sortKey === col.key ? ' sorted' : ''}`}
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
                            {col.sortable && <span className="scp-sort-icon">{sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>}
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
                        <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#0b4a3d', animation: 'scp-spin 0.8s linear infinite' }} />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length}>
                        <div className="scp-empty">
                          <FileText />
                          <h4>No Records Found</h4>
                          <p>
                            {searchInput || Object.keys(filters).length
                              ? 'Adjust your filters or search to find sales contracts.'
                              : 'Create a new sales contract to get started.'}
                          </p>
                          {!searchInput && Object.keys(filters).length === 0 && (
                            <button type="button" className="scp-btn scp-btn-primary" onClick={() => navigate(salesContractListConfig.newRoute)}>
                              <Plus /> {salesContractListConfig.newLabel}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id}>
                        {visibleColumns.map((col) => (
                          <td key={col.key} className={col.align === 'right' ? 'scp-th-right' : undefined} style={col.key === 'actions' ? { textAlign: 'center' } : undefined}>
                            {col.key === 'checkbox' ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(row.id)}
                                onChange={(e) => toggleSelect(row.id, e.target.checked)}
                                aria-label={`Select ${docNumber(row, salesContractListConfig.moduleKey) || row.id}`}
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
        </>
      )}
      <style>{`@keyframes scp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
