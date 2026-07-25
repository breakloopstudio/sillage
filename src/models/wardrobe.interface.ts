// src/models/wardrobe.interface.ts

export interface WardrobeItem {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  ownership: 'have' | 'want' | 'had' | 'sample' | 'decant';
  rating: number | null;
  notes: string | null;
  shelfIds: string[];
  sizeMl: number | null;
  sotdCount: number;
  isSignature: boolean;
  longevity?: string | null;          // dénormalisé — filtre Tenue
  sillage?: string | null;            // dénormalisé — filtre Sillage
  seasonScores?: { spring?: number; summer?: number; fall?: number; winter?: number } | null; // dénormalisé, nettoyé — filtre Saison
  allNotes?: string[] | null;         // dénormalisé (tête+cœur+fond dédupliqués, lowercase) — recherche par note
  addedAt: Date;
  updatedAt: Date;
}

export interface Shelf {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  order: number;
  createdAt: Date;
}

export interface SotdEntry {
  parfumId: string;
  nom: string;
  marque: string;
  imageUrl: string | null;
}
