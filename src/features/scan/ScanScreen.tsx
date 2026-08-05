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
import { useScanReducer, COLLECTION_MAX_PHOTOS } from '../../hooks/useScanReducer';
import { useScanPipeline } from '../../hooks/useScanPipeline';
import { setPendingCatalogQuery } from '../../services/catalog-bridge';
import type { ScanResult } from '../../models';
import { ScanIdle, type RecentScan } from './ScanIdle';
import { ScanCamera } from './ScanCamera';
import { ScanLoading } from './ScanLoading';
import { ScanClarify } from './ScanClarify';
import { ScanResults } from './ScanResults';
import { ScanCollectionResults } from './ScanCollectionResults';
import { ScanCollectionStaging } from './ScanCollectionStaging';
import { ScanNoResult } from './ScanNoResult';
import { ScanError } from './ScanError';
import type { ScanMode } from './scanMode';
import PermissionPrimer from '../../components/PermissionPrimer';
import { usePermissionPrimer } from '../../hooks/usePermissionPrimer';
import { PERMISSION_PRIMERS } from '../../utils/permission-primers';

// 1280px : OCR d'étiquettes (detail high côté serveur), payload contenu par le JPEG
const MAX_IMAGE_WIDTH = 1280;
const IMAGE_QUALITY = 0.6;
// Re-compression après resize : 0.8 — re-compresser à 0.6 une image déjà compressée
// dégrade les étiquettes ; le poids reste sous le plafond serveur (5 Mo/image).
const REENCODE_QUALITY = 0.8;
// Galerie en mode collection : qualité supérieure (sections de 3-4 flacons).
const GALLERY_QUALITY_COLLECTION = 0.8;

async function resizeToBase64(uri: string): Promise<string | null> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_WIDTH } }],
    { compress: REENCODE_QUALITY, base64: true, format: SaveFormat.JPEG },
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

  // Flacon unique → analyse immédiate ; collection → STAGING (l'utilisateur ajoute
  // 1-4 photos de sections avant de lancer l'analyse sur l'ensemble).
  const launchAnalysis = useCallback((images: string[]) => {
    if (scanMode === 'collection') {
      dispatch({ type: 'COLLECTION_ADD_PHOTOS', images });
    } else {
      lastBurstRef.current = images;
      lastModeRef.current = 'single';
      startAnalysis({ images });
    }
  }, [scanMode, dispatch, startAnalysis]);

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

  const handleAnalyzeStaging = useCallback((images: string[]) => {
    if (!guardOnline()) return;
    lastBurstRef.current = images;
    lastModeRef.current = 'collection';
    startCollectionAnalysis({ images });
  }, [guardOnline, startCollectionAnalysis]);

  // ─── Handlers UI ──────────────────────────────────────

  const reset = useCallback(() => {
    lastBurstRef.current = null;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const handleCancelScan = useCallback(() => {
    cancelAnalysis();
    // Annuler une analyse collection ramène au STAGING (les photos de sections
    // sont coûteuses à prendre — on ne les jette pas).
    if (lastModeRef.current === 'collection' && lastBurstRef.current && lastBurstRef.current.length > 0) {
      dispatch({ type: 'COLLECTION_ADD_PHOTOS', images: lastBurstRef.current });
    }
  }, [cancelAnalysis, dispatch]);

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
    const collection = scanMode === 'collection';
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: collection ? GALLERY_QUALITY_COLLECTION : IMAGE_QUALITY,
        allowsMultipleSelection: collection,
        selectionLimit: collection ? COLLECTION_MAX_PHOTOS : 1,
      });
      if (result.canceled || !result.assets?.length) return;
      const resized = await Promise.all(result.assets.map((a) => resizeToBase64(a.uri)));
      const images = resized
        .filter((b): b is string => b !== null)
        .map((b) => `data:image/jpeg;base64,${b}`);
      if (images.length === 0) {
        Alert.alert(t('scan.errorTitle'), t('scan.processImageError'));
        return;
      }
      launchAnalysis(images);
    } catch {
      Alert.alert(t('scan.errorTitle'), t('scan.galleryError'));
    }
  }, [launchAnalysis, guardOnline, scanMode, t]);

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
        startCollectionAnalysis({ images: burst });
      } else {
        startAnalysis({ images: burst });
      }
    } else {
      reset();
    }
  }, [reset, startAnalysis, startCollectionAnalysis, guardOnline]);

  // Staging collection : ajouter une section (rouvre la caméra), retirer une photo.
  const handleAddSection = useCallback(() => {
    void handleOpenCamera();
  }, [handleOpenCamera]);

  const handleRemovePhoto = useCallback((index: number) => {
    dispatch({ type: 'COLLECTION_REMOVE_PHOTO', index });
  }, [dispatch]);

  // Fermer le staging avec des photos déjà prises → confirmation (le travail de
  // prise de vue par sections est coûteux, on ne le jette pas sur un tap accidentel).
  const handleCloseStaging = useCallback((imageCount: number) => {
    if (imageCount === 0) { reset(); return; }
    Alert.alert(t('scan.stagingDiscardTitle'), t('scan.stagingDiscardMessage', { count: imageCount }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('scan.stagingDiscardConfirm'), style: 'destructive', onPress: reset },
    ]);
  }, [reset, t]);

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
      view = <ScanCamera onCapture={handleCapture} onCancel={() => dispatch({ type: 'CANCEL_CAMERA' })} onImportGallery={handleGalleryImport} idleHint={scanMode === 'collection' ? t('scan.cameraHintCollection') : undefined} highQuality={scanMode === 'collection'} />;
      break;
    case 'collection-staging':
      view = <ScanCollectionStaging images={state.images} onAddSection={handleAddSection} onRemovePhoto={handleRemovePhoto} onAnalyze={handleAnalyzeStaging} onClose={handleCloseStaging} />;
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
