import { useState, useEffect, useCallback, useMemo } from 'react';
import leadService, { normalizeApiError } from '../services/leadService';
import { normalizeLead, mapStageToBackend } from '../utils/leadHelpers';

function readStoredState(persistKey) {
  if (!persistKey) return null;
  try {
    const raw = window.localStorage.getItem(persistKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

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

function buildParams({ page, pageSize, search, sortKey, sortDirection, filters }) {
  const params = {
    page: Math.max(0, page - 1),
    size: pageSize,
    search: search.trim() || undefined,
    sort: sortKey ? `${sortKey},${sortDirection}` : undefined
  };
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'stage') {
        const mapped = mapStageToBackend(value);
        if (mapped) params[key] = mapped;
      } else if (key === 'status') {
        // The backend soft-deletes leads (status DELETED); the Deleted tab
        // queries status=DELETED explicitly while default views exclude it.
        params[key] = String(value).toUpperCase();
      } else if (key === 'priority') {
        // Priority lives in the meta blob, not a backend column — filtered client-side.
        return;
      } else {
        params[key] = value;
      }
    }
  });
  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });
  return params;
}

export default function useLeads(options = {}) {
  const { pageSize: initialPageSize = 10, autoLoad = true, endpoint = 'leads', persistKey = null } = options;

  const stored = useMemo(() => readStoredState(persistKey), [persistKey]);

  const [leads, setLeads] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  // When a client-side-only filter (priority) is restored, start at page 1
  // so the sparse-page view cannot persist.
  const [page, setPage] = useState(stored?.filters?.priority ? 1 : (stored?.page ?? 1));
  const [pageSize, setPageSizeState] = useState(stored?.pageSize ?? initialPageSize);
  const [search, setSearchQuery] = useState(stored?.search ?? '');
  const [sortKey, setSortKey] = useState(stored?.sortKey ?? 'createdAt');
  const [sortDirection, setSortDirection] = useState(stored?.sortDirection ?? 'desc');
  const [filters, setFilters] = useState(stored?.filters ?? {});
  const [loading, setLoading] = useState(autoLoad);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!persistKey) return;
    try {
      window.localStorage.setItem(
        persistKey,
        JSON.stringify({ page, pageSize, search, sortKey, sortDirection, filters })
      );
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [persistKey, page, pageSize, search, sortKey, sortDirection, filters]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { priority } = filters;
        // Priority is not a backend column (stored in the meta blob), so the
        // priority filter runs client-side — fetch a wide page when it is
        // active so matches beyond page 1 are visible and the total is real.
        const effectiveSize = priority ? Math.max(pageSize, 200) : pageSize;
        const response = await leadService.listCrm(
          endpoint,
          buildParams({ page, pageSize: effectiveSize, search, sortKey, sortDirection, filters })
        );
        if (cancelled) return;
        const parsed = parsePageResponse(response);
        let list = parsed.list.map(normalizeLead);
        if (priority) {
          const want = String(priority).toLowerCase();
          list = list.filter((lead) => String(lead.priority || '').toLowerCase() === want);
        }
        setLeads(list);
        // Priority filtering is client-side, so the server total no longer
        // matches what is displayed; use the filtered length.
        setTotalCount(priority ? list.length : parsed.total);
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
  }, [page, pageSize, search, sortKey, sortDirection, filters, refreshKey, endpoint]);

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

  const createLead = useCallback((payload) => runMutation(() => leadService.createLead(payload)), [runMutation]);
  const updateLead = useCallback((id, payload) => runMutation(() => leadService.updateLead(id, payload)), [runMutation]);
  const deleteLead = useCallback((id) => runMutation(() => leadService.deleteLead(id)), [runMutation]);
  const deleteLeadPermanent = useCallback((id) => runMutation(() => leadService.deleteLeadPermanent(id)), [runMutation]);
  const archiveLead = useCallback((id) => runMutation(() => leadService.archiveLead(id)), [runMutation]);
  const restoreLead = useCallback((id) => runMutation(() => leadService.restoreLead(id)), [runMutation]);
  const markInactive = useCallback((id) => runMutation(() => leadService.markInactive(id)), [runMutation]);
  const markActive = useCallback((id) => runMutation(() => leadService.markActive(id)), [runMutation]);
  const bulkDelete = useCallback((ids) => runMutation(() => leadService.bulkDelete(ids)), [runMutation]);
  const bulkDeletePermanent = useCallback((ids) => runMutation(() => leadService.bulkDeletePermanent(ids)), [runMutation]);
  const bulkArchive = useCallback((ids) => runMutation(() => leadService.bulkArchive(ids)), [runMutation]);
  const bulkRestore = useCallback((ids) => runMutation(() => leadService.bulkRestore(ids)), [runMutation]);
  const assignOwner = useCallback((id, owner) => runMutation(() => leadService.assignOwner(id, owner)), [runMutation]);
  const changeStage = useCallback((id, stage) => runMutation(() => leadService.changeStage(id, stage)), [runMutation]);
  const changePriority = useCallback((id, priority) => runMutation(() => leadService.changePriority(id, priority)), [runMutation]);
  const duplicateLead = useCallback((id) => runMutation(() => leadService.duplicateLead(id)), [runMutation]);
  const importLeads = useCallback((formData) => runMutation(() => leadService.importLeads(formData)), [runMutation]);

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
    setIsFallback(false);
    setRefreshKey((key) => key + 1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    leads,
    loading,
    actionLoading,
    error,
    isFallback,
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
    createLead,
    updateLead,
    deleteLead,
    deleteLeadPermanent,
    archiveLead,
    restoreLead,
    markInactive,
    markActive,
    bulkDelete,
    bulkDeletePermanent,
    bulkArchive,
    bulkRestore,
    assignOwner,
    changeStage,
    changePriority,
    duplicateLead,
    importLeads
  };
}
