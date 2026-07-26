// supabase/functions/_shared/helpers.ts — Utilitaires (logique météo/géo/prix)

export function coordsKey(lat: number, lon: number): string {
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

export function weatherRunId(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `weather-${y}-${m}-${day}`;
}

export function priceAlertRunId(d: Date): string {
  const slot = Math.floor(d.getHours() / 6) * 6;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `pricealerts-${y}-${m}-${day}-H${slot}`;
}

export interface PriceDropResult {
  triggered: boolean;
  dropPct: number;
  dropAbs: number;
}

export function evaluatePriceDrop(lastPrice: number | null, currentPrice: number | null): PriceDropResult {
  if (lastPrice === null || currentPrice === null || lastPrice <= 0 || currentPrice <= 0) return { triggered: false, dropPct: 0, dropAbs: 0 };
  const dropAbs = lastPrice - currentPrice;
  const dropPct = dropAbs / lastPrice;
  return { triggered: dropPct >= 0.10 || dropAbs >= 5, dropPct, dropAbs };
}
