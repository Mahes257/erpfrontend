import { useState, useEffect, useCallback } from 'react';
import followUpService, { normalizeApiError } from '../services/followUpService';
import { normalizeFollowUp } from '../utils/followUpHelpers';
import { mapStageToBackend } from '../utils/leadHelpers';

function parsePageResponse(response) {
  if (Array.isArray(response)) {
    return { list: response, total: response.length };
  }
  if (response?.content) {
    return { list: response.content, total: response.totalElements ?? response.content.length };
  }
  if (Array.isArray(response?.data)) {
    return { list: response.data, total: response.total ?? response.totalCount ?? response.data.length };
  }
  if (Array.isArray(response?.data?.content)) {
    return { list: response.data.content, total: response.data.totalElements ?? response.data.content.length };
  }
  if (Array.isArray(response?.items)) {
    return { list: response.items, total: response.total ?? response.items.length };
  }
  if (Array.isArray(response?.results)) {
    return { list: response.results, total: response.total ?? response.results.length };
  }
  if (Array.isArray(response?.list)) {
    return { list: response.list, total: response.total ?? response.list.length };
  }
  return { list: [], total: 0 };
}

// Client-side-only filters: stored in the follow-up meta blob (or a lead
// attribute the backend rejects), so they are applied in the load effect
// instead of being sent to the backend.
const CLIENT_SIDE_FILTERS = ['status', 'priority', 'dateFrom', 'dateTo'];

function buildParams({ page, pageSize, search, sortKey, sortDirection, filters }) {
  const params = {
    page: Math.max(0, page - 1),
    size: pageSize,
    search: search.trim() || undefined,
    sort: sortKey ? `${sortKey},${sortDirection}` : undefined
  };
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (CLIENT_SIDE_FILTERS.includes(key)) {
        // The Deleted lifecycle status must reach the server: the default
        // /followups query excludes soft-deleted leads, so client-side
        // filtering could never see them.
        if (key === 'status' && String(value).toLowerCase() === 'deleted') {
          params.status = 'DELETED';
        }
        return;
      }
      if (key === 'stage') {
        // Map the source CRM stage vocabulary (High/Medium/Low) to the
        // backend enum (HOT/WARM/COLD) — the backend rejects the former.
        const mapped = mapStageToBackend(value);
        if (mapped) params[key] = mapped;
        return;
      }
      params[key] = value;
    }
  });
  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });
  return params;
}

