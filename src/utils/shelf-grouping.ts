import type { Shelf, UserParfum } from '../models/user-parfum.interface';

export interface ShelfGroup {
  shelf: Shelf;
  items: UserParfum[];
}

export function groupItemsByShelf(items: UserParfum[], shelves: Shelf[]): ShelfGroup[] {
  return shelves.map((shelf) => ({
    shelf,
    items: items.filter((i) => i.shelfIds.includes(shelf.id)),
  }));
}

export function orphanItems(items: UserParfum[]): UserParfum[] {
  return items.filter((i) => i.shelfIds.length === 0);
}

export function signatureItems(items: UserParfum[]): UserParfum[] {
  return items.filter((i) => i.isSignature);
}

export function favoriteItems(items: UserParfum[], favIds: Set<string>): UserParfum[] {
  return items.filter((i) => favIds.has(i.parfumId));
}

export function hasShelfMatter(shelves: Shelf[], items: UserParfum[], favIds: Set<string>): boolean {
  if (shelves.length > 0) return true;
  return items.some((i) => i.isSignature || favIds.has(i.parfumId));
}

export function inspireMissing<T extends { parfumId: string }>(items: T[], myParfumIds: Set<string>): T[] {
  return items.filter((it) => !myParfumIds.has(it.parfumId));
}
