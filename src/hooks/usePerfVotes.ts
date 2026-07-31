// src/hooks/usePerfVotes.ts — État des votes utilisateurs d'un parfum
// (fetch parfum_perf + vote optimiste + refetch + fallback quand la RPC est indisponible).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getParfumPerf, castVote, type ParfumPerf, type PerfVoteDimension } from '../services/perf-votes';
import { useAuthContext } from '../contexts/AuthContext';
import type { SeasonKey } from '../utils/season';

export interface UsePerfVotes {
  perf: ParfumPerf | null;
  /** true si la RPC répond (fusion dispo). false → retomber sur les données brutes (strings). */
  available: boolean;
  loading: boolean;
  /** Vote / change / retire (value null). Optimiste + refetch. false si non connecté ou échec. */
  vote: (dimension: PerfVoteDimension, value: string | null) => Promise<boolean>;
  removeVote: (dimension: PerfVoteDimension) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePerfVotes(parfumId: string | null): UsePerfVotes {
  const { user } = useAuthContext();
  const userId = user?.uid ?? null;
  const [perf, setPerf] = useState<ParfumPerf | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  // Miroirs ref pour le focus-effect (évite les closures périmées + double-fetch au mount).
  const availableRef = useRef(false);
  const initialDoneRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPerf(null);
    setAvailable(false);
    availableRef.current = false;
    initialDoneRef.current = false;
    if (!parfumId) return;
    setLoading(true);
    void (async () => {
      const p = await getParfumPerf(parfumId, userId);
      if (cancelled || !mountedRef.current) return;
      setPerf(p);
      setAvailable(p !== null);
      availableRef.current = p !== null;
      setLoading(false);
      initialDoneRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [parfumId, userId]);

  const refresh = useCallback(async () => {
    if (!parfumId) return;
    const p = await getParfumPerf(parfumId, userId);
    if (!mountedRef.current) return;
    setPerf(p);
    setAvailable(p !== null);
    availableRef.current = p !== null;
  }, [parfumId, userId]);

  // Auto-réparation : si la RPC était indisponible au mount (écran ouvert avant le
  // déploiement de la migration), `available` restait false pour toujours et le vote
  // devenait inopérant. On retente au focus une fois le chargement initial terminé —
  // sans double-fetch quand tout fonctionne (available déjà true).
  useFocusEffect(
    useCallback(() => {
      if (initialDoneRef.current && !availableRef.current) {
        void refresh();
      }
    }, [refresh]),
  );

  const vote = useCallback(
    async (dimension: PerfVoteDimension, value: string | null): Promise<boolean> => {
      if (!parfumId || !userId) return false;
      // Optimiste : marque le vote localement avant la réponse (refetch corrigera).
      setPerf(prev => (prev ? optimisticMyVote(prev, dimension, value) : prev));
      const ok = await castVote(parfumId, dimension, value);
      if (ok) await refresh();
      return ok;
    },
    [parfumId, userId, refresh],
  );

  const removeVote = useCallback((dimension: PerfVoteDimension) => vote(dimension, null), [vote]);

  return { perf, available, loading, vote, removeVote, refresh };
}

/** Patch optimiste du champ myVote + compteur communauté, avant le refetch. */
function optimisticMyVote(prev: ParfumPerf, dimension: PerfVoteDimension, value: string | null): ParfumPerf {
  if (dimension === 'longevity' || dimension === 'sillage') {
    const dim = prev[dimension];
    const hadVote = dim.myVote !== null;
    const userVotes = Math.max(0, dim.userVotes + (value === null ? (hadVote ? -1 : 0) : hadVote ? 0 : 1));
    return { ...prev, [dimension]: { ...dim, myVote: value === null ? null : Number(value), userVotes } };
  }
  // moment (jour/nuit) — dimension distincte de season (migration 0044).
  if (dimension === 'moment') {
    const hadVote = prev.myMoment !== null;
    const seasonUserVotes = Math.max(0, prev.seasonUserVotes + (value === null ? (hadVote ? -1 : 0) : hadVote ? 0 : 1));
    return { ...prev, myMoment: value === null ? null : (value as 'day' | 'night'), seasonUserVotes };
  }
  // season (printemps/été/automne/hiver)
  const hadVote = prev.mySeason !== null;
  const seasonUserVotes = Math.max(0, prev.seasonUserVotes + (value === null ? (hadVote ? -1 : 0) : hadVote ? 0 : 1));
  return { ...prev, mySeason: value === null ? null : (value as SeasonKey), seasonUserVotes };
}
