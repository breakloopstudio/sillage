// src/features/scan/ScanScreen.tsx — Orchestrateur scan avec caméra réelle
// Pipeline métier → useScanPipeline (testable)

import { useRef, useEffect, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAuthContext } from '../../contexts/AuthContext';
import { useNetwork } from '../../hooks/useNetwork';
import { useScanReducer } from '../../hooks/useScanReducer';
import { useScanPipeline } from '../../hooks/useScanPipeline';
import { setPendingCatalogQuery } from '../../services/catalog-bridge';
import type { ScanResult } from '../../models';
import { ScanIdle } from './ScanIdle';
import { ScanCamera } from './ScanCamera';
import { ScanLoading } from './ScanLoading';
import { ScanClarify } from './ScanClarify';
import { ScanResults } from './ScanResults';
import { ScanNoResult } from './ScanNoResult';
import { ScanError } from './ScanError';

const MAX_IMAGE_WIDTH = 1024;
const IMAGE_QUALITY = 0.6;

async function resizeToBase64(uri: string): Promise<string | null> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_WIDTH } }],
    { compress: IMAGE_QUALITY, base64: true, format: SaveFormat.JPEG },
  );
  return result.base64 ?? null;
}

export function ScanScreen() {
  const { user } = useAuthContext();
  const { isOnline } = useNetwork();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const { state, dispatch } = useScanReducer();

  const mountedRef = useRef(true);
  const lastBurstRef = useRef<string[] | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Pipeline métier : GPT-4o → recherche → résultats → historique
  const { startAnalysis, cancelAnalysis } = useScanPipeline(dispatch, user?.uid ?? null, mountedRef);

  const guardOnline = useCallback((): boolean => {
    if (isOnline) return true;
    Alert.alert('Hors-ligne', 'Le scan nécessite une connexion internet. Réessaie quand tu es connecté.');
    return false;
  }, [isOnline]);

  // ─── Handlers UI ──────────────────────────────────────

  const reset = useCallback(() => {
    lastBurstRef.current = null;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const handleCancelScan = useCallback(() => {
    cancelAnalysis();
  }, [cancelAnalysis]);

  const handleOpenCamera = useCallback(async () => {
    if (!guardOnline()) return;
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        if (!r.canAskAgain) {
          Alert.alert('Permission refusée', 'Activez la caméra dans les réglages de l\'appareil.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Réglages', onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert('Permission refusée', 'La caméra est nécessaire pour scanner un flacon.');
        }
        return;
      }
    }
    dispatch({ type: 'OPEN_CAMERA' });
  }, [permission, requestPermission, dispatch]);

  const handleGalleryImport = useCallback(async () => {
    if (!guardOnline()) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: IMAGE_QUALITY,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const base64 = await resizeToBase64(result.assets[0].uri);
      if (!base64) {
        Alert.alert('Erreur', 'Impossible de traiter cette image.');
        return;
      }
      const images = [`data:image/jpeg;base64,${base64}`];
      lastBurstRef.current = images;
      startAnalysis({ images });
    } catch {
      Alert.alert('Erreur', "Impossible d'accéder à la galerie.");
    }
  }, [startAnalysis]);

  const handleCapture = useCallback((burstBase64: string[]) => {
    lastBurstRef.current = burstBase64;
    startAnalysis({ images: burstBase64 });
  }, [startAnalysis]);

  const handleClarify = useCallback(async (marque: string, nom: string, typeParfum: string | null, volumeMl: number | null) => {
    if (!guardOnline()) return;
    startAnalysis({
      scanResult: { marque: marque || null, nom: nom || null, typeParfum: typeParfum || null, volumeMl },
    });
  }, [startAnalysis]);

  const handleRetryAnalysis = useCallback(() => {
    if (!guardOnline()) return;
    const burst = lastBurstRef.current;
    if (burst && burst.length > 0) {
      startAnalysis({ images: burst });
    } else {
      reset();
    }
  }, [reset, startAnalysis]);

  const handleOpenCatalog = useCallback(() => {
    setPendingCatalogQuery(state.kind === 'results' ? (state.parfums[0]?.marque ?? '') : '');
    router.back();
  }, [router, state]);

  const handleSearchCatalog = useCallback((m: string) => {
    reset();
    setPendingCatalogQuery(m);
    router.back();
  }, [reset, router]);

  // ─── Rendu par état ────────────────────────────────────

  switch (state.kind) {
    case 'idle':
      return <ScanIdle isOnline={isOnline} onStartScan={handleOpenCamera} onImportGallery={handleGalleryImport} onOpenManual={() => dispatch({ type: 'OPEN_MANUAL' })} />;
    case 'camera':
      return <ScanCamera onCapture={handleCapture} onCancel={() => dispatch({ type: 'CANCEL_CAMERA' })} />;
    case 'scanning':
      return <ScanLoading onCancel={handleCancelScan} />;
    case 'clarify':
      return <ScanClarify scanResult={state.scanResult} reason={state.reason} onSearch={handleClarify} onReset={reset} />;
    case 'results':
      return <ScanResults parfums={state.parfums} onOpenCatalog={handleOpenCatalog} />;
    case 'no-result':
      return <ScanNoResult marque={state.scanResult.marque} onSearchCatalog={handleSearchCatalog} onReset={reset} />;
    case 'error':
      return <ScanError message={state.message} onReset={reset} onRetryAnalysis={lastBurstRef.current ? handleRetryAnalysis : undefined} />;
  }
}
