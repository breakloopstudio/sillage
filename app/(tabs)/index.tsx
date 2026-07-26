import { useCallback, useEffect } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { consumePendingParfum, setPendingParfum } from '../../src/services/catalog-bridge';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import CatalogPage from '../../src/features/catalog/CatalogPage';

export default function CatalogTab() {
  const { scrollY } = useNavigationChrome();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      const p = consumePendingParfum();
      if (p) {
        setPendingParfum(p);
        const t = setTimeout(() => router.push(`/catalog/${p.id}`), 200);
        return () => clearTimeout(t);
      }
    }, [router]),
  );

  return <CatalogPage scrollY={scrollY} />;
}
