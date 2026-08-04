// src/features/scan/ScanCamera.tsx — Vue caméra avec viseur animé, flash, burst resize

import { useRef, useState, useMemo, useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Alert } from 'react-native';
import { CameraView } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';

// Resize max : 1280px pour l'OCR d'étiquettes (detail high côté serveur),
// payload contenu par la compression JPEG (ex-capteur 12MP → ~300-600KB base64)
const MAX_IMAGE_WIDTH = 1280;
const IMAGE_QUALITY = 0.6;
const BURST_COUNT = 1;

interface Props {
  onCapture: (burstBase64: string[]) => void;
  onCancel: () => void;
  onImportGallery?: () => void;
  idleHint?: string;
}

export function ScanCamera({ onCapture, onCancel, onImportGallery, idleHint }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [capturing, setCapturing] = useState(false);
  const [captureIndex, setCaptureIndex] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const flashOpacity = useSharedValue(0);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const triggerFlash = () => {
    'worklet';
    flashOpacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 400 }),
    );
  };

  const takeBurst = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const burst: string[] = [];

      for (let i = 0; i < BURST_COUNT; i++) {
        hapticsLight();
        setCaptureIndex(i + 1);
        const photo = await cameraRef.current.takePictureAsync({
          quality: IMAGE_QUALITY,
          base64: false,
        });
        if (photo?.uri) {
          const manipulated = await manipulateAsync(
            photo.uri,
            [{ resize: { width: MAX_IMAGE_WIDTH } }],
            { compress: IMAGE_QUALITY, base64: true, format: SaveFormat.JPEG },
          );
          if (manipulated.base64) {
            burst.push(`data:image/jpeg;base64,${manipulated.base64}`);
          }
        }
      }

      if (burst.length > 0) {
        triggerFlash();
        if (mountedRef.current) runOnJS(onCapture)(burst);
      } else if (mountedRef.current) {
        setCapturing(false);
        setCaptureIndex(0);
        Alert.alert(t('scan.errorTitle'), t('scan.noPhotoError'));
      }
    } catch {
      if (!mountedRef.current) return;
      setCapturing(false);
      setCaptureIndex(0);
      Alert.alert(t('scan.errorTitle'), t('scan.captureError'));
    }
  };

  return (
    <View style={s.container}>
      <CameraView
        ref={cameraRef}
        style={s.camera}
        facing="back"
        animateShutter={false}
      >
        <View style={s.overlay}>
          <View style={[s.topBar, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={onCancel} style={s.closeBtn} hitSlop={16}>
              <Ionicons name="close-circle-outline" size={36} color="#FFF" />
            </Pressable>
          </View>

          <View style={s.vf}>
            <View style={[s.cTL, s.cActive]} />
            <View style={[s.cTR, s.cActive]} />
            <View style={[s.cBL, s.cActive]} />
            <View style={[s.cBR, s.cActive]} />
          </View>

          <Text style={s.hint}>
            {capturing
              ? (BURST_COUNT > 1 ? t('scan.holdStillBurst', { index: captureIndex, count: BURST_COUNT }) : t('scan.holdStill'))
              : (idleHint ?? t('scan.cameraHint'))}
          </Text>

          <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            {onImportGallery ? (
              <Pressable onPress={onImportGallery} style={s.galleryBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('scan.importGalleryA11y')}>
                <Ionicons name="images-outline" size={24} color="#FFF" />
              </Pressable>
            ) : (
              <View style={s.galleryBtn} />
            )}
            <Pressable
              onPress={takeBurst}
              style={[s.captureBtn, capturing && s.captureDisabled]}
              disabled={capturing}
            >
              <View style={[s.captureInner, capturing && s.captureInnerDisabled]} />
            </Pressable>
            <View style={s.galleryBtn} />
          </View>
        </View>
      </CameraView>

      <Animated.View style={[s.flashOverlay, flashStyle]} pointerEvents="none" />
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'space-between' },
    topBar: { paddingHorizontal: 20, alignItems: 'flex-end' },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    vf: {
      width: 260,
      height: 260,
      alignSelf: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.25)',
      borderRadius: 16,
    },
    cTL: { position: 'absolute', top: -2, left: -2, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: t.colors.primary, borderTopLeftRadius: 8 },
    cTR: { position: 'absolute', top: -2, right: -2, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: t.colors.primary, borderTopRightRadius: 8 },
    cBL: { position: 'absolute', bottom: -2, left: -2, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: t.colors.primary, borderBottomLeftRadius: 8 },
    cBR: { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: t.colors.primary, borderBottomRightRadius: 8 },
    cActive: { borderColor: t.colors.primary },
    hint: { color: '#FFF', textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14, paddingHorizontal: 40, opacity: 0.8 },
    bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 },
    galleryBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    captureBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      borderColor: '#FFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureDisabled: { borderColor: 'rgba(255,255,255,0.4)' },
    captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },
    captureInnerDisabled: { backgroundColor: 'rgba(255,255,255,0.4)' },
    flashOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#FFFFFF',
    },
  } as const;
}
