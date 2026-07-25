// Sous-collection 'users/{uid}/favoris'
export interface UserFavori {
  id: string;
  parfumId: string;
  addedAt: Date;
  nom?: string;           // dénormalisé pour résilience
  marque?: string;        // dénormalisé pour résilience
  imageUrl?: string;      // dénormalisé pour affichage sans appel API
  familleOlactive?: string; // dénormalisé pour affichage sans appel API
  bestPrice?: number;     // dénormalisé pour badge promo sans appel Firestore
  referencePrice?: number; // dénormalisé pour calcul du % de remise
  annee?: number;         // dénormalisé pour chip année
  longevity?: string | null;          // dénormalisé — filtre Tenue
  sillage?: string | null;            // dénormalisé — filtre Sillage
  seasonScores?: { spring?: number; summer?: number; fall?: number; winter?: number } | null; // dénormalisé, nettoyé — filtre Saison
  notes?: string[] | null;            // dénormalisé (tête+cœur+fond dédupliqués, lowercase) — recherche par note
}
