import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ExportScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <Text style={[styles.title, { color: palette.text }]}>내보내기</Text>
      <Text style={{ color: palette.textMuted }}>
        PDF/zip 내보내기는 다음 단계에서 구현됩니다.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
});
