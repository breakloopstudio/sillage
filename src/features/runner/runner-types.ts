// src/features/runner/runner-types.ts — Types, config, constantes du mini-jeu Flacon Runner
//
// NOTE design : le mini-jeu est une scène sombre immersive volontairement HORS thème
// (couleurs hardcodées violet/noir/doré, identiques en light et dark). Exception assumée
// au design-guide §2 — même logique que le fond lightbox §2.3 (`#0B0712`). Les couleurs
// sont regroupées dans RUNNER_COLORS ci-dessous pour éviter la dispersion.

export interface GameDimensions {
  width: number;
  height: number;
  groundY: number;
  bottleX: number;
}

export interface ObstacleDef {
  width: number;
  height: number;
  airborne?: boolean;
}

export interface PickupDef {
  key: string;
  label: string;
  emoji: string;
  color: string;
  power: PowerType;
  altitude: 'low' | 'medium' | 'high' | 'very_high';
  scoreBonus: number;
}

export type PowerType = 'magnet' | 'shield' | 'double' | 'slow';

export type GameStateValue = 'idle' | 'playing' | 'paused' | 'dying' | 'gameover';

// Palette centralisée de la scène (hors thème, cf. note d'en-tête).
export const RUNNER_COLORS = {
  bg: '#0B0712',
  gold: '#D4A960',
  violet: '#8B6CF6',
  violetDeep: '#6C3ED9',
  textLight: '#EDE8F5',
  muted: '#988EA8',
  mutedDim: '#4A4358',
  ink: '#1F1A2E',
  surface: '#15101E',
} as const;

export const GRAVITY = 1850;
export const JUMP_VELOCITY = -720;
export const DOUBLE_JUMP_VELOCITY = -610;
export const BASE_SPEED = 300;
export const MAX_SPEED = 780;
export const SPEED_INCREMENT_PER_POINT = 0.12;

// Game-feel : jump buffer (un tap posé juste avant l'atterrissage déclenche le saut
// au contact) + hit-stop (micro-freeze du monde à l'impact pour « sentir » le coup).
export const JUMP_BUFFER = 0.12;
export const HIT_STOP_DURATION = 0.06;

// Conversion px → « mètres » affichés (12 px = 1 mètre).
export const PX_PER_METER = 12;

// Glissade (« Sillage ») : swipe bas = le flacon se couche, hitbox réduite en hauteur
// pour passer sous les cristaux volants. Deuxième dimension de jeu (sauter OU glisser).
export const DUCK_DURATION = 0.6;
export const DUCK_HEIGHT = 26;
export const DUCK_SCALE = 0.55;

// Mode Fièvre : une jauge se remplit (pickups + frôlés) ; pleine → invincibilité + score
// ×2 + cristaux collectables pendant FEVER_DURATION. Pic de récompense rythmant le run.
export const FEVER_DURATION = 4.5;
export const FEVER_MAX = 100;
export const FEVER_GAIN_PICKUP = 20;
export const FEVER_GAIN_NEARMISS = 8;
export const FEVER_SCORE_MULT = 2;

export const BOTTLE_WIDTH = 30;
export const BOTTLE_HEIGHT = 56;

export const OBSTACLE_POOL_SIZE = 8;
export const PICKUP_POOL_SIZE = 4;

export const OBSTACLE_DEFS: ObstacleDef[] = [
  { width: 28, height: 40 },
  { width: 28, height: 56 },
  { width: 55, height: 28 },
  { width: 33, height: 48 },
  { width: 50, height: 20, airborne: true },
];

export const FLYING_OBSTACLE_Y_OFFSET = 110;
export const FLYING_OBSTACLE_MIN_SCORE = 300;

export const PICKUP_SIZE = 38;

export const PALETTE_INTERVAL = 800;

export const RUNNER_PHASES = [
  { label: 'Boisée', emoji: '🌲' },
  { label: 'Florale', emoji: '🌸' },
  { label: 'Hespéridée', emoji: '🍋' },
  { label: 'Ambrée', emoji: '🔥' },
] as const;

export const PALETTES = [
  { crystal: '#1D1728', crystal2: '#221930', crystal3: '#2A2238', crystal4: '#1A1420', bottle: '#6C3ED9', cap: '#D4A960' },
  { crystal: '#1A1525', crystal2: '#1F1035', crystal3: '#26183D', crystal4: '#150D22', bottle: '#5B21B6', cap: '#C8945A' },
  { crystal: '#151028', crystal2: '#1A0E38', crystal3: '#201440', crystal4: '#100A20', bottle: '#4C1D95', cap: '#B8860B' },
  { crystal: '#120D22', crystal2: '#160C32', crystal3: '#1C1238', crystal4: '#0E0818', bottle: '#7C3AED', cap: '#F59E0B' },
] as const;

export const SPEED_LINE_MIN_SPEED = 450;
export const SPEED_LINE_COUNT = 3;

export const OBSTACLE_HITBOX_INSET = 4;
export const BOTTLE_HITBOX_INSET_TOP = 6;
export const BOTTLE_HITBOX_INSET_SIDE = 4;

export const NEAR_MISS_GAP = 30;
export const NEAR_MISS_BONUS = 10;
export const MAX_COMBO = 4;

export const MAX_LIVES = 3;
export const INVULN_DURATION = 1.2;

// Distance (px) sur laquelle un objet qui entre par la droite se révèle en fondu,
// à taille constante — donne la sensation de glisser depuis la droite (pas de zoom).
export const SPAWN_ENTRY_DISTANCE = 140;

export const PICKUP_DEFS: PickupDef[] = [
  { key: 'bergamote', label: 'Bergamote', emoji: '🍊', color: '#B5C334', power: 'magnet', altitude: 'low', scoreBonus: 25 },
  { key: 'santal', label: 'Santal', emoji: '🪵', color: '#A9744F', power: 'shield', altitude: 'medium', scoreBonus: 50 },
  { key: 'ambre', label: 'Ambre', emoji: '✨', color: '#E8933A', power: 'double', altitude: 'high', scoreBonus: 100 },
  { key: 'musc', label: 'Musc', emoji: '🌙', color: '#9A8FC0', power: 'slow', altitude: 'very_high', scoreBonus: 200 },
];

export const POWER_DURATION: Record<PowerType, number> = { magnet: 5, shield: 0, double: 8, slow: 3 };
export const SLOW_FACTOR = 0.45;
export const MAGNET_RADIUS = 240;

export function getSpawnDistance(score: number): number {
  'worklet';
  const baseMin = 300;
  const baseMax = 450;
  const reduction = Math.min(score * 0.04, 150);
  const min = baseMin - reduction;
  const max = baseMax - reduction * 1.3;
  return Math.max(180, min + Math.random() * Math.max(40, max - min));
}

export function getPickupSpawnDistance(score: number): number {
  'worklet';
  const base = 600 + Math.random() * 500;
  return Math.max(350, base - score * 0.06);
}

export function getDoubleObstacleChance(score: number): number {
  'worklet';
  if (score < 500) return 0;
  if (score < 1000) return 0.15;
  if (score < 1500) return 0.3;
  if (score < 2000) return 0.45;
  return 0.55;
}

export function checkAABB(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  'worklet';
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