export default function useFollowUps(options = {}) {
  const { pageSize: initialPageSize = 10, autoLoad = true } = options;

  const [followUps, setFollowUps] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [search, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('followUpDate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(autoLoad);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { status, priority, dateFrom, dateTo } = filters;
        const hasClientFilter = Boolean(status || priority || dateFrom || dateTo);
        // Client-side filters only see the rows the server returned, so fetch a
        // wide page when one is active — otherwise matches beyond page 1 are
        // invisible and the total understates reality.
        const effectiveSize = hasClientFilter ? Math.max(pageSize, 200) : pageSize;
        const response = await followUpService.listFollowUps(
          buildParams({ page, pageSize: effectiveSize, search, sortKey, sortDirection, filters })
        );
        if (cancelled) return;
        const parsed = parsePageResponse(response);
        let list = parsed.list.map(normalizeFollowUp);
        // The target backend cannot filter follow-ups by schedule status,
        // priority or follow-up date, so those filters run client-side.
        if (status && String(status).toLowerCase() !== 'deleted') {
          const want = String(status).toLowerCase();
          list = list.filter((fu) => String(fu.status || '').toLowerCase() === want);
        }
        if (priority) {
          const want = String(priority).toLowerCase();
          list = list.filter((fu) => String(fu.priority || '').toLowerCase() === want);
        }
        if (dateFrom) {
          list = list.filter((fu) => fu.followUpDate && fu.followUpDate >= dateFrom);
        }
        if (dateTo) {
          list = list.filter((fu) => fu.followUpDate && fu.followUpDate <= dateTo);
        }
        setFollowUps(list);
        // Client-side filters, so the server total no longer matches what is
        // displayed; use the filtered length.
        setTotalCount(hasClientFilter ? list.length : parsed.total);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(normalizeApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, sortKey, sortDirection, filters, refreshKey]);

  const runMutation = useCallback(async (operation) => {
    setActionLoading(true);
    try {
      const result = await operation();
      setError(null);
      setRefreshKey((key) => key + 1);
      return { ok: true, data: result };
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized);
      return { ok: false, error: normalized };
    } finally {
      setActionLoading(false);
    }
  }, []);

  const runRowMutation = useCallback(async (id, operation) => {
    setActionLoading(true);
    try {
      const result = await operation();
      // The schedule mutations return { data: <ApiResponse> } while the
      // status/owner mutations return the ApiResponse directly; unwrap both
      // so the updated row is built from the actual lead payload.
      const updated = normalizeFollowUp(result?.data?.data ?? result?.data ?? result);
      setFollowUps((prev) => prev.map((row) => (row.id === id ? { ...row, ...updated } : row)));
      setError(null);
      setSummaryRefreshKey((key) => key + 1);
      return { ok: true, data: updated };
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized);
      return { ok: false, error: normalized };
    } finally {
      setActionLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      try {
        const response = await followUpService.getSummary();
        if (cancelled) return;
        const s = response?.data ?? response ?? {};
        setSummary({
          total: Number(s.total ?? 0),
          today: Number(s.today ?? 0),
          overdue: Number(s.overdue ?? 0),
          upcoming: Number(s.upcoming ?? 0),
          missed: Number(s.missed ?? 0),
          draft: Number(s.draft ?? 0),
          pending: Number(s.pending ?? 0),
          completed: Number(s.completed ?? 0),
          cancelled: Number(s.cancelled ?? 0),
          archived: Number(s.archived ?? 0),
          deleted: Number(s.deleted ?? 0),
          highPriority: Number(s.highPriority ?? 0)
        });
      } catch {
        if (!cancelled) setSummary(null);
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, summaryRefreshKey]);

  const createFollowUp = useCallback((payload) => runMutation(() => followUpService.createFollowUp(payload)), [runMutation]);
  const updateFollowUp = useCallback((id, payload) => runMutation(() => followUpService.updateFollowUp(id, payload)), [runMutation]);
  const deleteFollowUp = useCallback((id) => runMutation(() => followUpService.deleteFollowUp(id)), [runMutation]);
  const completeFollowUp = useCallback((id) => runRowMutation(id, () => followUpService.completeFollowUp(id)), [runRowMutation]);
  const cancelFollowUp = useCallback((id) => runRowMutation(id, () => followUpService.cancelFollowUp(id)), [runRowMutation]);
  const archiveFollowUp = useCallback((id) => runRowMutation(id, () => followUpService.archiveFollowUp(id)), [runRowMutation]);
  const assignOwner = useCallback(
    (id, owner) => runRowMutation(id, () => followUpService.assignOwner(id, owner)),
    [runRowMutation]
  );
  const reschedule = useCallback(
    (id, payload) => runRowMutation(id, () => followUpService.reschedule(id, payload)),
    [runRowMutation]
  );
  const bulkComplete = useCallback((ids) => runMutation(() => followUpService.bulkComplete(ids)), [runMutation]);
  const bulkCancel = useCallback((ids) => runMutation(() => followUpService.bulkCancel(ids)), [runMutation]);
  const bulkDelete = useCallback((ids) => runMutation(() => followUpService.bulkDelete(ids)), [runMutation]);
  const restoreFollowUp = useCallback((id) => runMutation(() => followUpService.restoreFollowUp(id)), [runMutation]);

  const goToPage = useCallback((nextPage) => {
    setPage(Math.max(1, nextPage));
  }, []);

  const changePageSize = useCallback((size) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (key) => {
      setSortKey(key);
      setSortDirection((direction) => (sortKey === key && direction === 'asc' ? 'desc' : 'asc'));
    },
    [sortKey]
  );

  const setSearch = useCallback((value) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (value === undefined || value === null || value === '') delete next[key];
      return next;
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    followUps,
    loading,
    actionLoading,
    error,
    summary,
    pagination: { page, pageSize, totalCount, totalPages },
    search,
    sortKey,
    sortDirection,
    filters,
    setSearch,
    setFilter,
    resetFilters,
    clearSearch,
    goToPage,
    changePageSize,
    toggleSort,
    refresh,
    createFollowUp,
    updateFollowUp,
    deleteFollowUp,
    completeFollowUp,
    cancelFollowUp,
    archiveFollowUp,
    assignOwner,
    reschedule,
    bulkComplete,
    bulkCancel,
    bulkDelete,
    restoreFollowUp
  };
}
