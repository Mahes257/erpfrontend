import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, Filter, X, CalendarClock, AlertTriangle, CheckCircle, Eye,
  PhoneCall, CalendarDays, Flag, Inbox, Trash2, RotateCcw, Pencil, Calendar,
  User, Archive
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useFollowUps from '../hooks/useFollowUps';
import useDebounce from '../hooks/useDebounce';
import { FollowUpTable, FollowUpColumnsDropdown } from '../components/FollowUpTable';
import { FollowUpExportDropdown } from '../components/FollowUpExport';
import { ConfirmDialog, useToast } from '../components/Common';
import { FollowUpDetailsModal, RescheduleModal } from '../components/FollowUpModals';
import { AssignOwnerModal } from '../components/LeadModals';
import {
  FOLLOWUP_COLUMNS,
  FOLLOWUP_DATE_STATUS_BADGES,
  FOLLOWUP_STAGE_BADGES,
  FOLLOWUP_TABLE_PRIORITY_BADGES
} from '../utils/followUpConstants';
import { formatDate, getFollowUpStatusInfo } from '../utils/followUpHelpers';
import { STAGES } from '../utils/leadConstants';

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const FILTER_STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' }
];

const FILTER_PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

export default function FollowUpsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    followUps,
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
    deleteFollowUp,
    completeFollowUp,
    archiveFollowUp,
    assignOwner,
    reschedule,
    bulkComplete,
    bulkDelete,
    restoreFollowUp
  } = useFollowUps({ pageSize: 10 });

  const [subtab, setSubtab] = useState('active'); // active | archived | deleted
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [detailsRow, setDetailsRow] = useState(null);
  const [rescheduleRow, setRescheduleRow] = useState(null);
  const [assignModal, setAssignModal] = useState(null); // { ids, label, owner, name, company }
  const storageKey = 'vishak:followups:columns';
  const [columnsState, setColumnsState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved)) {
        const map = Object.fromEntries(saved.map((entry) => [entry.key, entry.visible]));
        return FOLLOWUP_COLUMNS.map((col) => ({ ...col, visible: map[col.key] ?? col.visible }));
      }
    } catch { /* ignore invalid stored columns */ }
    return FOLLOWUP_COLUMNS;
  });

  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(debouncedSearch), 0);
    return () => clearTimeout(timer);
  }, [debouncedSearch, setSearch]);

  const { totalCount } = pagination;
  const { page, pageSize } = pagination;
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const kpiCards = useMemo(
    () => [
      { key: 'totalfollowups', label: 'Total Follow-ups', value: summary?.total ?? totalCount, icon: PhoneCall, color: '#0B4A3D' },
      { key: 'todaysfollowups', label: "Today's Follow-ups", value: summary?.today ?? '—', icon: CalendarDays, color: '#2563eb' },
      { key: 'upcoming', label: 'Upcoming', value: summary?.upcoming ?? '—', icon: CalendarClock, color: '#10b981' },
      { key: 'overdue', label: 'Overdue', value: summary?.overdue ?? '—', icon: AlertTriangle, color: '#ef4444' },
      { key: 'completed', label: 'Completed', value: summary?.completed ?? '—', icon: CheckCircle, color: '#059669' },
      { key: 'highpriority', label: 'High Priority', value: summary?.highPriority ?? '—', icon: Flag, color: '#d97706' }
    ],
    [summary, totalCount]
  );

  // Date-based KPI / filter-panel status mapping (same as OLD.zip filterByKPI)
  const applyDateStatusFilter = useCallback(
    (value) => {
      setFilter('priority', '');
      if (!value) {
        setFilter('status', '');
        setFilter('dateFrom', '');
        setFilter('dateTo', '');
        return;
      }
      const now = new Date();
      const today = toDateStr(now);
      const tomorrow = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      const yesterday = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      if (value === 'today') {
        setFilter('status', 'Pending');
        setFilter('dateFrom', today);
        setFilter('dateTo', today);
      } else if (value === 'upcoming') {
        setFilter('status', 'Pending');
        setFilter('dateFrom', tomorrow);
        setFilter('dateTo', '');
      } else if (value === 'overdue') {
        setFilter('status', 'Pending');
        setFilter('dateFrom', '');
        setFilter('dateTo', yesterday);
      } else if (value === 'completed') {
        setFilter('status', 'Completed');
        setFilter('dateFrom', '');
        setFilter('dateTo', '');
      }
    },
    [setFilter]
  );

  const handleKpiClick = (card) => {
    setSelectedIds([]);
    if (card.key === 'totalfollowups') {
      resetFilters();
      return;
    }
    if (card.key === 'highpriority') {
      setFilter('status', '');
      setFilter('dateFrom', '');
      setFilter('dateTo', '');
      setFilter('priority', 'High');
      return;
    }
    applyDateStatusFilter(card.key);
  };

  const isKpiActive = (key) => {
    if (key === 'totalfollowups') return !filters.status && !filters.priority;
    if (key === 'highpriority') return filters.priority === 'High';
    if (key === 'completed') return filters.status === 'Completed';
    const now = new Date();
    const today = toDateStr(now);
    const tomorrow = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const yesterday = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (key === 'today') return filters.status === 'Pending' && filters.dateFrom === today && filters.dateTo === today;
    if (key === 'upcoming') return filters.status === 'Pending' && filters.dateFrom === tomorrow;
    if (key === 'overdue') return filters.status === 'Pending' && filters.dateTo === yesterday;
    return false;
  };

  // Filter panel status select value derived from the date-based filters
  const filterStatusValue = useMemo(() => {
    if (filters.status === 'Completed') return 'completed';
    const now = new Date();
    const today = toDateStr(now);
    const tomorrow = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const yesterday = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (filters.status === 'Pending' && filters.dateFrom === today && filters.dateTo === today) return 'today';
    if (filters.status === 'Pending' && filters.dateFrom === tomorrow) return 'upcoming';
    if (filters.status === 'Pending' && filters.dateTo === yesterday) return 'overdue';
    return '';
  }, [filters.status, filters.dateFrom, filters.dateTo]);

  const filterPriorityValue = filters.priority ? filters.priority.toLowerCase() : '';
  const filterCount = Object.keys(filters).length;

  const handleSubtabChange = (key) => {
    setSelectedIds([]);
    setSubtab(key);
    // Segmented control only changes the lifecycle status filter
    setFilter('status', key === 'archived' ? 'Archived' : key === 'deleted' ? 'Deleted' : '');
    setFilter('dateFrom', '');
    setFilter('dateTo', '');
    setFilter('priority', '');
  };

  const handleClearFilters = () => {
    resetFilters();
  };

  // Last follow-up column: previous follow-ups for the same lead (within loaded page)
  // Matches OLD.zip getPreviousFollowups: prevList.length > 1 shows the dropdown chevron.
  const lastFollowUpByRow = useMemo(() => {
    const byLead = new Map();
    followUps.forEach((f) => {
      if (!f.leadId) return;
      if (!byLead.has(f.leadId)) byLead.set(f.leadId, []);
      byLead.get(f.leadId).push(f);
    });
    const result = {};
    byLead.forEach((list) => {
      list.sort((a, b) => {
        const d = (a.followUpDate || '').localeCompare(b.followUpDate || '');
        if (d !== 0) return d;
        return (a.id || 0) - (b.id || 0);
      });
      list.forEach((f, i) => {
        const prev = list
          .slice(0, i)
          .filter((p) => p.id !== f.id && (p.followUpDate || '') <= (f.followUpDate || ''));
        result[f.id] = prev.length
          ? { last: prev[prev.length - 1], count: prev.length }
          : null;
      });
    });
    return result;
  }, [followUps]);

  const renderers = useMemo(
    () => ({
      followUpDate: (row) => <span className="text-slate-700">{formatDate(row.followUpDate)}</span>,
      followUpTime: (row) => <span className="text-slate-600">{row.followUpTime || '-'}</span>,
      leadNo: (row) => (
        <button
          onClick={() => row.leadId && navigate(`/leads/${row.leadId}`)}
          className="text-[13px] font-medium text-[#0B4A3D] hover:underline cursor-pointer text-left"
          title="View related lead"
        >
          {row.leadNo || `#${row.leadId || row.id}`}
        </button>
      ),
      customer: (row) => (
        <button
          onClick={() => row.leadId && navigate(`/leads/${row.leadId}`)}
          className="text-[13px] text-slate-700 hover:text-[#0B4A3D] cursor-pointer text-left"
          title="View related lead"
        >
          {row.leadName || row.leadCompany || '-'}
        </button>
      ),
      leadStage: (row) => (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold leading-[1.4] whitespace-nowrap ${FOLLOWUP_STAGE_BADGES[row.leadStage] || FOLLOWUP_STAGE_BADGES.default}`}>
          {row.leadStage || '-'}
        </span>
      ),
      lastFollowUp: (row) => {
        const info = lastFollowUpByRow[row.id];
        if (!info) return <span className="text-slate-300">-</span>;
        return (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="text-slate-600">{formatDate(info.last.followUpDate)}</span>
            {info.count > 1 && <span className="text-[10px] text-slate-400">▾</span>}
          </span>
        );
      },
      remarks: (row) => (
        <span
          className="block max-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis text-slate-600"
          title={row.remarks || ''}
        >
          {row.remarks || '-'}
        </span>
      ),
      mode: (row) => <span className="text-slate-600">{row.mode || 'Call'}</span>,
      priority: (row) => (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold leading-[1.4] whitespace-nowrap ${FOLLOWUP_TABLE_PRIORITY_BADGES[row.priority] || FOLLOWUP_TABLE_PRIORITY_BADGES.default}`}>
          {row.priority || 'Medium'}
        </span>
      ),
      status: (row) => {
        const info = getFollowUpStatusInfo(row);
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold leading-[1.4] whitespace-nowrap ${FOLLOWUP_DATE_STATUS_BADGES[info.badge] || FOLLOWUP_DATE_STATUS_BADGES.Upcoming}`}>
            {info.label}
          </span>
        );
      }
    }),
    [navigate, lastFollowUpByRow]
  );

  const selectedOnPage = useMemo(
    () => followUps.filter((row) => selectedIds.includes(row.id)),
    [followUps, selectedIds]
  );

  const bulkActions = useMemo(() => {
    if (selectedIds.length === 0 || subtab === 'deleted') return [];
    return [
      { key: 'bulkComplete', label: 'Complete', icon: CheckCircle, variant: 'default' },
      { key: 'bulkAssign', label: 'Assign', icon: User, variant: 'default' },
      { key: 'bulkArchive', label: 'Archive', icon: Archive, variant: 'default' },
      { key: 'bulkDelete', label: 'Delete', icon: Trash2, variant: 'danger' }
    ];
  }, [selectedIds, subtab]);

  const buildRowActions = useCallback(
    (row) => {
      if (row.status === 'Deleted') {
        return [
          {
            title: 'MANAGEMENT',
            items: [
              { key: 'restore', label: 'Restore', icon: RotateCcw },
              { key: 'permanentDelete', label: 'Permanent Delete', icon: Trash2, danger: true }
            ]
          }
        ];
      }

      const followUpActions = [
        { key: 'viewDetails', label: 'View Details', icon: Eye },
        { key: 'edit', label: 'Edit', icon: Pencil }
      ];
      if (row.status !== 'Completed' && row.status !== 'Cancelled') {
        followUpActions.push(
          { key: 'complete', label: 'Mark Completed', icon: CheckCircle },
          { key: 'reschedule', label: 'Reschedule', icon: Calendar }
        );
      }

      return [
        {
          title: 'FOLLOW-UP',
          items: followUpActions
        },
        {
          title: 'RELATED',
          items: [{ key: 'viewLead', label: 'View Lead', icon: User }]
        },
        {
          title: 'ACTIONS',
          items: [
            { key: 'archive', label: 'Archive', icon: Archive },
            { key: 'delete', label: 'Delete', icon: Trash2, danger: true }
          ]
        }
      ];
    },
    []
  );

  const handleRowAction = useCallback(
    (actionKey, row) => {
      switch (actionKey) {
        case 'viewDetails':
          setDetailsRow(row);
          break;
        case 'edit':
          navigate(`/followups/${row.id}/edit`);
          break;
        case 'complete':
          completeFollowUp(row.id).then((result) => {
            if (result.ok) toast.success('Follow-up marked completed');
            else toast.error(result.error?.message || 'Operation failed');
          });
          break;
        case 'reschedule':
          setRescheduleRow(row);
          break;
        case 'viewLead':
          navigate(`/leads/${row.leadId}`);
          break;
        case 'archive':
          setConfirmState({ type: 'archive', ids: [row.id], label: row.leadName });
          break;
        case 'delete':
          setConfirmState({ type: 'delete', ids: [row.id], label: row.leadName });
          break;
        case 'restore':
          setConfirmState({ type: 'restore', ids: [row.id], label: row.leadName });
          break;
        case 'permanentDelete':
          setConfirmState({ type: 'permanentDelete', ids: [row.id], label: row.leadName });
          break;
        default:
          break;
      }
    },
    [navigate, completeFollowUp, toast]
  );

  const handleRescheduleSubmit = useCallback(
    async (payload) => {
      if (!rescheduleRow) return false;
      const result = await reschedule(rescheduleRow.id, payload);
      if (result.ok) {
        toast.success('Follow-up rescheduled');
        setRescheduleRow(null);
        return true;
      }
      toast.error(result.error?.message || 'Operation failed');
      return false;
    },
    [rescheduleRow, reschedule, toast]
  );

  const handleAssignSubmit = useCallback(
    async (owner) => {
      if (!assignModal) return false;
      const ids = assignModal.ids;
      const results = await Promise.all(ids.map((id) => assignOwner(id, owner)));
      if (results.some((r) => r.ok)) {
        toast.success(`${results.filter((r) => r.ok).length} follow-up(s) assigned to ${owner}`);
        setAssignModal(null);
        setSelectedIds([]);
        return true;
      }
      const firstError = results.find((r) => !r.ok)?.error?.message;
      toast.error(firstError || 'Operation failed');
      return false;
    },
    [assignModal, assignOwner, toast]
  );

  const handleBulkAction = (actionKey, ids) => {
    if (actionKey === 'bulkAssign') {
      const rows = selectedOnPage.length > 0 ? selectedOnPage : followUps.filter((r) => ids.includes(r.id));
      const first = rows[0] || {};
      setAssignModal({
        ids,
        label: ids.length,
        owner: first.assignedUser || '',
        name: first.leadName || '',
        company: first.leadCompany || ''
      });
      return;
    }
    setConfirmState({ type: actionKey, ids });
  };

  const buildConfirmMessage = (state) => {
    const count = state.ids.length;
    const label = count === 1 && state.label ? `"${state.label}"` : `${count} selected follow-ups`;
    switch (state.type) {
      case 'delete':
        return `Delete the follow-up for ${label}?`;
      case 'archive':
        return `Archive the follow-up for ${label}? It will be moved to the Archived tab and hidden from the default list.`;
      case 'restore':
        return `Restore the follow-up for ${label}?`;
      case 'permanentDelete':
        return `Delete the follow-up for ${label} permanently? This is a soft delete (status Deleted) — the follow-up can still be restored from the Deleted tab.`;
      case 'bulkComplete':
        return `Mark ${count} selected follow-up(s) as completed?`;
      case 'bulkArchive':
        return `Archive ${count} selected follow-up(s)?`;
      case 'bulkDelete':
        return `Delete ${count} selected follow-up(s)?`;
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
      case 'delete':
        result = await deleteFollowUp(ids[0]);
        break;
      case 'archive':
        result = await archiveFollowUp(ids[0]);
        break;
      case 'restore':
        result = await restoreFollowUp(ids[0]);
        break;
      case 'permanentDelete':
        // No permanent-delete endpoint; maps to the same soft delete so the
        // record stays in the DB and can be restored from the Deleted tab.
        result = await deleteFollowUp(ids[0]);
        break;
      case 'bulkComplete':
        result = await bulkComplete(ids);
        break;
      case 'bulkArchive': {
        // No bulk-archive endpoint: archive each selected record individually
        const archiveResults = await Promise.all(ids.map((id) => archiveFollowUp(id)));
        const okCount = archiveResults.filter((r) => r.ok).length;
        result = { ok: okCount > 0, okCount };
        break;
      }
      case 'bulkDelete':
        result = await bulkDelete(ids);
        break;
      default:
        result = { ok: false, error: { message: 'Unknown operation' } };
    }

    if (result.ok) {
      const count = result.okCount ?? ids.length;
      toast.success(
        type === 'delete' || type === 'permanentDelete' ? 'Follow-up deleted'
          : type === 'restore' ? 'Follow-up restored'
          : type === 'archive' || type === 'bulkArchive' ? `${count} follow-up(s) archived`
          : type === 'bulkComplete' ? `${count} follow-up(s) completed`
          : `${count} follow-up(s) updated`
      );
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

  const confirmConfig =
    confirmState?.type === 'delete' || confirmState?.type === 'bulkDelete'
      ? { title: confirmState.type === 'bulkDelete' ? 'Delete Follow-ups' : 'Delete Follow-up', icon: Trash2, variant: 'danger', confirmLabel: 'Delete' }
      : confirmState?.type === 'permanentDelete'
        ? { title: 'Permanent Delete Follow-up', icon: Trash2, variant: 'danger', confirmLabel: 'Delete Permanently' }
        : confirmState?.type === 'restore'
          ? { title: 'Restore Follow-up', icon: RotateCcw, variant: 'default', confirmLabel: 'Restore' }
          : confirmState?.type === 'archive' || confirmState?.type === 'bulkArchive'
            ? { title: confirmState.type === 'bulkArchive' ? 'Archive Follow-ups' : 'Archive Follow-up', icon: Archive, variant: 'warning', confirmLabel: 'Archive' }
            : confirmState?.type === 'bulkComplete'
              ? { title: 'Complete Follow-ups', icon: CheckCircle, variant: 'default', confirmLabel: 'Complete' }
              : null;

  const isDeletedView = subtab === 'deleted';
  // Deleted rows are served by /followups?status=DELETED (soft-deleted leads)
  // and render through the same table — no special-casing required.
  const tableData = followUps;
  const viewPagination = pagination;

  const deletedEmptyState = (
    <div className="text-center py-14">
      <Trash2 className="w-12 h-12 text-slate-200 mx-auto mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-slate-700 dark:text-ink mb-1.5">No Deleted Follow-ups</h3>
      <p className="text-sm text-slate-400">Deleted follow-ups will appear here.</p>
    </div>
  );

  const defaultEmptyState = (
    <div className="text-center py-14">
      {searchInput || filterCount > 0 ? (
        <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" strokeWidth={1.5} />
      ) : (
        <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-4" strokeWidth={1.5} />
      )}
      <h3 className="text-lg font-semibold text-slate-700 dark:text-ink mb-1.5">
        {searchInput || filterCount > 0 ? 'No Matching Follow-ups' : 'No Follow-ups Found'}
      </h3>
      <p className="text-sm text-slate-400 mb-5">
        {searchInput || filterCount > 0
          ? 'No follow-ups matching your search criteria.'
          : 'Create your first follow-up to start tracking communications.'}
      </p>
      {!searchInput && filterCount === 0 && (
        <button
          onClick={() => navigate('/followups/new')}
          className="inline-flex items-center gap-2 text-xs font-bold text-white px-4 py-2 rounded-lg transition-all bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New Follow-up
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
        <span className="text-slate-600 dark:text-ink-2 font-medium">Follow-ups</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-ink flex items-center gap-2.5 m-0">
          <PhoneCall className="w-6 h-6 text-[#0B4A3D]" />
          Follow-ups
        </h1>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/followups/new')}
            className="inline-flex items-center gap-2 text-xs font-bold text-white px-4 py-2.5 rounded-lg transition-all bg-gradient-to-r from-[#136754] to-[#0B4A3D] hover:from-[#17806A] hover:to-[#0F5C4C] shadow-[0_2px_8px_rgba(11,74,61,0.25)] hover:shadow-[0_6px_18px_rgba(11,74,61,0.35)] hover:-translate-y-0.5 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Follow-up
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
              className={`border rounded-xl p-4 flex items-center gap-3 transition-all duration-150 text-left min-h-[100px] cursor-pointer hover:shadow-[0_2px_12px_rgba(10,79,68,0.08)] ${
                active ? 'border-[#0A4F44] bg-[#E8F0EE]' : 'bg-surface border-slate-200 dark:border-line hover:border-slate-300'
              }`}
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
          onClick={() => {
            resetFilters();
            setSubtab('active');
          }}
          className="px-5 py-2.5 border-none bg-transparent text-[13px] font-medium text-[#0B4A3D] cursor-pointer transition-colors flex items-center gap-1.5 border-b-2 border-[#0B4A3D] font-semibold"
        >
          All Follow-ups
          <span className="text-[11px] bg-[#E8F0EE] text-[#0B4A3D] px-2 py-0.5 rounded-full font-semibold">{summary?.total ?? totalCount}</span>
        </button>
      </div>

      {/* Segmented control */}
      <div className="inline-flex items-center gap-0.5 p-1 bg-[#f8fafc] dark:bg-slate-100 border border-slate-200 dark:border-line rounded-[10px] w-fit mb-3 max-[600px]:w-full max-[600px]:flex">
        {[
          { key: 'active', label: 'Active', count: summary?.total ?? totalCount },
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
              filterCount > 0 ? 'text-[#0B4A3D] font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-[#0B4A3D]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {filterCount > 0 && (
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
              placeholder="Search by Lead No, Name, Remarks..."
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
          <FollowUpExportDropdown followUps={tableData} columns={columnsState} filename="followups" noun="follow-ups" />
          <FollowUpColumnsDropdown columns={columnsState} onToggle={toggleColumn} />
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
                  value={filterStatusValue}
                  onChange={(e) => applyDateStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                >
                  {FILTER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Priority</label>
                <select
                  value={filterPriorityValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilter('priority', value === '' ? '' : value === 'urgent' ? 'High' : value.charAt(0).toUpperCase() + value.slice(1));
                  }}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                >
                  {FILTER_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Lead Stage</label>
                <select
                  value={filters.leadStage || ''}
                  onChange={(e) => setFilter('leadStage', e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                >
                  <option value="">All Stages</option>
                  {STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-700 dark:text-ink-2">Date</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => {
                    setFilter('dateFrom', e.target.value);
                    setFilter('dateTo', e.target.value);
                  }}
                  className="w-full h-10 px-3 border border-slate-200 dark:border-line rounded-lg text-[13px] text-slate-700 dark:text-ink bg-surface outline-none focus:border-[#0B4A3D] focus:shadow-[0_0_0_3px_rgba(11,74,61,0.12)] transition-all"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#0B4A3D] px-3 h-10 rounded-lg bg-transparent hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FollowUpTable
        columns={columnsState}
        data={tableData}
        loading={loading}
        error={error}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        pagination={viewPagination}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        selectedIds={isDeletedView ? [] : selectedIds}
        onSelectionChange={setSelectedIds}
        renderers={renderers}
        rowActions={buildRowActions}
        onRowAction={handleRowAction}
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
        selectedLabel="follow-ups"
        bulkBarExtra={
          <FollowUpExportDropdown
            followUps={selectedOnPage}
            columns={columnsState}
            filename="followups-selected"
            noun="follow-ups"
            variant="dark"
            buttonLabel="Export"
          />
        }
        onRetry={refresh}
        errorMessage="Failed to load follow-ups. Please try again."
        emptyMessage="No follow-ups found matching your criteria."
        emptyState={isDeletedView ? deletedEmptyState : defaultEmptyState}
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

      <FollowUpDetailsModal
        open={detailsRow !== null}
        followUp={detailsRow}
        onClose={() => setDetailsRow(null)}
        onEdit={() => {
          const id = detailsRow?.id;
          setDetailsRow(null);
          if (id) navigate(`/followups/${id}/edit`);
        }}
      />

      <RescheduleModal
        open={rescheduleRow !== null}
        followUp={rescheduleRow}
        onClose={() => setRescheduleRow(null)}
        onSubmit={handleRescheduleSubmit}
      />

      <AssignOwnerModal
        key={assignModal?.ids?.join(',') ?? 'none'}
        open={assignModal !== null}
        lead={{
          owner: assignModal?.owner || '',
          name: assignModal?.name || '',
          company: assignModal?.company || ''
        }}
        onClose={() => setAssignModal(null)}
        onSubmit={handleAssignSubmit}
      />
    </div>
  );
}
