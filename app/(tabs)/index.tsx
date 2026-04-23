import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaby } from '@/src/db/babies';
import { listDiaries } from '@/src/db/diaries';
import type { Baby, DiaryWithPhotos } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';
import { getBabyAgeLabel } from '@/src/utils/babyAge';

export default function FeedScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [baby, setBaby] = useState<Baby | null>(null);
  const [diaries, setDiaries] = useState<DiaryWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const activeId = await getActiveBabyId();
      if (!activeId) {
        setBaby(null);
        setDiaries([]);
        return;
      }
      const [b, d] = await Promise.all([
        getBaby(activeId),
        listDiaries(activeId),
      ]);
      setBaby(b);
      setDiaries(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.textMuted }}>불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  if (!baby) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          첫 아기 프로필을 만들어주세요
        </Text>
        <Text style={[styles.emptyBody, { color: palette.textMuted }]}>
          이름과 생일을 알려주시면 매일의 기록을 시작할 수 있어요.
        </Text>
        <Pressable
          onPress={() => router.push('/baby/new')}
          style={[styles.primaryBtn, { backgroundColor: palette.tint }]}>
          <Text style={styles.primaryBtnText}>프로필 만들기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.babyName, { color: palette.text }]}>
          {baby.name}
        </Text>
        <Text style={[styles.babyAge, { color: palette.textMuted }]}>
          {getBabyAgeLabel(baby.birthDate)}
        </Text>
      </View>

      <FlatList
        data={diaries}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              아직 기록이 없어요
            </Text>
            <Text style={[styles.emptyBody, { color: palette.textMuted }]}>
              작성 탭에서 오늘의 순간을 남겨보세요.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/diary/${item.id}`)}
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            {item.photos.length > 0 && (
              <Image
                source={{ uri: item.photos[0].uri }}
                style={styles.cardImage}
              />
            )}
            <View style={styles.cardBody}>
              <Text style={[styles.cardDate, { color: palette.textMuted }]}>
                {item.entryDate} · {getBabyAgeLabel(baby.birthDate, new Date(item.entryDate))}
              </Text>
              <Text
                numberOfLines={4}
                style={[styles.cardText, { color: palette.text }]}>
                {item.body}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  babyName: { fontSize: 24, fontWeight: '700' },
  babyAge: { fontSize: 14, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardImage: { width: '100%', height: 240 },
  cardBody: { padding: 16, gap: 6 },
  cardDate: { fontSize: 12 },
  cardText: { fontSize: 15, lineHeight: 22 },
  primaryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
