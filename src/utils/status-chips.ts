// src/utils/status-chips.ts — Modèle 3 chips de statut (labels résolus via i18next à l'affichage, §23)

import i18next from 'i18next';
import type { UserParfumStatus } from '../models/user-parfum.interface';

export type StatusChipId = 'to_try' | 'have' | 'had';

export interface StatusChip {
  id: StatusChipId;
  label: string;
  icon: string;
  status: UserParfumStatus;
}

export const STATUS_CHIPS: StatusChip[] = [
  { id: 'to_try', get label() { return i18next.t('status.to_try'); }, icon: 'eye-outline',                status: 'to_try' },
  { id: 'have',   get label() { return i18next.t('status.have'); },   icon: 'checkmark-circle-outline',   status: 'have' },
  { id: 'had',    get label() { return i18next.t('status.had'); },    icon: 'archive-outline',            status: 'had' },
];

export function chipForStatus(status: UserParfumStatus | null | undefined): StatusChipId | null {
  switch (status) {
    case 'have': return 'have';
    case 'had': return 'had';
    case 'to_try':
    case 'want':
    case 'tried': return 'to_try';
    default: return null;
  }
}

export function statusChipMeta(status: UserParfumStatus | null | undefined): StatusChip | null {
  const id = chipForStatus(status);
  if (!id) return null;
  return STATUS_CHIPS.find(c => c.id === id) ?? null;
}
