// Interface locale pour le résultat du scan IA
export interface ScanResult {
  marque: string | null;
  nom: string | null;
  volumeMl: number | null;
  typeParfum: string | null;
  confidence?: 'high' | 'low';
  alternatives?: string[];
}
