import { useState, useEffect, useCallback } from 'react';
import clientService, { normalizeApiError } from '../services/clientService';
import { normalizeClient } from '../utils/clientHelpers';
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
        // Pass every lifecycle status through — including DELETED — so the
        // Deleted tab queries the server (the default /clients query excludes
        // soft-deleted records, so client-side filtering could never see them).
        params[key] = String(value).toUpperCase();
      } else if (key === 'industry') {
        // Not a server param on /clients — filtered client-side below.
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

export default function useClients(options = {}) {
  const { pageSize: initialPageSize = 10, autoLoad = true } = options;

  const [clients, setClients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [search, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(autoLoad);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { industry } = filters;
        // Industry is not a server param on /clients, so it is filtered
        // client-side — fetch a wide page when it is active so matches
        // beyond page 1 are visible and the total is real.
        const effectiveSize = industry ? Math.max(pageSize, 200) : pageSize;
        const response = await clientService.listClients(
          buildParams({ page, pageSize: effectiveSize, search, sortKey, sortDirection, filters })
        );
        if (cancelled) return;
        const parsed = parsePageResponse(response);
        let list = parsed.list.map(normalizeClient);
        if (industry) {
          const want = String(industry).toLowerCase();
          list = list.filter((c) => (c.industry || '').toLowerCase() === want);
        }
        setClients(list);
        // Client-side filter, so the server total no longer matches what is
        // displayed; use the filtered length.
        setTotalCount(industry ? list.length : parsed.total);
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

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      try {
        const response = await clientService.getSummary();
        if (cancelled) return;
        const s = response?.data ?? response ?? {};
        setSummary({
          total: Number(s.total ?? 0),
          active: Number(s.active ?? 0),
          inactive: Number(s.inactive ?? 0),
          archived: Number(s.archived ?? 0),
          deleted: Number(s.deleted ?? 0),
          portfolioValue: Number(s.portfolioValue ?? 0)
        });
      } catch {
        if (!cancelled) setSummary(null);
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const createClient = useCallback((payload) => runMutation(() => clientService.createClient(payload)), [runMutation]);
  const updateClient = useCallback((id, payload) => runMutation(() => clientService.updateClient(id, payload)), [runMutation]);
  const deleteClient = useCallback((id) => runMutation(() => clientService.deleteClient(id)), [runMutation]);
  const deleteClientPermanent = useCallback((id) => runMutation(() => clientService.deleteClientPermanent(id)), [runMutation]);
  const archiveClient = useCallback((id) => runMutation(() => clientService.archiveClient(id)), [runMutation]);
  const restoreClient = useCallback((id) => runMutation(() => clientService.restoreClient(id)), [runMutation]);
  const markInactive = useCallback((id) => runMutation(() => clientService.markInactive(id)), [runMutation]);
  const markActive = useCallback((id) => runMutation(() => clientService.markActive(id)), [runMutation]);
  const bulkDelete = useCallback((ids) => runMutation(() => clientService.bulkDelete(ids)), [runMutation]);
  const bulkDeletePermanent = useCallback((ids) => runMutation(() => clientService.bulkDeletePermanent(ids)), [runMutation]);
  const bulkArchive = useCallback((ids) => runMutation(() => clientService.bulkArchive(ids)), [runMutation]);
  const bulkRestore = useCallback((ids) => runMutation(() => clientService.bulkRestore(ids)), [runMutation]);
  const assignOwner = useCallback((id, owner) => runMutation(() => clientService.assignOwner(id, owner)), [runMutation]);
  const bulkAssignOwner = useCallback((ids, owner) => runMutation(() => clientService.bulkAssignOwner(ids, owner)), [runMutation]);
  const bulkChangeStatus = useCallback((ids, status) => runMutation(() => clientService.bulkChangeStatus(ids, status)), [runMutation]);
  const importClients = useCallback((formData) => runMutation(() => clientService.importClients(formData)), [runMutation]);

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

  const setSort = useCallback((key, direction = 'desc') => {
    setSortKey(key);
    setSortDirection(direction);
    setPage(1);
  }, []);

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
    clients,
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
    setSort,
    refresh,
    createClient,
    updateClient,
    deleteClient,
    deleteClientPermanent,
    archiveClient,
    restoreClient,
    markInactive,
    markActive,
    bulkDelete,
    bulkDeletePermanent,
    bulkArchive,
    bulkRestore,
    assignOwner,
    bulkAssignOwner,
    bulkChangeStatus,
    importClients
  };
}
