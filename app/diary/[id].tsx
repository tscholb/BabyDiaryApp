import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { createRef, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { MediaItem } from '@/src/components/MediaCollage';
import { MediaCollage } from '@/src/components/MediaCollage';
import { ShareCard } from '@/src/components/ShareCard';
import { getBaby } from '@/src/db/babies';
import { deleteDiary, getDiary } from '@/src/db/diaries';
import { deleteMedia } from '@/src/services/photoStorage';
import {
  buildShareSlides,
  captureShareSlides,
  shareDiarySlides,
} from '@/src/services/shareDiary';
import type { Baby, DiaryWithPhotos, Photo } from '@/src/types';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { prettyDate } from '@/src/utils/date';
import { safeBack } from '@/src/utils/navigation';
import { groupPhotosBySession } from '@/src/utils/sessions';

export default function DiaryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const diaryId = Number(id);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [diary, setDiary] = useState<DiaryWithPhotos | null>(null);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [sharing, setSharing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const d = await getDiary(diaryId);
        setDiary(d);
        if (d) setBaby(await getBaby(d.babyId));
      })();
    }, [diaryId])
  );

  const slides = useMemo(() => (diary ? buildShareSlides(diary) : []), [diary]);
  const slideRefs = useRef<React.RefObject<View | null>[]>([]);
  if (slideRefs.current.length !== slides.length) {
    slideRefs.current = slides.map(() => createRef<View | null>());
  }

  const handleShare = async () => {
    if (!diary || !baby || sharing) return;
    setSharing(true);
    try {
      await new Promise(r => setTimeout(r, 200));
      const uris = await captureShareSlides(slideRefs.current);
      const result = await shareDiarySlides(uris, baby, diary.entryDate);
      if (!result.ok && result.message) {
        Alert.alert('공유 실패', result.message);
      }
    } catch (e) {
      Alert.alert('공유 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

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
            const items = diary.photos.map(p => ({
              uri: p.uri,
              thumbnailUri: p.thumbnailUri,
            }));
            await deleteDiary(diary.id);
            await Promise.all(
              items.map(it => deleteMedia(it.uri, it.thumbnailUri))
            );
            safeBack();
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
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Text style={[styles.headerBtn, { color: palette.textMuted }]}>뒤로</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={handleShare} disabled={sharing} hitSlop={12}>
            {sharing ? (
              <ActivityIndicator color={palette.tint} size="small" />
            ) : (
              <IconSymbol name="square.and.arrow.up" size={22} color={palette.tint} />
            )}
          </Pressable>
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

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.paper,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}>
          <View style={styles.dateHeader}>
            <Text style={[styles.date, { color: palette.text }]}>
              {prettyDate(diary.entryDate)}
            </Text>
            {baby && (
              <Text style={[styles.age, { color: palette.textMuted }]}>
                {baby.name} · {getBabyAgeLabel(baby.birthDate, new Date(diary.entryDate))}
              </Text>
            )}
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
          </View>

          {(() => {
            const byUri = new Map<string, Photo>();
            for (const p of diary.photos) byUri.set(p.uri, p);
            const toItems = (uris: string[]): MediaItem[] =>
              uris.map(u => {
                const p = byUri.get(u);
                return {
                  uri: u,
                  mediaType: p?.mediaType ?? 'photo',
                  thumbnailUri: p?.thumbnailUri ?? null,
                };
              });
            const sessions = groupPhotosBySession(diary.photos).filter(
              s => s.length > 0
            );
            const sessionTexts = diary.sessionBodies.length > 0
              ? sessions.map((_, i) => diary.sessionBodies[i] ?? '')
              : [];
            const hasInterleavedTexts = sessionTexts.some(t => t && t.trim().length > 0);

            if (sessions.length === 0) {
              return diary.body ? (
                <Text style={[styles.body, { color: palette.text }]}>
                  {diary.body}
                </Text>
              ) : null;
            }

            if (sessions.length === 1) {
              return (
                <>
                  <MediaCollage items={toItems(sessions[0])} layout={diary.photoLayout} />
                  {(sessionTexts[0] || diary.body) ? (
                    <Text style={[styles.body, { color: palette.text }]}>
                      {sessionTexts[0] || diary.body}
                    </Text>
                  ) : null}
                </>
              );
            }

            if (hasInterleavedTexts) {
              return (
                <View style={{ gap: 8 }}>
                  {sessions.map((uris, i) => (
                    <View key={i}>
                      {i > 0 && (
                        <View
                          style={[
                            styles.sessionDivider,
                            { backgroundColor: palette.border },
                          ]}
                        />
                      )}
                      <MediaCollage items={toItems(uris)} layout={diary.photoLayout} />
                      {sessionTexts[i] ? (
                        <Text style={[styles.body, { color: palette.text }]}>
                          {sessionTexts[i]}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            }

            return (
              <>
                <View style={{ gap: 8 }}>
                  {sessions.map((uris, i) => (
                    <View key={i}>
                      {i > 0 && (
                        <View
                          style={[
                            styles.sessionDivider,
                            { backgroundColor: palette.border },
                          ]}
                        />
                      )}
                      <MediaCollage items={toItems(uris)} layout={diary.photoLayout} />
                    </View>
                  ))}
                </View>
                {diary.body ? (
                  <Text style={[styles.body, { color: palette.text }]}>
                    {diary.body}
                  </Text>
                ) : null}
              </>
            );
          })()}

          {diary.aiGenerated ? (
            <View style={styles.aiChip}>
              <IconSymbol name="sparkles" size={12} color={palette.textMuted} />
              <Text style={[styles.aiChipText, { color: palette.textMuted }]}>
                AI 초안으로 작성됨
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {baby && (
        <View pointerEvents="none" style={styles.offscreen}>
          {slides.map((slide, i) => (
            <ShareCard
              key={i}
              ref={slideRefs.current[i]}
              baby={baby}
              entryDate={diary.entryDate}
              body={slide.body}
              photos={slide.photos}
              sessionLabel={slide.sessionLabel}
            />
          ))}
        </View>
      )}
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
  paper: {
    padding: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dateHeader: { marginBottom: 8 },
  date: { fontSize: 22, fontWeight: '700' },
  age: { fontSize: 13, marginTop: 4 },
  divider: {
    height: 1,
    marginTop: 16,
  },
  sessionDivider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    width: '50%',
    marginVertical: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 28,
    marginTop: 8,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 16,
  },
  aiChipText: { fontSize: 11 },
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 0,
  },
});
