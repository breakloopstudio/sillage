import type { UserParfumStatus } from '../models/user-parfum.interface';

export type StatusChipId = 'to_try' | 'have' | 'had';

export interface StatusChip {
  id: StatusChipId;
  label: string;
  icon: string;
  status: UserParfumStatus;
}

export const STATUS_CHIPS: StatusChip[] = [
  { id: 'to_try', label: 'À sentir',   icon: 'eyedrop-outline',        status: 'to_try' },
  { id: 'have',   label: 'Je l\u2019ai', icon: 'checkmark-circle-outline', status: 'have' },
  { id: 'had',    label: 'Je l\u2019ai eu', icon: 'flag-outline',           status: 'had' },
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
