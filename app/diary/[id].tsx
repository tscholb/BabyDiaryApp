import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaby } from '@/src/db/babies';
import { deleteDiary, getDiary } from '@/src/db/diaries';
import { deletePhoto } from '@/src/services/photoStorage';
import type { Baby, DiaryWithPhotos } from '@/src/types';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { prettyDate } from '@/src/utils/date';

export default function DiaryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const diaryId = Number(id);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [diary, setDiary] = useState<DiaryWithPhotos | null>(null);
  const [baby, setBaby] = useState<Baby | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const d = await getDiary(diaryId);
        setDiary(d);
        if (d) setBaby(await getBaby(d.babyId));
      })();
    }, [diaryId])
  );

  const handleDelete = () => {
    Alert.alert(
      '일기 삭제',
      '이 일기를 삭제하시겠어요? 사진도 함께 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            if (!diary) return;
            const uris = diary.photos.map(p => p.uri);
            await deleteDiary(diary.id);
            await Promise.all(uris.map(u => deletePhoto(u)));
            router.back();
          },
        },
      ]
    );
  };

  if (!diary) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.textMuted }}>불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.headerBtn, { color: palette.textMuted }]}>뒤로</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable
            onPress={() => router.push(`/diary/new?id=${diary.id}`)}
            hitSlop={12}>
            <IconSymbol name="pencil" size={22} color={palette.tint} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12}>
            <IconSymbol name="trash" size={22} color={palette.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View>
          <Text style={[styles.date, { color: palette.text }]}>
            {prettyDate(diary.entryDate)}
          </Text>
          {baby && (
            <Text style={[styles.age, { color: palette.textMuted }]}>
              {baby.name} · {getBabyAgeLabel(baby.birthDate, new Date(diary.entryDate))}
            </Text>
          )}
        </View>
        {diary.photos.map(p => (
          <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} />
        ))}
        {diary.body ? (
          <Text style={[styles.body, { color: palette.text }]}>{diary.body}</Text>
        ) : null}
        {diary.aiGenerated ? (
          <View style={styles.aiChip}>
            <IconSymbol name="sparkles" size={12} color={palette.textMuted} />
            <Text style={[styles.aiChipText, { color: palette.textMuted }]}>
              AI 초안으로 작성됨
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 15 },
  date: { fontSize: 22, fontWeight: '700' },
  age: { fontSize: 14, marginTop: 4 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  body: { fontSize: 16, lineHeight: 26 },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiChipText: { fontSize: 11 },
});
