export interface PriceDropResult {
  triggered: boolean;
  dropPct: number;
  dropAbs: number;
}

export function evaluatePriceDrop(lastPrice: number | null, currentPrice: number | null): PriceDropResult {
  if (lastPrice === null || currentPrice === null) {
    return { triggered: false, dropPct: 0, dropAbs: 0 };
  }
  const dropAbs = lastPrice - currentPrice;
  const dropPct = dropAbs / lastPrice;
  const triggered = dropPct >= 0.10 || dropAbs >= 5;
  return { triggered, dropPct, dropAbs };
}

export function priceAlertRunId(d: Date): string {
  const slot = Math.floor(d.getHours() / 6) * 6;
  return `pricealerts-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-H${slot}`;
}
