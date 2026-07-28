// src/components/AlertPriceToggle.tsx — Row alerte prix sur fiche détail
// Ouvre la PriceAlertSheet (surface d'alerte unique, partagée avec le tab Favoris).

import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { usePriceAlertsContext } from '../contexts/PriceAlertsContext';
import { formatPrice } from '../utils/format-price';
import PriceAlertSheet from './PriceAlertSheet';

interface Props {
  parfumId: string;
  uid: string;
  currentPrice?: number;
  referencePrice?: number;
  nom: string;
  marque: string;
  imageUrl?: string;
}

export default function AlertPriceToggle({ parfumId, uid, currentPrice, referencePrice, nom, marque, imageUrl }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { byParfumId, setAlert } = usePriceAlertsContext();
  const [sheetVisible, setSheetVisible] = useState(false);

  const alert = byParfumId.get(parfumId) ?? null;
  const active = alert !== null;

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);
  const handleSave = useCallback((next: boolean, targetPrice: number | null) => {
    setAlert(parfumId, next, { currentPrice, targetPrice }).catch(() => {});
    setSheetVisible(false);
  }, [parfumId, currentPrice, setAlert]);

  const desc = active
    ? (alert?.targetPrice != null ? `Cible ${formatPrice(alert.targetPrice, { decimals: 0 })} — tu seras notifié` : 'Activée — tu seras notifié')
    : 'Sois prévenu quand le prix baisse';

  return (
    <>
      <Pressable onPress={openSheet} style={s.row} accessibilityRole="button" accessibilityLabel="Alerte prix">
        <View style={s.left}>
          <Ionicons name={active ? 'notifications' : 'notifications-outline'} size={20} color={active ? theme.colors.primary : theme.colors.textMuted} />
          <View style={s.textWrap}>
            <Text style={s.label}>Alerte prix</Text>
            <Text style={s.desc}>{desc}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      </Pressable>
      <PriceAlertSheet
        visible={sheetVisible}
        parfumId={parfumId}
        nom={nom}
        marque={marque}
        imageUrl={imageUrl ?? null}
        bestPrice={currentPrice}
        referencePrice={referencePrice}
        existingAlert={alert}
        onClose={closeSheet}
        onSave={handleSave}
      />
    </>
  );
}

function getStyles(t: Theme) {
  return {
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      gap: 12,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    textWrap: { flex: 1 },
    label: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
    desc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
  } as const;
}
