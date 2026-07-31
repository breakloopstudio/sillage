/**
 * Conversion moyenne pondérée des votes Fragrantica → label qualitatif.
 *
 * Les votes sont une distribution sur une échelle ordinale 1..N (1 = plus faible …
 * N = plus fort). `longevityAverage` / `sillageAverage` / `priceValueAverage` sont
 * des moyennes pondérées sur ces clés (cf. `weightedAvg` dans scrape-perfumes.ts).
 *
 * Règle : on arrondit la moyenne au niveau entier le plus proche — buckets centrés
 * sur les entiers, seuils à `x.5`. C'est le mapping le plus fidèle d'une moyenne
 * ordinale. Le bug historique (seuils entiers `< N` au lieu de `< N+0.5`) décalait
 * la longévité d'un cran vers le haut sur tout le catalogue.
 *
 * Partagé par import-fresh (import de nouveaux scrapes) et backfill-performance
 * (réparation de la base existante) — single source of truth des seuils.
 */

// Longévité : votes 1..5 (poor, weak, moderate, long lasting, eternal).
// L'historique en base n'a pas de "poor" → les deux niveaux bas fusionnent en "weak".
export function longevityString(avg: number | undefined | null): string | null {
  if (avg == null || avg <= 0) return null;
  if (avg < 2.5) return 'weak';
  if (avg < 3.5) return 'moderate';
  if (avg < 4.5) return 'long lasting';
  return 'eternal';
}

// Sillage : votes 1..4 (intimate, moderate, strong, enormous).
export function sillageString(avg: number | undefined | null): string | null {
  if (avg == null || avg <= 0) return null;
  if (avg < 1.5) return 'intimate';
  if (avg < 2.5) return 'moderate';
  if (avg < 3.5) return 'strong';
  return 'enormous';
}

// Price value : votes 1..5 (way overpriced … great value).
export function priceValueString(avg: number | undefined | null): string | null {
  if (avg == null || avg <= 0) return null;
  if (avg < 2.5) return 'overpriced';
  if (avg < 3.5) return 'fair';
  return 'deal';
}
