import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import RunnerGame from '../src/features/runner/RunnerGame';

export default function RunnerScreen() {
  const router = useRouter();
  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  return (
    <View style={styles.container}>
      <RunnerGame onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0712' },
});
