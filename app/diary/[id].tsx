import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDiary } from '@/src/db/diaries';
import type { DiaryWithPhotos } from '@/src/types';

export default function DiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [diary, setDiary] = useState<DiaryWithPhotos | null>(null);

  useEffect(() => {
    (async () => {
      setDiary(await getDiary(Number(id)));
    })();
  }, [id]);

  if (!diary) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.textMuted }}>불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={[styles.date, { color: palette.textMuted }]}>
          {diary.entryDate}
        </Text>
        {diary.photos.map(p => (
          <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} />
        ))}
        <Text style={[styles.body, { color: palette.text }]}>{diary.body}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 14 },
  photo: { width: '100%', height: 320, borderRadius: 12 },
  body: { fontSize: 16, lineHeight: 24 },
});
