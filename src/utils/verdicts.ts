// src/utils/verdicts.ts — Options de verdict (labels résolus via i18next à l'affichage, §23)

import i18next from 'i18next';
import type { ScentVerdict } from '../models/user-parfum.interface';

export interface VerdictOption {
  key: ScentVerdict;
  label: string;
  icon: string;
  token: string;
}

export const VERDICT_OPTIONS: VerdictOption[] = [
  { key: 'love',    get label() { return i18next.t('verdicts.love'); },    icon: 'heart',          token: 'secondary' },
  { key: 'like',    get label() { return i18next.t('verdicts.like'); },    icon: 'thumbs-up',      token: 'deal' },
  { key: 'meh',     get label() { return i18next.t('verdicts.meh'); },     icon: 'remove-outline', token: 'fair' },
  { key: 'dislike', get label() { return i18next.t('verdicts.dislike'); }, icon: 'thumbs-down',    token: 'primary' },
];

export function verdictLabel(v: ScentVerdict | null | undefined): string | null {
  if (!v) return null;
  return VERDICT_OPTIONS.find(o => o.key === v)?.label ?? null;
}
