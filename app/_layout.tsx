import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDatabase } from '@/src/db/database';
import { ensureAndroidChannel } from '@/src/services/notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        await ensureAndroidChannel();
        setDbReady(true);
      } catch (e) {
        const message = e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e);
        console.error('App init failed:', message);
        setInitError(message);
      }
    })();
  }, []);

  if (initError) {
    const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.background }}
        contentContainerStyle={styles.errorWrap}>
        <Text style={[styles.errorTitle, { color: palette.danger }]}>
          앱 시작에 실패했어요
        </Text>
        <Text style={[styles.errorText, { color: palette.text }]} selectable>
          {initError}
        </Text>
      </ScrollView>
    );
  }

  if (!dbReady) {
    const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
    return (
      <View style={[styles.loadingWrap, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.textMuted }}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="baby/new" options={{ title: '프로필 만들기' }} />
        <Stack.Screen name="baby/[id]/edit" options={{ title: '프로필 수정' }} />
        <Stack.Screen name="diary/new" options={{ title: '새 일기' }} />
        <Stack.Screen name="diary/[id]" options={{ title: '일기' }} />
        <Stack.Screen
          name="anniversaries"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="settings/ai" options={{ title: 'AI 설정' }} />
        <Stack.Screen name="settings/export" options={{ title: '내보내기' }} />
        <Stack.Screen name="settings/import" options={{ title: '가져오기' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { padding: 24, paddingTop: 80 },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
