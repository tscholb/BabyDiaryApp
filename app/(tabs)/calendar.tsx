import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={['top']}>
      <Text style={[styles.title, { color: palette.text }]}>달력</Text>
      <View style={styles.placeholder}>
        <Text style={{ color: palette.textMuted }}>
          달력 뷰는 다음 단계에서 구현됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
