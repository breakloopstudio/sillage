// Interface locale pour le résultat du scan IA
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
