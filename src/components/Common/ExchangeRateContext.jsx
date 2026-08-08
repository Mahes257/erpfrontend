import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import exchangeRateService from '../../services/exchangeRateService';

const REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours

const ExchangeRateContext = createContext(null);

/**
 * Centralized exchange rates for the whole app (single source of truth).
 *
 * - Loads the latest rates (cached in MySQL by the backend) on mount.
 * - Silently refreshes in the background when the cached rates are stale or
 *   older than 24 hours — no page reload, no UI disruption.
 * - If the backend/provider is unavailable, the last cached rates stay in
 *   memory so quotations keep working.
 */
export function ExchangeRateProvider({ children }) {
  const [rates, setRates] = useState({});
  const [base, setBase] = useState('INR');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyLatest = useCallback((payload) => {
    const d = payload?.data ?? payload ?? {};
    if (d.base) setBase(d.base);
    if (d.rates && typeof d.rates === 'object') setRates(d.rates);
    if (d.lastUpdated) setLastUpdated(d.lastUpdated);
    setStale(Boolean(d.stale));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await exchangeRateService.getLatest();
        if (cancelled) return;
        applyLatest(res);
        const d = res?.data ?? res ?? {};
        const last = d.lastUpdated ? new Date(d.lastUpdated) : null;
        const needsRefresh =
          d.stale || !last || Number.isNaN(last.getTime()) || Date.now() - last.getTime() > REFRESH_MS;
        if (needsRefresh) {
          // Background daily refresh — never blocks or reloads the UI.
          exchangeRateService
            .refresh()
            .then((r) => {
              if (!cancelled) applyLatest(r);
            })
            .catch(() => {});
        }
      } catch {
        // Provider unreachable: quotations continue with existing values.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLatest]);

  /** Manual "Refresh Now" (used by Financial Settings). */
  const refreshNow = useCallback(async () => {
    const res = await exchangeRateService.refresh();
    applyLatest(res);
    return res?.data ?? res ?? {};
  }, [applyLatest]);

  return (
    <ExchangeRateContext.Provider
      value={{ rates, base, lastUpdated, stale, loading, refreshNow }}
    >
      {children}
    </ExchangeRateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExchangeRates() {
  const ctx = useContext(ExchangeRateContext);
  if (!ctx) {
    return { rates: {}, base: 'INR', lastUpdated: null, stale: false, loading: false, refreshNow: async () => ({}) };
  }
  return ctx;
}
