// src/hooks/usePushPrimer.ts — Proposition des notifications push à un moment
// de valeur (1ère alerte prix activée), jamais au lancement.
// propose() : après une activation d'alerte — vérifie le flag primer + le
// statut OS ; si pertinent, ouvre le popup PermissionPrimer.
// accept() : prompt système puis enregistrement du token (+ réglage pushNotifs).

import { useCallback, useMemo, useState } from 'react';
import { hasSeenPrimer, markPrimerSeen } from '../utils/permission-primers';
import {
  getPushPermissionStatus,
  requestFcmPermission,
  registerPushToken,
} from '../services/push';
import { getUserSettings, updateUserSetting } from '../services/user-data';

export function usePushPrimer(uid: string | null) {
  const [visible, setVisible] = useState(false);

  const propose = useCallback(async () => {
    if (!uid) return;
    try {
      if (await hasSeenPrimer('push')) return;
      // Respect d'un retrait explicite : si l'utilisateur a désactivé les push
      // dans Settings/privacy-center, on ne le re-sollicite pas.
      const settings = await getUserSettings(uid);
      if (!settings.pushNotifs) {
        void markPrimerSeen('push');
        return;
      }
      const status = await getPushPermissionStatus();
      if (status === 'granted') {
        void markPrimerSeen('push');
        return;
      }
      setVisible(true);
    } catch { /* silencieux — l'alerte prix reste l'action principale */ }
  }, [uid]);

  const accept = useCallback(() => {
    setVisible(false);
    void markPrimerSeen('push');
    if (!uid) return;
    requestFcmPermission()
      .then(async (granted) => {
        if (!granted) return;
        await updateUserSetting(uid, 'pushNotifs', true).catch(() => {});
        await registerPushToken(uid);
      })
      .catch(() => {});
  }, [uid]);

  const decline = useCallback(() => {
    setVisible(false);
    void markPrimerSeen('push');
  }, []);

  return useMemo(
    () => ({ visible, propose, accept, decline }),
    [visible, propose, accept, decline],
  );
}
