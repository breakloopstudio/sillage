// Interface locale pour le résultat du scan IA
import type { Parfum } from './parfum.interface';

export type ScanFailureReason =
  | 'none'
  | 'blur'
  | 'glare'
  | 'label_unreadable'
  | 'bad_framing'
  | 'not_a_perfume';

export interface ScanResult {
  marque: string | null;
  nom: string | null;
  volumeMl: number | null;
  typeParfum: string | null;
  confidence?: 'high' | 'low';
  alternatives?: string[];
  // v3 : pertinence de l'image + raison d'échec (guidage du clarify)
  isPerfume?: boolean;
  failureReason?: ScanFailureReason;
  // v4 : source de l'identification (texte lu vs forme) + confirmation visuelle
  textRead?: boolean;
  visualMatch?: boolean;
}

// Mode collection (v6) : un flacon détecté parmi d'autres sur la même photo.
export interface CollectionDetection {
  textRead: boolean;
  marque: string | null;
  nom: string | null;
  typeParfum: string | null;
  confidence: 'high' | 'low';
  alternatives: string[];
  visualMatch?: boolean;
}

export interface CollectionScanResult {
  isCollection: boolean;
  estimatedCount: number;
  bottles: CollectionDetection[];
}

// Détection associée à son meilleur match catalogue (état collection-results).
export interface CollectionMatch {
  parfum: Parfum;
  confidence: 'high' | 'low';
  textRead: boolean;
  visualMatch: boolean;
}
