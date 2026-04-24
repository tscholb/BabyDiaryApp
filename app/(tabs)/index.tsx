import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
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
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return diaries;
    return diaries.filter(
      d =>
        d.body.toLowerCase().includes(q) ||
        d.entryDate.includes(q)
    );
  }, [diaries, query]);

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
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[styles.babyName, { color: palette.text }]}>
            {baby.name}
          </Text>
          <Text style={[styles.babyAge, { color: palette.textMuted }]}>
            {getBabyAgeLabel(baby.birthDate)}
          </Text>
        </View>
      </View>

      {diaries.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="일기 내용 또는 날짜 검색"
            placeholderTextColor={palette.textMuted}
            style={[
              styles.search,
              {
                backgroundColor: palette.surface,
                color: palette.text,
                borderColor: palette.border,
              },
            ]}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              {query ? '검색 결과가 없어요' : '아직 기록이 없어요'}
            </Text>
            {!query && (
              <Text style={[styles.emptyBody, { color: palette.textMuted }]}>
                작성 탭에서 오늘의 순간을 남겨보세요.
              </Text>
            )}
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
              <View style={styles.coverWrap}>
                <Image
                  source={{
                    uri:
                      item.photos[0].mediaType === 'video'
                        ? item.photos[0].thumbnailUri ?? item.photos[0].uri
                        : item.photos[0].uri,
                  }}
                  style={styles.cardImage}
                />
                {item.photos[0].mediaType === 'video' && (
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>▶</Text>
                  </View>
                )}
                {item.photos.length > 1 && (
                  <View style={styles.photoBadge}>
                    <IconSymbol
                      name="photo.on.rectangle"
                      size={12}
                      color="#fff"
                    />
                    <Text style={styles.photoBadgeText}>
                      {item.photos.length}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardMeta}>
                <Text style={[styles.cardDate, { color: palette.textMuted }]}>
                  {item.entryDate} · {getBabyAgeLabel(baby.birthDate, new Date(item.entryDate))}
                </Text>
                {item.aiGenerated ? (
                  <IconSymbol
                    name="sparkles"
                    size={12}
                    color={palette.textMuted}
                  />
                ) : null}
              </View>
              <Text
                numberOfLines={4}
                style={[styles.cardText, { color: palette.text }]}>
                {item.body || '(내용 없음)'}
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
  babyAge: { fontSize: 14 },
  search: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  coverWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 240 },
  photoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  videoBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeText: { color: '#fff', fontSize: 14, marginLeft: 2 },
  cardBody: { padding: 16, gap: 6 },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
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
