export type UserParfumStatus = 'to_try' | 'tried' | 'want' | 'have' | 'had';
export type ScentVerdict = 'love' | 'like' | 'meh' | 'dislike';
export type PossessionType = 'bottle' | 'decant' | 'sample';

export interface UserParfum {
  parfumId: string;
  status: UserParfumStatus;
  verdict: ScentVerdict | null;
  rating: number | null;
  notes: string | null;
  triedAt: Date | null;
  shelfIds: string[];
  sotdCount: number;
  isSignature: boolean;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  bestPrice?: number;
  referencePrice?: number;
  longevity?: string | null;
  sillage?: string | null;
  seasonScores?: { spring?: number; summer?: number; fall?: number; winter?: number } | null;
  allNotes?: string[] | null;
  addedAt: Date;
  updatedAt: Date;
}

export interface Possession {
  id: string;
  parfumId: string;
  type: PossessionType;
  sizeMl: number | null;
  quantity: number;
  forSale: boolean;
  notes: string | null;
  addedAt: Date;
}

export interface Shelf {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  isPublic: boolean;
  order: number;
  createdAt: Date;
}

/** Position + épinglage d'un flacon DANS une étagère (table `shelf_items`). */
export interface ShelfItem {
  shelfId: string;
  parfumId: string;
  position: number;
  pinned: boolean;
  addedAt: Date;
}

export interface SotdEntry {
  parfumId: string;
  nom: string;
  marque: string;
  imageUrl: string | null;
}
