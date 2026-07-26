// src/services/impl/search-shared.ts
// Helpers partagés par les deux implémentations catalogue (Firebase + Supabase) :
// SearchError, cache LRU de recherche, dédoublonnage marque+nom, shuffle seedé.

import type { Parfum } from '../../models';
import { normalize } from '../../utils/normalize';

export class SearchError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SearchError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export type CacheEntry = { results: Parfum[]; cachedAt: number };

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class LRUCache {
  private map = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.cachedAt > CACHE_TTL_MS;
  }

  get(key: string): Parfum[] | undefined {
    const entry = this.map.get(key);
    if (entry === undefined) return undefined;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.results;
  }

  set(key: string, value: Parfum[]): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, { results: value, cachedAt: Date.now() });
  }

  entries(): IterableIterator<[string, Parfum[]]> {
    const valid: [string, Parfum[]][] = [];
    for (const [key, entry] of this.map.entries()) {
      if (!this.isExpired(entry)) {
        valid.push([key, entry.results]);
      } else {
        this.map.delete(key);
      }
    }
    return valid[Symbol.iterator]();
  }

  clear(): void {
    this.map.clear();
  }
}

/** Dédoublonnage par marque+nom normalisé (garde le 1er = meilleur score). */
export function dedupByMarqueNom<T extends { marque: string; nom: string }>(items: T[]): T[] {
  try {
    const seen = new Set<string>();
    return items.filter((item) => {
      const m = item?.marque ?? '';
      const n = item?.nom ?? '';
      const key = `${normalize(m)}_${normalize(n)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return items;
  }
}

