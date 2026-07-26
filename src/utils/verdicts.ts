import type { ScentVerdict } from '../models/user-parfum.interface';

export interface VerdictOption {
  key: ScentVerdict;
  label: string;
  icon: string;
  token: string;
}

export const VERDICT_OPTIONS: VerdictOption[] = [
  { key: 'love',    label: 'Coup de cœur',  icon: 'heart',          token: 'secondary' },
  { key: 'like',    label: 'J\'aime',       icon: 'thumbs-up',      token: 'deal' },
  { key: 'meh',     label: 'Mitigé',        icon: 'remove-outline', token: 'fair' },
  { key: 'dislike', label: 'Pas pour moi',  icon: 'thumbs-down',    token: 'primary' },
];

export function verdictLabel(v: ScentVerdict | null | undefined): string | null {
  if (!v) return null;
  return VERDICT_OPTIONS.find(o => o.key === v)?.label ?? null;
}
