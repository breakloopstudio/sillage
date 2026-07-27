import { useState, useEffect, useCallback, useMemo } from 'react';
import { onPriceAlerts, setPriceAlert, type PriceAlertOptions } from '../services/user-data';
import type { UserPriceAlert } from '../models/user-price-alert.interface';

export function usePriceAlerts(uid: string | null) {
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

  return { alerts, byParfumId, loading, setAlert };
}
