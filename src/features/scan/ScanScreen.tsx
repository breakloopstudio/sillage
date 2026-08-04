// src/features/scan/ScanScreen.tsx — Orchestrateur scan avec caméra réelle
// Pipeline métier → useScanPipeline (testable)

import { useRef, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAuthContext } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../../hooks/useNetwork';
import { useScans } from '../../hooks/useScans';
import { useScanReducer } from '../../hooks/useScanReducer';
import { useScanPipeline } from '../../hooks/useScanPipeline';
import { setPendingCatalogQuery } from '../../services/catalog-bridge';
import type { ScanResult } from '../../models';
import { ScanIdle, type RecentScan } from './ScanIdle';
import { ScanCamera } from './ScanCamera';
import { ScanLoading } from './ScanLoading';
import { ScanClarify } from './ScanClarify';
import { ScanResults } from './ScanResults';
import { ScanCollectionResults } from './ScanCollectionResults';
import { ScanNoResult } from './ScanNoResult';
import { ScanError } from './ScanError';
import type { ScanMode } from './scanMode';
import PermissionPrimer from '../../components/PermissionPrimer';
import { usePermissionPrimer } from '../../hooks/usePermissionPrimer';
import { PERMISSION_PRIMERS } from '../../utils/permission-primers';

// 1280px : OCR d'étiquettes (detail high côté serveur), payload contenu par le JPEG
const MAX_IMAGE_WIDTH = 1280;
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
  const { t } = useTranslation('common');
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const { state, dispatch } = useScanReducer();
  const cameraPrimer = usePermissionPrimer('camera');

  const mountedRef = useRef(true);
  const lastBurstRef = useRef<string[] | null>(null);
  const lastModeRef = useRef<ScanMode>('single');
  const [scanMode, setScanMode] = useState<ScanMode>('single');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Pipeline métier : GPT-4o → recherche → résultats → historique
  const { startAnalysis, startCollectionAnalysis, cancelAnalysis } = useScanPipeline(dispatch, user?.uid ?? null, mountedRef);

  const launchAnalysis = useCallback((images: string[]) => {
    lastBurstRef.current = images;
    lastModeRef.current = scanMode;
    if (scanMode === 'collection') {
      startCollectionAnalysis({ image: images[0] });
    } else {
      startAnalysis({ images });
    }
  }, [scanMode, startAnalysis, startCollectionAnalysis]);

  // Scans récents réussis (vignettes sur l'idle)
  const { scans } = useScans(user?.uid ?? null);
  const recentScans = useMemo<RecentScan[]>(
    () => scans
      .filter((sc) => sc.status === 'success' && sc.parfumId)
      .slice(0, 3)
      .map((sc) => ({ parfumId: sc.parfumId!, nom: sc.nom, marque: sc.marque, imageUrl: sc.imageUrl })),
    [scans],
  );

  const guardOnline = useCallback((): boolean => {
    if (isOnline) return true;
    Alert.alert(t('scan.offlineTitle'), t('scan.offlineMessage'));
    return false;
  }, [isOnline, t]);

  // ─── Handlers UI ──────────────────────────────────────

  const reset = useCallback(() => {
    lastBurstRef.current = null;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const handleCancelScan = useCallback(() => {
    cancelAnalysis();
  }, [cancelAnalysis]);

  // Demande système (après primer le cas échéant) + gestion des refus.
  const requestCameraAndOpen = useCallback(async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        if (!r.canAskAgain) {
          Alert.alert(t('scan.cameraDisabledTitle'), t('scan.cameraDisabledMessage'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('openSettings'), onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert(t('scan.cameraNeededTitle'), t('scan.cameraNeededMessage'));
        }
        return;
      }
    }
    dispatch({ type: 'OPEN_CAMERA' });
  }, [permission, requestPermission, dispatch, t]);

  const handleOpenCamera = useCallback(async () => {
    if (!guardOnline()) return;
    if (!permission?.granted && cameraPrimer.needsPrimer) {
      cameraPrimer.open();
      return;
    }
    await requestCameraAndOpen();
  }, [permission, guardOnline, cameraPrimer, requestCameraAndOpen]);

  const handleCameraPrimerAccept = useCallback(() => {
    cameraPrimer.accept();
    void requestCameraAndOpen();
  }, [cameraPrimer, requestCameraAndOpen]);

  const handleCameraPrimerDecline = useCallback(() => {
    cameraPrimer.decline();
  }, [cameraPrimer]);

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
        Alert.alert(t('scan.errorTitle'), t('scan.processImageError'));
        return;
      }
      const images = [`data:image/jpeg;base64,${base64}`];
      launchAnalysis(images);
    } catch {
      Alert.alert(t('scan.errorTitle'), t('scan.galleryError'));
    }
  }, [launchAnalysis, guardOnline, t]);

  const handleCapture = useCallback((burstBase64: string[]) => {
    launchAnalysis(burstBase64);
  }, [launchAnalysis]);

  const handleClarify = useCallback(async (marque: string, nom: string, typeParfum: string | null, volumeMl: number | null) => {
    if (!guardOnline()) return;
    startAnalysis({
      scanResult: { marque: marque || null, nom: nom || null, typeParfum: typeParfum || null, volumeMl },
    });
  }, [startAnalysis, guardOnline]);

  const handleRetryAnalysis = useCallback(() => {
    if (!guardOnline()) return;
    const burst = lastBurstRef.current;
    if (burst && burst.length > 0) {
      if (lastModeRef.current === 'collection') {
        startCollectionAnalysis({ image: burst[0] });
      } else {
        startAnalysis({ images: burst });
      }
    } else {
      reset();
    }
  }, [reset, startAnalysis, startCollectionAnalysis, guardOnline]);

  const handleOpenCatalog = useCallback(() => {
    setPendingCatalogQuery(state.kind === 'results' ? (state.parfums[0]?.marque ?? '') : '');
    router.back();
  }, [router, state]);

  const handleSearchCatalog = useCallback((m: string) => {
    reset();
    setPendingCatalogQuery(m);
    router.back();
  }, [reset, router]);

  const handleOpenSearch = useCallback(() => {
    router.push('/search');
  }, [router]);

  const handleOpenRecent = useCallback((parfumId: string) => {
    router.push(`/catalog/${parfumId}`);
  }, [router]);

  const handleManual = useCallback(() => {
    dispatch({ type: 'OPEN_MANUAL' });
  }, [dispatch]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // ─── Rendu par état ────────────────────────────────────

  let view: ReactNode;
  switch (state.kind) {
    case 'idle':
      view = <ScanIdle isOnline={isOnline} onStartScan={handleOpenCamera} onOpenSearch={handleOpenSearch} onClose={handleClose} recentScans={recentScans} onOpenRecent={handleOpenRecent} mode={scanMode} onChangeMode={setScanMode} />;
      break;
    case 'camera':
      view = <ScanCamera onCapture={handleCapture} onCancel={() => dispatch({ type: 'CANCEL_CAMERA' })} onImportGallery={handleGalleryImport} idleHint={scanMode === 'collection' ? t('scan.cameraHintCollection') : undefined} />;
      break;
    case 'scanning':
      view = <ScanLoading onCancel={handleCancelScan} thumbnail={state.images?.[0]} />;
      break;
    case 'clarify':
      view = <ScanClarify scanResult={state.scanResult} reason={state.reason} onSearch={handleClarify} onRescan={handleOpenCamera} onReset={reset} />;
      break;
    case 'results':
      view = <ScanResults parfums={state.parfums} confidence={state.confidence} read={state.read} onOpenCatalog={handleOpenCatalog} onRescan={handleOpenCamera} />;
      break;
    case 'collection-results':
      view = <ScanCollectionResults matches={state.matches} estimatedCount={state.estimatedCount} onRescan={handleOpenCamera} onReset={reset} />;
      break;
    case 'no-result':
      view = <ScanNoResult marque={state.scanResult.marque} onSearchCatalog={handleSearchCatalog} onRescan={handleOpenCamera} onManual={handleManual} onReset={reset} />;
      break;
    case 'error':
      view = <ScanError message={state.message} onReset={reset} onRetryAnalysis={lastBurstRef.current ? handleRetryAnalysis : undefined} />;
      break;
  }

  // Le primer est monté à la racine (pas seulement à l'état idle) : le geste
  // « Rescanner » existe aussi dans clarify/results/no-result et doit pouvoir
  // ouvrir le popup si la permission caméra n'a jamais été demandée.
  return (
    <>
      {view}
      <PermissionPrimer
        visible={cameraPrimer.visible}
        copy={PERMISSION_PRIMERS.camera}
        onAccept={handleCameraPrimerAccept}
        onDecline={handleCameraPrimerDecline}
      />
    </>
  );
}
