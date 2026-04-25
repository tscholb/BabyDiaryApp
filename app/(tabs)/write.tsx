import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getActiveBabyId } from '@/src/utils/activeBaby';

export default function WriteRedirect() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const id = await getActiveBabyId();
        if (!id) {
          router.replace('/baby/new');
        } else {
          router.replace('/diary/new');
        }
      })();
    }, [router])
  );

  return (
    <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
      <Text style={{ color: palette.textMuted }}>작성 화면으로 이동 중...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
