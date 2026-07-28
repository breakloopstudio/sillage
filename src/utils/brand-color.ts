export const BRAND_PALETTE = ['#5B21B6', '#1E40AF', '#065F46', '#92400E', '#991B1B', '#9D174D', '#3730A3', '#854D0E'];

export function brandColor(brand: string): string {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
  return BRAND_PALETTE[Math.abs(hash) % BRAND_PALETTE.length];
}
