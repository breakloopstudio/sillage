// src/features/runner/runner-types.ts — Types, config, constantes du mini-jeu Flacon Runner
//
// NOTE design : le mini-jeu est une scène sombre immersive volontairement HORS thème
// (couleurs hardcodées violet/noir/doré, identiques en light et dark). Exception assumée
// au design-guide §2 — même logique que le fond lightbox §2.3 (`#0B0712`).
// `RUNNER_COLORS` ci-dessous est la palette de référence : les composants récents
// (RunnerHud) l'utilisent ; les hex historiques de RunnerGame restent à migrer.

export interface GameDimensions {
  width: number;
  height: number;
  groundY: number;
  bottleX: number;
}

export interface ObstacleDef {
  width: number;
  height: number;
  falling?: boolean;
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
  teal: '#2DD4BF',
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
export const MAX_SPEED = 660;
export const SPEED_INCREMENT_PER_POINT = 0.09;

// Game-feel : jump buffer (un tap posé juste avant l'atterrissage déclenche le saut
// au contact) + hit-stop (micro-freeze du monde à l'impact pour « sentir » le coup).
export const JUMP_BUFFER = 0.12;
export const HIT_STOP_DURATION = 0.06;

// Conversion px → « mètres » affichés (12 px = 1 mètre).
export const PX_PER_METER = 12;

// Mode Fièvre : une jauge se remplit (pickups + frôlés) ; pleine → invincibilité + score
// ×2 + éclats collectables pendant FEVER_DURATION. Pic de récompense rythmant le run.
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
  { width: 28, height: 40 },                  // 0 — éclat de flacon (sol)
  { width: 28, height: 56 },                  // 1 — éclat haut
  { width: 55, height: 28 },                  // 2 — éclat large
  { width: 33, height: 48 },                  // 3 — éclat moyen
  { width: 22, height: 26, falling: true },   // 4 — goutte d'essence (tombe, télégraphiée)
];

// Goutte d'essence : hauteur de départ, délai de télégraphie (ombre au sol) avant la
// chute, vitesse de chute. Dangereuse seulement une fois au sol (obstacle à sauter).
// NB : le spawn ne compense que la CHUTE (pas la télégraphie) pour que l'ombre reste
// visible ~0,3 s avant l'impact — voir useRunnerLoop.
export const DROP_START_HEIGHT = 240;
export const DROP_TELEGRAPH = 0.35;
export const DROP_FALL_SPEED = 1000;
export const DROP_MIN_SCORE = 800;

export const PICKUP_SIZE = 38;

export const PALETTE_INTERVAL = 800;

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
  const reduction = Math.min(score * 0.03, 120);
  const min = baseMin - reduction;
  const max = baseMax - reduction * 1.3;
  return Math.max(220, min + Math.random() * Math.max(40, max - min));
}

export function getPickupSpawnDistance(score: number): number {
  'worklet';
  const base = 500 + Math.random() * 400;
  return Math.max(320, base - score * 0.06);
}

export function getDoubleObstacleChance(score: number): number {
  'worklet';
  if (score < 500) return 0;
  if (score < 1000) return 0.1;
  if (score < 1500) return 0.2;
  if (score < 2000) return 0.28;
  return 0.35;
}

// Répartition des types d'obstacles selon le score : éclats (0-3) majoritaires,
// goutte d'essence (4) dès DROP_MIN_SCORE pts.
export function pickObstacleType(score: number): number {
  'worklet';
  const roll = Math.random();
  if (score > DROP_MIN_SCORE && roll < 0.15) return 4;
  return Math.floor(Math.random() * 4);
}

export function checkAABB(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  'worklet';
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
