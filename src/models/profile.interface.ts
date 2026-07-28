// src/models/profile.interface.ts — Profils publics (communauté Phase 1)

import type { UserParfumStatus, ScentVerdict } from './user-parfum.interface';

/** Mon profil (lecture/écriture owner) — table `profiles`. */
export interface MyProfile {
  pseudo: string;
  avatarUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  createdAt: Date;
}

/** Profil public d'un membre (RPC `public_profile`). */
export interface PublicProfile {
  pseudo: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  collectionCount: number;
  followerCount: number;
  followingCount: number;
}

/** Item de la collection publique (RPC `public_collection`) — notes perso exclues. */
export interface PublicCollectionItem {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  status: UserParfumStatus;
  verdict: ScentVerdict | null;
  rating: number | null;
  bestPrice?: number;
  addedAt: Date;
}

/** En-tête d'une étagère publique (RPC `public_shelf`) — profil + étagère publics. */
export interface PublicShelf {
  shelfId: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  itemCount: number;
  pseudo: string;
  avatarUrl: string | null;
  bio: string | null;
}

/** Flacon d'une étagère publique (RPC `public_shelf_items`) — notes perso exclues. */
export interface PublicShelfItem {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  bestPrice?: number;
}
