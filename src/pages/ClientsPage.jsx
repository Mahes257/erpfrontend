import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, Filter, X, Archive, RotateCcw, Trash2, Users, UserCheck, UserMinus,
  IndianRupee, Eye, PencilLine, CalendarClock, CalendarDays, ClipboardList, ListChecks,
  Info, CheckCircle,
  UserCog, Tag, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useClients from '../hooks/useClients';
import useDebounce from '../hooks/useDebounce';
import { ClientTable, ClientColumnsDropdown } from '../components/ClientTable';
import { ConfirmDialog, useToast, Modal } from '../components/Common';
import { ClientExportDropdown } from '../components/ClientExport';
import clientService from '../services/clientService';
import { CLIENT_COLUMNS, CLIENT_STATUSES, INDUSTRIES } from '../utils/clientConstants';
import { formatINR } from '../utils/clientHelpers';

const CONFIRM_CONFIG = {
  archive: { title: 'Archive Client', icon: Archive, variant: 'warning', confirmLabel: 'Archive' },
  restore: { title: 'Restore Client', icon: RotateCcw, variant: 'default', confirmLabel: 'Restore' },
  delete: { title: 'Move to Trash', icon: Trash2, variant: 'danger', confirmLabel: 'Move to Trash' },
  deletePermanent: { title: 'Permanent Delete', icon: Trash2, variant: 'danger', confirmLabel: 'Delete Permanently' },
  bulkArchive: { title: 'Archive Selected', icon: Archive, variant: 'warning', confirmLabel: 'Archive' },
  bulkRestore: { title: 'Restore Selected', icon: RotateCcw, variant: 'default', confirmLabel: 'Restore' },
  bulkDelete: { title: 'Move Selected to Trash', icon: Trash2, variant: 'danger', confirmLabel: 'Move to Trash' },
  bulkDeletePermanent: { title: 'Permanent Delete Selected', icon: Trash2, variant: 'danger', confirmLabel: 'Delete Permanently' }
};

const SUCCESS_MESSAGES = {
  archive: 'Client archived successfully',
  restore: 'Client restored successfully',
  delete: 'Client moved to trash',
  deletePermanent: 'Client moved to trash',
  bulkArchive: (count) => `${count} client(s) archived`,
  bulkRestore: (count) => `${count} client(s) restored`,
  bulkDelete: (count) => `${count} client(s) moved to trash`,
  bulkDeletePermanent: (count) => `${count} client(s) moved to trash`
};

