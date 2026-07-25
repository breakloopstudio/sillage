export type ScentVerdict = 'love' | 'like' | 'meh' | 'dislike';

export interface UserScentItem {
  id: string;
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  status: 'to_try' | 'tried';
  verdict: ScentVerdict | null;
  rating: number | null;
  notes: string | null;
  triedAt: Date | null;
  bestPrice?: number;
  referencePrice?: number;
  addedAt: Date;
  updatedAt: Date;
}
