import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function WardrobeRedirect() {
  const router = useRouter();
  const rawId = useLocalSearchParams<{ parfumId: string }>().parfumId;
  const parfumId: string | undefined = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (parfumId) router.replace(`/catalog/${parfumId}`);
  }, [router, parfumId]);

  return null;
}
