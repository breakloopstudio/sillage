// Offre d'un site partenaire — préparation du comparateur de prix.
export interface PriceOffer {
  marchand: string;      // nom du site partenaire
  prix: number;          // prix TTC en euros
  url: string;           // lien vers l'offre
  logoUrl?: string;      // logo du marchand
  volumeMl?: number;     // volume concerné par l'offre
}

// Modèle Parfum — table Postgres `parfums`
export interface Parfum {
  id: string;
  nom: string;
  marque: string;
  annee?: number;
  familleOlactive: string;
  notesTete: string[];
  notesCoeur: string[];
  notesFond: string[];
  imageUrl?: string;
  imageUrl2x?: string;
  createdAt: Date;
  updatedAt: Date;

  // --- Comparateur de prix ---
  bestPrice?: number;
  referencePrice?: number;
  offers?: PriceOffer[];

  // --- Métadonnées du catalogue ---
  source?: 'seed' | 'manual';
  cachedAt?: Date;
  typeParfum?: string | null;
  searchText?: string;
  purchaseUrl?: string | null;
  mainAccords?: string[];
  longevity?: string | null;
  sillage?: string | null;
  gender?: string | null;
  rating?: string | null;
  popularityScore?: number;
  ratingScore?: number;
  reviewCount?: number;
  ratingCount?: number;
  priceValue?: string | null;
  mainAccordsPercentage?: Record<string, string>;
  generalNotes?: string[];
  perfumers?: string[];
  seasonRanking?: { name: string; score: number }[];
  occasionRanking?: { name: string; score: number }[];
  similarIds?: string[];
  similarIdsCachedAt?: Date;
}
