import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { onPriceAlerts, setPriceAlert, type PriceAlertOptions } from '../services/user-data';
import { useAuthContext } from './AuthContext';
import type { UserPriceAlert } from '../models/user-price-alert.interface';

interface PriceAlertsContextValue {
  alerts: UserPriceAlert[];
  byParfumId: Map<string, UserPriceAlert>;
  loading: boolean;
  setAlert: (parfumId: string, active: boolean, opts?: PriceAlertOptions) => Promise<void>;
}

const PriceAlertsContext = createContext<PriceAlertsContextValue | null>(null);

export function PriceAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
  const [alerts, setAlerts] = useState<UserPriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setAlerts([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onPriceAlerts(uid, (data) => { setAlerts(data); setLoading(false); });
    return unsub;
  }, [uid]);

  const byParfumId = useMemo(() => new Map(alerts.map(a => [a.parfumId, a])), [alerts]);

  const setAlert = useCallback(async (parfumId: string, active: boolean, opts?: PriceAlertOptions) => {
    if (!uid) return;
    await setPriceAlert(uid, parfumId, active, opts);
  }, [uid]);

  const value = useMemo<PriceAlertsContextValue>(() => ({
    alerts, byParfumId, loading, setAlert,
  }), [alerts, byParfumId, loading, setAlert]);

  return <PriceAlertsContext.Provider value={value}>{children}</PriceAlertsContext.Provider>;
}

export function usePriceAlertsContext(): PriceAlertsContextValue {
  const ctx = useContext(PriceAlertsContext);
  if (!ctx) throw new Error('usePriceAlertsContext must be used within PriceAlertsProvider');
  return ctx;
}
