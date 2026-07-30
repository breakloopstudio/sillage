// src/utils/share.ts — URLs de partage (landing + deep links) & identité publique
// Pur (testable) — l'appel natif Share est fait côté UI.

import { env } from '../config/env';

export const APP_SCHEME = 'parfumscan';

function landingBase(): string {
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/share`;
}

// URLs landing (https) — ce qu'on partage. La page SSR porte les balises OG
// et les boutons « Ouvrir dans l'app » (deep link) / « Télécharger ».
export function parfumShareUrl(parfumId: string): string {
  return `${landingBase()}?type=parfum&id=${encodeURIComponent(parfumId)}`;
}

export function profileShareUrl(pseudo: string): string {
  return `${landingBase()}?type=profile&pseudo=${encodeURIComponent(pseudo)}`;
}

export function shelfShareUrl(pseudo: string, shelfId: string): string {
  return `${landingBase()}?type=shelf&pseudo=${encodeURIComponent(pseudo)}&shelf=${encodeURIComponent(shelfId)}`;
}

export function runnerShareUrl(score: number, pseudo?: string | null): string {
  const base = `${landingBase()}?type=runner&score=${encodeURIComponent(String(Math.floor(score)))}`;
  return pseudo ? `${base}&pseudo=${encodeURIComponent(pseudo)}` : base;
}

// Deep links — embarqués dans la page landing (ouverture de l'app installée).
export function parfumDeepLink(parfumId: string): string {
  return `${APP_SCHEME}://catalog/${encodeURIComponent(parfumId)}`;
}

export function profileDeepLink(pseudo: string): string {
  return `${APP_SCHEME}://u/${encodeURIComponent(pseudo)}`;
}

export function shelfDeepLink(pseudo: string, shelfId: string): string {
  return `${APP_SCHEME}://u/${encodeURIComponent(pseudo)}/shelf/${encodeURIComponent(shelfId)}`;
}

// ── Identité publique (pseudo) ──────────────────────────────────────────────
// Aligné sur la contrainte DB : ^[a-z0-9][a-z0-9_-]{1,18}[a-z0-9]$ (3-20 car.).
const PSEUDO_RE = /^[a-z0-9][a-z0-9_-]{1,18}[a-z0-9]$/;

export function isValidPseudo(pseudo: string): boolean {
  return PSEUDO_RE.test(pseudo);
}

/** Normalise la saisie : trim, minuscules, espaces → underscore, strip caractères invalides. */
export function normalizePseudo(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
}
