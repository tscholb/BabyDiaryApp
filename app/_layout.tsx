import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDatabase } from '@/src/db/database';
import { ensureAndroidChannel } from '@/src/services/notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await getDatabase();
      await ensureAndroidChannel();
      setDbReady(true);
    })();
  }, []);

  if (!dbReady) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="baby/new" options={{ title: '프로필 만들기' }} />
        <Stack.Screen name="baby/[id]/edit" options={{ title: '프로필 수정' }} />
        <Stack.Screen name="diary/new" options={{ title: '새 일기' }} />
        <Stack.Screen name="diary/[id]" options={{ title: '일기' }} />
        <Stack.Screen name="settings/ai" options={{ title: 'AI 설정' }} />
        <Stack.Screen name="settings/export" options={{ title: '내보내기' }} />
        <Stack.Screen name="settings/import" options={{ title: '가져오기' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
