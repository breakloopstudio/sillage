// Offre d'un site partenaire — préparation du comparateur de prix.
export interface PriceOffer {
  marchand: string;      // nom du site partenaire
  prix: number;          // prix TTC en euros
  url: string;           // lien vers l'offre
  logoUrl?: string;      // logo du marchand
  volumeMl?: number;     // volume concerné par l'offre
}

// Modèle Parfum — collection Firestore 'parfums'
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
  createdAt: Date;
  updatedAt: Date;

  // --- Comparateur de prix ---
  bestPrice?: number;
  referencePrice?: number;
  offers?: PriceOffer[];

  // --- Métadonnées du catalogue (seed Firestore) ---
  source?: 'seed' | 'manual';
  cachedAt?: Date;
  imageVerified?: boolean;
  typeParfum?: string | null;
  searchKeywords?: string[];
  searchText?: string;          // Supabase : colonne générée (remplace searchKeywords pour le scoring client)
  purchaseUrl?: string | null;
  mainAccords?: string[];
  longevity?: string | null;
  sillage?: string | null;
  gender?: string | null;
  rating?: string | null;
  popularity?: string | null;
  popularityScore?: number;
  ratingScore?: number;
  reviewCount?: number;
  ratingCount?: number;
  priceValue?: string | null;
  country?: string;
  mainAccordsPercentage?: Record<string, string>;
  generalNotes?: string[];
  perfumers?: string[];
  confidence?: string;
  seasonRanking?: { name: string; score: number }[];
  occasionRanking?: { name: string; score: number }[];
  similarIds?: string[];
  similarIdsCachedAt?: Date;
}
