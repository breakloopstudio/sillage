// src/models/user-price-alert.interface.ts — Alerte prix (table price_alerts)

export interface UserPriceAlert {
  parfumId: string;
  /** Seuil custom (« préviens-moi sous X € »). null = logique baisse ≥ 10% / ≥ 5€. */
  targetPrice: number | null;
  /** Prix au moment de l'activation — ancre pour « −X% depuis l'alerte ». */
  initialPrice: number | null;
  /** Prix au dernier contrôle (écrasé à chaque run du cron). */
  lastPrice: number | null;
  lastChecked: Date | null;
  addedAt: Date;
}
