// src/hooks/usePermissionPrimer.ts — Cycle de vie d'un primer de permission
// `needsPrimer` : le primer n'a jamais été vu (flag AsyncStorage).
// `open/accept/decline` : pilotage du popup PermissionPrimer.
// Après accept (ou déclin), le flag est posé — le prompt système part ensuite
// directement au geste suivant.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  hasSeenPrimer,
  markPrimerSeen,
  type PermissionPrimerKey,
} from '../utils/permission-primers';

export function usePermissionPrimer(key: PermissionPrimerKey) {
  // Fail-closed : tant que le flag n'est pas lu, on considère le primer comme
  // « à montrer » (needsPrimer=true). Un tap très rapide après le mount passe
  // alors par le primer au lieu de déclencher le prompt système à froid.
  // hasSeenPrimer retourne true en cas d'erreur AsyncStorage → pas de re-nag.
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    hasSeenPrimer(key)
      .then((v) => { if (alive) setSeen(v); })
      .catch(() => { if (alive) setSeen(true); });
    return () => { alive = false; };
  }, [key]);

  const needsPrimer = !seen;

  const open = useCallback(() => {
    setVisible(true);
  }, []);

  const accept = useCallback(() => {
    setVisible(false);
    setSeen(true);
    void markPrimerSeen(key);
  }, [key]);

  const decline = useCallback(() => {
    setVisible(false);
    setSeen(true);
    void markPrimerSeen(key);
  }, [key]);

  return useMemo(
    () => ({ needsPrimer, visible, open, accept, decline }),
    [needsPrimer, visible, open, accept, decline],
  );
}
