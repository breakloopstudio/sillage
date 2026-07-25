import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ScentListRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/(tabs)/selection', params: { segment: 'carnet' } });
  }, [router]);
  return null;
}