const STATUS_BADGES = {
  Active: 'bg-[#f0fdf4] text-[#16a34a]',
  Inactive: 'bg-[#fffbeb] text-[#d97706]',
  Archived: 'bg-[#f3f4f6] text-[#6b7280]',
  Deleted: 'bg-[#fef2f2] text-[#dc2626]'
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    clients,
    loading,
    error,
    summary,
    pagination,
    setSearch,
    setFilter,
    resetFilters,
    filters,
    toggleSort,
    sortKey,
    sortDirection,
    goToPage,
    changePageSize,
    refresh,
    archiveClient,
    restoreClient,
    deleteClient,
    deleteClientPermanent,
    markInactive,
    markActive,
    bulkArchive,
    bulkRestore,
    bulkDelete,
    bulkDeletePermanent,
    bulkAssignOwner,
    bulkChangeStatus
  } = useClients({ pageSize: 10 });

  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [ownerModal, setOwnerModal] = useState(null); // { ids, label, owners, selected }
  const [statusModal, setStatusModal] = useState(null); // { ids, label, selected }
  const storageKey = 'vishak:clients:columns';
  const [columnsState, setColumnsState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved)) {
        const map = Object.fromEntries(saved.map((entry) => [entry.key, entry.visible]));
        return CLIENT_COLUMNS.map((col) => ({ ...col, visible: map[col.key] ?? col.visible }));
      }
    } catch { /* ignore invalid stored columns */ }
    return CLIENT_COLUMNS;
  });

  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(debouncedSearch), 0);
    return () => clearTimeout(timer);
  }, [debouncedSearch, setSearch]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(clients.map((row) => row.owner).filter(Boolean))).sort(),
    [clients]
  );

  const renderers = useMemo(
    () => ({
      clientCode: (row) => (
        <button
          onClick={() => navigate(`/clients/${row.id}`)}
          className="font-semibold text-[#0B4A3D] hover:underline cursor-pointer text-left whitespace-nowrap"
          title="View client details"
        >
          {row.clientCode || `#${String(row.id).padStart(4, '0')}`}
        </button>
      ),
      name: (row) => (
        <button
          onClick={() => navigate(`/clients/${row.id}`)}
          className="text-[13px] font-semibold text-[#0B4A3D] hover:underline cursor-pointer text-left"
          title="View client details"
        >
          {row.company || row.name || '—'}
        </button>
      ),
      contactPerson: (row) => <span className="text-slate-700 dark:text-ink-2">{row.name || '—'}</span>,
      phone: (row) => (
        <a href={`tel:${row.phone}`} className="text-slate-700 hover:text-[#0B4A3D] dark:text-ink-2">
          {row.phone || '—'}
        </a>
      ),
      email: (row) => (
        <a href={`mailto:${row.email}`} className="text-slate-700 hover:text-[#0B4A3D] dark:text-ink-2">
          {row.email || '—'}
        </a>
      ),
      industry: (row) => <span className="text-slate-600 dark:text-ink-2">{row.industry || '—'}</span>,
      lastFollowUp: () => <span className="text-slate-300 dark:text-ink-3">-</span>,
      nextFollowUp: () => <span className="text-slate-300 dark:text-ink-3">-</span>,
      status: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold leading-[1.4] whitespace-nowrap ${STATUS_BADGES[row.status] || STATUS_BADGES.Archived}`}
        >
          {row.status}
        </span>
      )
    }),
    [navigate]
  );

  const { totalCount } = pagination;
  const { page, pageSize } = pagination;
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const kpiCards = useMemo(
    () => [
      { key: 'total', label: 'Total Clients', value: summary?.total ?? totalCount, icon: Users, color: '#0B4A3D' },
      { key: 'active', label: 'Active Clients', value: summary?.active ?? '—', icon: UserCheck, color: '#10b981' },
      { key: 'inactive', label: 'Inactive', value: summary?.inactive ?? '—', icon: UserMinus, color: '#f59e0b' },
      { key: 'archived', label: 'Archived', value: summary?.archived ?? '—', icon: Archive, color: '#06b6d4' },
      { key: 'deleted', label: 'Deleted', value: summary?.deleted ?? '—', icon: Trash2, color: '#ef4444' },
      { key: 'value', label: 'Portfolio Value', value: summary ? formatINR(summary.portfolioValue) : '—', icon: IndianRupee, color: '#059669', static: true }
    ],
    [summary, totalCount]
  );

  // The segmented control mirrors the active status filter (no separate state)
  const subtab =
    filters.status === 'Archived' ? 'archived' : filters.status === 'Deleted' ? 'deleted' : !filters.status || filters.status === 'Active' ? 'active' : '';

  const isKpiActive = (key) => {
    if (key === 'total') return !filters.status;
    if (key === 'active') return filters.status === 'Active';
    return (filters.status || '').toLowerCase() === key;
  };

  const handleKpiClick = (card) => {
    if (card.static) return;
    if (card.key === 'total') {
      resetFilters();
      return;
    }
    const statusMap = { active: 'Active', inactive: 'Inactive', archived: 'Archived', deleted: 'Deleted' };
    setFilter('status', statusMap[card.key] || '');
  };

  const handleSubtabChange = (key) => {
    setSelectedIds([]);
    // Only change the status filter — keep industry/owner/date filters intact
    setFilter('status', key === 'archived' ? 'Archived' : key === 'deleted' ? 'Deleted' : '');
  };

  const filterCount = Object.keys(filters).length;

  const handleResetFilters = () => {
    resetFilters();
  };

  const selectedOnPage = useMemo(
    () => clients.filter((row) => selectedIds.includes(row.id)),
    [clients, selectedIds]
  );

  const bulkActions = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const anyActive = selectedOnPage.some((row) => row.status !== 'Archived' && row.status !== 'Deleted');
    const anyArchivedOrDeleted = selectedOnPage.some((row) => row.status === 'Archived' || row.status === 'Deleted');
    const actions = [];
    if (anyArchivedOrDeleted) actions.push({ key: 'bulkRestore', label: 'Restore', icon: RotateCcw, variant: 'default' });
    actions.push({ key: 'bulkDeletePermanent', label: 'Delete Permanently', icon: Trash2, variant: 'danger' });
    actions.push({ key: 'bulkDelete', label: 'Delete', icon: Trash2, variant: 'default' });
    actions.push({ key: 'bulkAssignOwner', label: 'Assign Owner', icon: UserCog, variant: 'default' });
    actions.push({ key: 'bulkChangeStatus', label: 'Change Status', icon: Tag, variant: 'default' });
    if (anyActive) actions.push({ key: 'bulkArchive', label: 'Archive', icon: Archive, variant: 'default' });
    return actions;
  }, [selectedIds, selectedOnPage]);

  const buildRowActions = useCallback((row) => {
    if (row.status === 'Deleted') {
      return [
        {
          title: 'MANAGEMENT',
          items: [
            { key: 'restore', label: 'Restore', icon: RotateCcw },
            { key: 'deletePermanent', label: 'Permanent Delete', icon: Trash2, danger: true }
          ]
        }
      ];
    }

    const statusActions = [];
    if (row.status === 'Archived') {
      statusActions.push({ key: 'restore', label: 'Restore', icon: RotateCcw });
    } else {
      statusActions.push({ key: 'archive', label: 'Archive', icon: Archive });
    }
    if (row.status === 'Inactive') {
      statusActions.push({ key: 'markActive', label: 'Activate', icon: CheckCircle });
    } else {
      statusActions.push({ key: 'markInactive', label: 'Mark Inactive', icon: CheckCircle });
    }
    statusActions.push({ key: 'delete', label: 'Move to Trash', icon: Trash2, danger: true });

    return [
      {
        title: 'CLIENT',
        items: [
          { key: 'view', label: 'View Client', icon: Eye },
          { key: 'edit', label: 'Edit Client', icon: PencilLine }
        ]
      },
      {
        title: 'FOLLOW-UPS',
        items: [
          { key: 'createFollowUp', label: 'Create Follow-up', icon: CalendarClock },
          { key: 'viewFollowUps', label: 'View Follow-ups', icon: CalendarDays }
        ]
      },
      {
        title: 'CUSTOMER PURCHASE REQUEST (CPR)',
        items: [
          { key: 'createCpr', label: 'Create CPR', icon: ClipboardList },
          { key: 'viewCprs', label: 'View CPR List', icon: ListChecks }
        ]
      },
      {
        title: 'CLIENT RECORDS',
        items: [{ key: 'clientDetails', label: 'Client Details', icon: Info }]
      },
      {
        title: 'MANAGEMENT',
        items: statusActions
      }
    ];
  }, []);

  const handleStatusChange = useCallback(async (action, row) => {
    const result = action === 'inactive' ? await markInactive(row.id) : await markActive(row.id);
    if (result.ok) {
      toast.success(action === 'inactive' ? `${row.name} marked inactive` : `${row.name} activated`);
    } else {
      toast.error(result.error?.message || 'Operation failed');
    }
  }, [markInactive, markActive, toast]);

  const handleRowAction = useCallback((actionKey, row) => {
    switch (actionKey) {
      case 'view':
      case 'clientDetails':
        navigate(`/clients/${row.id}`);
        break;
      case 'edit':
        navigate(`/clients/${row.id}/edit`);
        break;
      case 'createFollowUp':
        navigate('/followups/new');
        break;
      case 'viewFollowUps':
        navigate('/followups');
        break;
      case 'createCpr':
        navigate('/cprs/new', { state: { lead: row } });
        break;
      case 'viewCprs':
        navigate('/cprs');
        break;
      case 'markInactive':
        handleStatusChange('inactive', row);
        break;
      case 'markActive':
        handleStatusChange('active', row);
        break;
      case 'archive':
        setConfirmState({ type: 'archive', ids: [row.id], label: row.name });
        break;
      case 'restore':
        setConfirmState({ type: 'restore', ids: [row.id], label: row.name });
        break;
      case 'delete':
        setConfirmState({ type: 'delete', ids: [row.id], label: row.name });
        break;
      case 'deletePermanent':
        setConfirmState({ type: 'deletePermanent', ids: [row.id], label: row.name });
        break;
      default:
        break;
    }
  }, [navigate, handleStatusChange]);

  const handleBulkAction = (actionKey, ids) => {
    if (actionKey === 'bulkAssignOwner') {
      openOwnerModal(ids);
      return;
    }
    if (actionKey === 'bulkChangeStatus') {
      setStatusModal({ ids, selected: 'Active' });
      return;
    }
    setConfirmState({ type: actionKey, ids });
  };

  const openOwnerModal = async (ids) => {
    let owners = ownerOptions;
    try {
      const response = await clientService.getUsers();
      const list = Array.isArray(response) ? response : response?.data ?? [];
      const userNames = list.map((u) => u.name || u.username || u.email || '').filter(Boolean);
      if (userNames.length > 0) {
        owners = userNames
          .concat(ownerOptions)
          .filter((value, index, self) => value && self.indexOf(value) === index);
      }
    } catch { /* fall back to owners seen on the current page */ }
    setOwnerModal({ ids, label: ids.length, owners, selected: owners[0] || '' });
  };

  const executeBulkAssignOwner = async () => {
    if (!ownerModal || !ownerModal.selected) return;
    const { ids, selected } = ownerModal;
    setOwnerModal((prev) => ({ ...prev, loading: true }));
    const result = await bulkAssignOwner(ids, selected);
    if (result.ok) {
      toast.success(`${ids.length} client(s) assigned to ${selected}`);
      setOwnerModal(null);
      setSelectedIds([]);
    } else {
      toast.error(result.error?.message || 'Failed to assign owner');
      setOwnerModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const executeBulkChangeStatus = async () => {
    if (!statusModal) return;
    const { ids, selected } = statusModal;
    setStatusModal((prev) => ({ ...prev, loading: true }));
    const result = await bulkChangeStatus(ids, selected);
    if (result.ok) {
      toast.success(`${ids.length} client(s) updated to ${selected}`);
      setStatusModal(null);
      setSelectedIds([]);
    } else {
      toast.error(result.error?.message || 'Operation failed');
      setStatusModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const buildConfirmMessage = (state) => {
    const count = state.ids.length;
    const label = count === 1 && state.label ? `"${state.label}"` : `${count} selected clients`;
    switch (state.type) {
      case 'archive':
        return `Archive ${label}? Archived clients can be restored anytime.`;
      case 'restore':
        return `Restore ${label} to active clients?`;
      case 'delete':
        return `Move ${label} to trash? Deleted clients can be restored anytime.`;
      case 'deletePermanent':
        return `Delete ${label} permanently? This is a soft delete (status Deleted) — the client can still be restored from the Deleted tab.`;
      case 'bulkArchive':
        return `Archive ${count} selected clients?`;
      case 'bulkRestore':
        return `Restore ${count} selected clients to active clients?`;
      case 'bulkDelete':
        return `Move ${count} selected clients to trash?`;
      case 'bulkDeletePermanent':
        return `Delete ${count} selected clients permanently? This is a soft delete — they can still be restored from the Deleted tab.`;
      default:
        return '';
    }
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const { type, ids } = confirmState;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    let result;
    switch (type) {
      case 'archive':
        result = await archiveClient(ids[0]);
        break;
      case 'restore':
        result = await restoreClient(ids[0]);
        break;
      case 'delete':
        result = await deleteClient(ids[0]);
        break;
      case 'deletePermanent':
        result = await deleteClientPermanent(ids[0]);
        break;
      case 'bulkArchive':
        result = await bulkArchive(ids);
        break;
      case 'bulkRestore':
        result = await bulkRestore(ids);
        break;
      case 'bulkDelete':
        result = await bulkDelete(ids);
        break;
      case 'bulkDeletePermanent':
        result = await bulkDeletePermanent(ids);
        break;
      default:
        result = { ok: false, error: { message: 'Unknown operation' } };
    }

    if (result.ok) {
      const message = typeof SUCCESS_MESSAGES[type] === 'function' ? SUCCESS_MESSAGES[type](ids.length) : SUCCESS_MESSAGES[type];
      toast.success(message);
      setSelectedIds([]);
      setConfirmState(null);
    } else {
      toast.error(result.error?.message || 'Operation failed');
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  };

  const toggleColumn = (key) => {
    setColumnsState((prev) => {
      const next = prev.map((col) => (col.key === key ? { ...col, visible: col.visible === false } : col));
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(next.map((col) => ({ key: col.key, visible: col.visible !== false })))
        );
      } catch { /* ignore storage failure */ }
      return next;
    });
  };

  const confirmConfig = confirmState ? CONFIRM_CONFIG[confirmState.type] : null;
  const showFiltersActive = filterCount > 0;

  const emptyState = (
    <div className="text-center py-14">
      <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-slate-700 dark:text-ink mb-1.5">No Clients Found</h3>
      <p className="text-sm text-slate-400 mb-5">
        {searchInput || filterCount > 0
          ? 'No clients matching your search criteria.'
          : 'Create your first client to start managing customers.'}
      </p>
      {!searchInput && filterCount === 0 && (
        <button
          onClick={() => navigate('/clients/new')}
          className="inline-flex items-center gap-2 text-xs font-bold text-white px-4 py-2 rounded-lg transition-all bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Client
        </button>
      )}
    </div>
  );

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden dark:text-ink">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-slate-400 dark:text-ink-3 mb-2 select-none">
        <button onClick={() => navigate('/dashboard')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">Dashboard</button>
        <span className="text-[10px] text-slate-300">›</span>
        <span className="text-slate-400">Sales</span>
        <span className="text-[10px] text-slate-300">›</span>
        <span className="text-slate-600 dark:text-ink-2 font-medium">Clients</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-ink flex items-center gap-2.5 m-0">
          <Users className="w-6 h-6 text-[#0B4A3D]" />
          Your Clients
        </h1>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/clients/new')}
            className="inline-flex items-center gap-2 text-xs font-bold text-white px-4 py-2.5 rounded-lg transition-all bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] shadow-[0_2px_8px_rgba(11,74,61,0.25)] hover:shadow-[0_6px_18px_rgba(11,74,61,0.35)] hover:-translate-y-0.5 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add Client
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5 select-none">
        {kpiCards.map((card) => {
          const active = isKpiActive(card.key);
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleKpiClick(card)}
              className={`border rounded-xl p-4 flex items-center gap-3 transition-all duration-150 text-left min-h-[100px] ${
                card.static ? 'cursor-default' : 'cursor-pointer hover:shadow-[0_2px_12px_rgba(10,79,68,0.08)]'
              } ${active ? 'border-[#0A4F44] bg-[#E8F0EE]' : 'bg-surface border-slate-200 dark:border-line hover:border-slate-300'}`}
            >
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: `${card.color}18`, color: card.color }}
              >
                <card.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[22px] font-bold text-slate-800 dark:text-ink leading-[1.2]">{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-ink-3 font-medium leading-snug">{card.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab */}
      <div className="flex gap-0.5 mb-4 border-b border-slate-200 dark:border-line">
        <button
          onClick={resetFilters}
          className="px-5 py-2.5 border-none bg-transparent text-[13px] font-medium text-[#0B4A3D] cursor-pointer transition-colors flex items-center gap-1.5 border-b-2 border-[#0B4A3D] font-semibold"
        >
          All Clients
          <span className="text-[11px] bg-[#E8F0EE] text-[#0B4A3D] px-2 py-0.5 rounded-full font-semibold">{summary?.total ?? totalCount}</span>
        </button>
      </div>

      {/* Segmented control */}
      <div className="inline-flex items-center gap-0.5 p-1 bg-[#f8fafc] dark:bg-slate-100 border border-slate-200 dark:border-line rounded-[10px] w-fit mb-3 max-[600px]:w-full max-[600px]:flex">
        {[
          { key: 'active', label: 'Active', count: summary?.active },
          { key: 'archived', label: 'Archived', count: summary?.archived },
          { key: 'deleted', label: 'Deleted', count: summary?.deleted }
        ].map((option) => (
          <button
            key={option.key}
            onClick={() => handleSubtabChange(option.key)}
            className={`h-9 px-5 border rounded-lg text-[13px] font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap max-[600px]:flex-1 max-[600px]:justify-center ${
              subtab === option.key
                ? 'bg-[#0F5B4C] text-white font-semibold border-[#0F5B4C] border-2 shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                : 'bg-white dark:bg-surface text-slate-500 dark:text-ink-2 border-slate-200 dark:border-line hover:bg-slate-100 hover:border-slate-300'
            }`}
          >
            {option.label}
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold leading-none ${
                subtab === option.key ? 'bg-white text-[#0F5B4C]' : 'bg-slate-200 text-slate-500 dark:bg-line dark:text-ink-2'
              }`}
            >
              {option.count ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg bg-transparent transition-colors cursor-pointer ${
              showFiltersActive ? 'text-[#0B4A3D] font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-[#0B4A3D]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {showFiltersActive && (
              <span className="bg-[#0B4A3D] text-white text-[10px] px-1.5 rounded-full font-bold">{filterCount}</span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Client Code, Business Name, Phone, Email..."
              className="w-full h-10 pl-9 pr-8 bg-surface border border-slate-200 dark:border-line rounded-[10px] text-[13px] text-slate-700 dark:text-ink placeholder-slate-400 outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <ClientExportDropdown clients={clients} columns={columnsState} filename="clients" noun="clients" />
          <ClientColumnsDropdown columns={columnsState} onToggle={toggleColumn} />
          <span className="text-xs text-slate-400 dark:text-ink-3 whitespace-nowrap">
            Showing {start}-{end} of {totalCount}
          </span>
        </div>
      </div>

      {/* Filter panel */}
      <div className={`lead-filter-collapse ${showFilters ? 'open' : ''}`}>
        <div className="lead-filter-collapse-inner">
          <div className="bg-surface border border-slate-200 dark:border-line rounded-2xl p-5 mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilter('status', e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                >
                  <option value="">All Statuses</option>
                  {CLIENT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Industry</label>
                <select
                  value={filters.industry || ''}
                  onChange={(e) => setFilter('industry', e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                >
                  <option value="">All Industries</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Sales Person</label>
                <select
                  value={filters.owner || ''}
                  onChange={(e) => setFilter('owner', e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                >
                  <option value="">All Sales Persons</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilter('dateFrom', e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilter('dateTo', e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#0B4A3D] px-3 h-10 rounded-lg bg-transparent hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ClientTable
        columns={columnsState}
        data={clients}
        loading={loading}
        error={error}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        pagination={pagination}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        renderers={renderers}
        rowActions={buildRowActions}
        onRowAction={handleRowAction}
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
        selectedLabel="clients"
        bulkBarExtra={
          <ClientExportDropdown
            clients={selectedOnPage}
            columns={columnsState}
            filename="clients-selected"
            noun="clients"
            variant="dark"
            buttonLabel="Export"
          />
        }
        onRetry={refresh}
        errorMessage="Failed to load clients. Please try again."
        emptyState={emptyState}
      />

      {confirmState && confirmConfig && (
        <ConfirmDialog
          open={confirmState !== null}
          title={confirmConfig.title}
          message={buildConfirmMessage(confirmState)}
          confirmLabel={confirmConfig.confirmLabel}
          variant={confirmConfig.variant}
          icon={confirmConfig.icon}
          loading={confirmState.loading || false}
          onConfirm={executeConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Assign Owner modal */}
      <Modal
        open={ownerModal !== null}
        onClose={() => setOwnerModal(null)}
        title={`Assign Owner (${ownerModal?.ids?.length ?? 0} selected)`}
        footer={
          <>
            <button
              onClick={() => setOwnerModal(null)}
              disabled={ownerModal?.loading}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={executeBulkAssignOwner}
              disabled={!ownerModal?.selected || ownerModal?.loading}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] px-4 py-2 rounded-lg hover:from-[#17806A] hover:to-[#0F5C4C] transition-colors cursor-pointer disabled:opacity-50"
            >
              {ownerModal?.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Assign Owner
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Owner</label>
          <input
            list="client-owner-options"
            value={ownerModal?.selected || ''}
            onChange={(e) => setOwnerModal((prev) => ({ ...prev, selected: e.target.value }))}
            placeholder="Select or type an owner"
            className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
          />
          <datalist id="client-owner-options">
            {(ownerModal?.owners || []).map((owner) => (
              <option key={owner} value={owner} />
            ))}
          </datalist>
        </div>
      </Modal>

      {/* Change Status modal */}
      <Modal
        open={statusModal !== null}
        onClose={() => setStatusModal(null)}
        title={`Change Status (${statusModal?.ids?.length ?? 0} selected)`}
        footer={
          <>
            <button
              onClick={() => setStatusModal(null)}
              disabled={statusModal?.loading}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={executeBulkChangeStatus}
              disabled={!statusModal?.selected || statusModal?.loading}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#136754] to-[#0B4A3D] px-4 py-2 rounded-lg hover:from-[#17806A] hover:to-[#0F5C4C] transition-colors cursor-pointer disabled:opacity-50"
            >
              {statusModal?.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Change Status
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">New Status</label>
          <select
            value={statusModal?.selected || 'Active'}
            onChange={(e) => setStatusModal((prev) => ({ ...prev, selected: e.target.value }))}
            className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
          >
            {CLIENT_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
