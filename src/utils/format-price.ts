const fmt2 = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt0 = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatPrice(value: number, opts?: { decimals?: number }): string {
  if (!Number.isFinite(value)) return '— €';
  const decimals = opts?.decimals ?? 2;
  return decimals === 0 ? fmt0.format(value) : fmt2.format(value);
}
