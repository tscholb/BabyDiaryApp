import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AnniversaryPicker,
  type AnniversaryDraft,
} from '@/src/components/AnniversaryPicker';
import {
  createAnniversary,
  deleteAnniversary,
  listAnniversariesForDiary,
} from '@/src/db/anniversaries';
import { getBaby } from '@/src/db/babies';
import type { MediaMeta } from '@/src/db/diaries';
import { createDiary, getDiary, updateDiary } from '@/src/db/diaries';
import { generateDiaryFromPhotos } from '@/src/services/ai';
import { getAiSettings } from '@/src/services/aiSettings';
import {
  deleteMedia,
  persistPhoto,
  persistVideo,
} from '@/src/services/photoStorage';
import type { Anniversary, Baby, PhotoLayout } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { parseExifDate, parseExifDateTime, prettyDate, todayISO } from '@/src/utils/date';
import { parseExifGps } from '@/src/utils/exif';
import {
  lookupAssetLocation,
  requestMediaLibraryPermission,
} from '@/src/utils/mediaLibraryGps';
import { ensureMediaLocationPermission } from '@/src/utils/permissions';
import { safeBack } from '@/src/utils/navigation';
import { groupPhotosBySession } from '@/src/utils/sessions';

const MAX_PHOTOS_PER_SESSION = 6;
const MAX_SESSIONS = 5;

function formatModelName(id: string): string {
  if (id.startsWith('gemini-')) {
    return id
      .replace('gemini-', 'Gemini ')
      .replace('-flash-lite', ' Flash Lite')
      .replace('-flash', ' Flash')
      .replace('-pro', ' Pro');
  }
  if (id.startsWith('claude-')) {
    if (id.includes('opus')) return 'Claude Opus';
    if (id.includes('sonnet')) return 'Claude Sonnet';
    if (id.includes('haiku')) return 'Claude Haiku';
    return 'Claude';
  }
  if (id.startsWith('gpt-')) return 'GPT ' + id.replace('gpt-', '');
  return id;
}

export default function DiaryEditorScreen() {
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const editingId = id ? Number(id) : null;
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [baby, setBaby] = useState<Baby | null>(null);
  const [entryDate, setEntryDate] = useState(date ?? todayISO());
  const [body, setBody] = useState('');
  const [sessions, setSessions] = useState<string[][]>([[]]);
  const [originalSessions, setOriginalSessions] = useState<string[][]>([[]]);
  const [sessionTexts, setSessionTexts] = useState<string[]>(['']);
  const [mediaByUri, setMediaByUri] = useState<Record<string, MediaMeta>>({});
  const [layout, setLayout] = useState<PhotoLayout>('polaroid');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [dateAutoSet, setDateAutoSet] = useState(false);
  const [userTouchedDate, setUserTouchedDate] = useState(
    Boolean(date) || Boolean(id)
  );
  const [existingAnniversaries, setExistingAnniversaries] = useState<Anniversary[]>([]);
  const [pendingAnniversaryDrafts, setPendingAnniversaryDrafts] = useState<
    AnniversaryDraft[]
  >([]);
  const [removedAnniversaryIds, setRemovedAnniversaryIds] = useState<Set<number>>(
    new Set()
  );
  const [anniversaryPickerOpen, setAnniversaryPickerOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = (target: number | null) => {
    if (target == null) return;
    const scrollNode = findNodeHandle(scrollRef.current);
    if (!scrollNode) return;
    UIManager.measureLayout(
      target,
      scrollNode,
      () => {},
      (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(y - 80, 0), animated: true });
      }
    );
  };

  useEffect(() => {
    (async () => {
      const babyId = await getActiveBabyId();
      if (!babyId) {
        router.replace('/baby/new');
        return;
      }
      const [b, ai] = await Promise.all([getBaby(babyId), getAiSettings()]);
      setBaby(b);
      setAiEnabled(ai.enabled);

      if (editingId) {
        const diary = await getDiary(editingId);
        if (diary) {
          setEntryDate(diary.entryDate);
          setBody(diary.body);
          setLayout(diary.photoLayout);
          const grouped = groupPhotosBySession(diary.photos);
          const initial = grouped.length > 0 ? grouped : [[]];
          setSessions(initial.map(s => [...s]));
          setOriginalSessions(initial.map(s => [...s]));

          const initialTexts = initial.map((_, i) =>
            diary.sessionBodies[i] ?? ''
          );
          if (
            initialTexts.every(t => !t) &&
            diary.body &&
            initial.length === 1
          ) {
            initialTexts[0] = diary.body;
          }
          setSessionTexts(initialTexts);

          const existingMedia: Record<string, MediaMeta> = {};
          for (const p of diary.photos) {
            existingMedia[p.uri] = {
              capturedAt: p.capturedAt,
              mediaType: p.mediaType,
              thumbnailUri: p.thumbnailUri,
              latitude: p.latitude,
              longitude: p.longitude,
            };
          }
          setMediaByUri(existingMedia);

          const existing = await listAnniversariesForDiary(editingId);
          setExistingAnniversaries(existing);
        }
      }
    })();
  }, [editingId, router]);

  const ageLabel = useMemo(() => {
    if (!baby) return '';
    return getBabyAgeLabel(baby.birthDate, new Date(entryDate));
  }, [baby, entryDate]);

  const allPhotos = useMemo(() => sessions.flat(), [sessions]);
  const nonEmptySessionCount = sessions.filter(s => s.length > 0).length;

  const addPhotoToSession = (sIdx: number, uri: string) => {
    setSessions(prev =>
      prev.map((s, i) => (i === sIdx ? [...s, uri] : s))
    );
  };

  const mergeMedia = (entries: Array<[string, MediaMeta]>) => {
    setMediaByUri(prev => {
      const next = { ...prev };
      for (const [uri, meta] of entries) next[uri] = meta;
      return next;
    });
  };

  const pickMedia = async (sIdx: number) => {
    const remaining = MAX_PHOTOS_PER_SESSION - sessions[sIdx].length;
    if (remaining <= 0) {
      Alert.alert(`한 세션에 최대 ${MAX_PHOTOS_PER_SESSION}개까지 넣을 수 있어요`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진첩 접근 권한이 필요해요');
      return;
    }
    await ensureMediaLocationPermission();
    await requestMediaLibraryPermission();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
      exif: true,
      legacy: true,
    });
    if (result.canceled) return;
    try {
      const addedUris: string[] = [];
      const metaEntries: Array<[string, MediaMeta]> = [];
      for (const asset of result.assets) {
        const exif = asset.exif as Record<string, unknown> | null;
        let gps = parseExifGps(exif);
        if (!gps) {
          gps = await lookupAssetLocation({
            assetId: asset.assetId,
            fileName: asset.fileName,
            capturedAt: parseExifDateTime(exif),
          });
        }
        if (asset.type === 'video') {
          const { videoUri, thumbnailUri } = await persistVideo(asset.uri);
          addedUris.push(videoUri);
          metaEntries.push([
            videoUri,
            {
              mediaType: 'video',
              thumbnailUri,
              capturedAt: parseExifDateTime(exif),
              latitude: gps?.latitude ?? null,
              longitude: gps?.longitude ?? null,
            },
          ]);
        } else {
          const photoUri = await persistPhoto(asset.uri);
          addedUris.push(photoUri);
          metaEntries.push([
            photoUri,
            {
              mediaType: 'photo',
              thumbnailUri: null,
              capturedAt: parseExifDateTime(exif),
              latitude: gps?.latitude ?? null,
              longitude: gps?.longitude ?? null,
            },
          ]);
        }
      }
      setSessions(prev =>
        prev.map((s, i) => (i === sIdx ? [...s, ...addedUris] : s))
      );
      mergeMedia(metaEntries);
      maybeApplyExifDate(result.assets);
    } catch (e) {
      Alert.alert('추가 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const takePhoto = async (sIdx: number) => {
    if (sessions[sIdx].length >= MAX_PHOTOS_PER_SESSION) {
      Alert.alert(`한 세션에 최대 ${MAX_PHOTOS_PER_SESSION}개까지 넣을 수 있어요`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('카메라 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1, exif: true });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const exif = asset.exif as Record<string, unknown> | null;
      const stored = await persistPhoto(asset.uri);
      const capturedAt = parseExifDateTime(exif) ?? new Date().toISOString();
      const gps = parseExifGps(exif);
      addPhotoToSession(sIdx, stored);
      mergeMedia([
        [
          stored,
          {
            mediaType: 'photo',
            thumbnailUri: null,
            capturedAt,
            latitude: gps?.latitude ?? null,
            longitude: gps?.longitude ?? null,
          },
        ],
      ]);
      maybeApplyExifDate(result.assets);
    } catch (e) {
      Alert.alert('추가 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const maybeApplyExifDate = (assets: ImagePicker.ImagePickerAsset[]) => {
    if (userTouchedDate || editingId) return;
    const dates = assets
      .map(a => parseExifDate(a.exif as Record<string, unknown> | null))
      .filter((d): d is string => Boolean(d))
      .sort();
    if (dates.length === 0) return;
    const first = dates[0];
    if (first === entryDate) return;
    setEntryDate(first);
    setDateAutoSet(true);
  };

  const removePhoto = (sIdx: number, uri: string) => {
    setSessions(prev =>
      prev.map((s, i) => (i === sIdx ? s.filter(u => u !== uri) : s))
    );
  };

  const addSession = () => {
    if (sessions.length >= MAX_SESSIONS) {
      Alert.alert(`세션은 최대 ${MAX_SESSIONS}개까지 만들 수 있어요`);
      return;
    }
    setSessions(prev => [...prev, []]);
    setSessionTexts(prev => [...prev, '']);
  };

  const removeSession = (sIdx: number) => {
    if (sessions.length === 1) {
      Alert.alert('최소 한 세션은 있어야 해요');
      return;
    }
    const toRemove = sessions[sIdx];
    Alert.alert(
      '세션 삭제',
      toRemove.length > 0
        ? `이 세션의 사진 ${toRemove.length}장도 함께 지워집니다.`
        : '이 세션을 삭제하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setSessions(prev => prev.filter((_, i) => i !== sIdx));
            setSessionTexts(prev => prev.filter((_, i) => i !== sIdx));
            if (!editingId) {
              await Promise.all(
                toRemove.map(u =>
                  deleteMedia(u, mediaByUri[u]?.thumbnailUri ?? null)
                )
              );
            }
          },
        },
      ]
    );
  };

  const generateAiDraft = async () => {
    if (!baby) return;
    if (allPhotos.length === 0) {
      Alert.alert('사진을 먼저 추가해주세요');
      return;
    }
    setGenerating(true);
    setBanner(null);
    try {
      const capturedAtByUri: Record<string, string | null> = {};
      for (const [uri, meta] of Object.entries(mediaByUri)) {
        capturedAtByUri[uri] = meta.capturedAt ?? null;
      }
      const photoOnlySessions = sessions.map(session =>
        session.filter(u => mediaByUri[u]?.mediaType !== 'video')
      );
      const result = await generateDiaryFromPhotos({
        photoSessions: photoOnlySessions,
        capturedAtByUri,
        babyName: baby.name,
        babyAgeLabel: ageLabel,
        entryDate,
        userNotes: sessionTexts.map(t => t.trim()),
      });
      if (result.ok) {
        setBody(result.text);
        setAiUsed(true);
        setAiModel(result.model);

        const nonEmptyIndices: number[] = [];
        sessions.forEach((s, i) => {
          if (s.length > 0) nonEmptyIndices.push(i);
        });
        if (
          nonEmptyIndices.length > 0 &&
          result.sessionTexts.length === nonEmptyIndices.length
        ) {
          setSessionTexts(prev => {
            const next = [...prev];
            nonEmptyIndices.forEach((sessionIdx, n) => {
              next[sessionIdx] = result.sessionTexts[n];
            });
            return next;
          });
        } else {
          setSessionTexts(prev => {
            const next = [...prev];
            if (next.length > 0) next[0] = result.text;
            return next;
          });
        }
      } else {
        setBanner(result.message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!baby) return;
    const trimmedSessionTexts = sessionTexts.map(t => t.trim());
    const combinedBody =
      trimmedSessionTexts.filter(Boolean).join('\n\n') || body.trim();
    if (!combinedBody && allPhotos.length === 0) {
      Alert.alert('사진이나 내용 중 하나는 있어야 해요');
      return;
    }
    setSaving(true);
    try {
      const cleanedSessions = sessions.map(s => [...s]);
      let savedDiaryId: number;
      if (editingId) {
        await updateDiary(editingId, {
          body: combinedBody,
          entryDate,
          photoLayout: layout,
          photoSessions: cleanedSessions,
          sessionBodies: trimmedSessionTexts,
          mediaByUri,
        });
        const originalUris = originalSessions.flat();
        const currentUris = allPhotos;
        const removed = originalUris.filter(u => !currentUris.includes(u));
        await Promise.all(
          removed.map(u =>
            deleteMedia(u, mediaByUri[u]?.thumbnailUri ?? null)
          )
        );
        savedDiaryId = editingId;
      } else {
        const created = await createDiary({
          babyId: baby.id,
          entryDate,
          body: combinedBody,
          photoLayout: layout,
          photoSessions: cleanedSessions,
          sessionBodies: trimmedSessionTexts,
          mediaByUri,
          aiGenerated: aiUsed,
        });
        savedDiaryId = created.id;
      }

      for (const id of removedAnniversaryIds) {
        await deleteAnniversary(id);
      }
      for (const draft of pendingAnniversaryDrafts) {
        await createAnniversary({
          babyId: baby.id,
          name: draft.name,
          icon: draft.icon,
          category: draft.category,
          date: draft.date,
          notes: draft.notes,
          diaryId: savedDiaryId,
        });
      }

      safeBack();
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!editingId) {
      const originalUris = originalSessions.flat();
      const toDiscard = allPhotos.filter(u => !originalUris.includes(u));
      await Promise.all(
        toDiscard.map(u =>
          deleteMedia(u, mediaByUri[u]?.thumbnailUri ?? null)
        )
      );
    }
    safeBack();
  };

  if (!baby) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable onPress={cancel} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: palette.textMuted }]}>취소</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            {editingId ? '일기 수정' : '새 일기'}
          </Text>
          <Pressable onPress={save} disabled={saving} hitSlop={12}>
            <Text
              style={[
                styles.headerBtn,
                { color: saving ? palette.textMuted : palette.tint, fontWeight: '600' },
              ]}>
              {saving ? '저장 중' : '저장'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 320 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.metaCard,
              { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
            ]}>
            <Text style={[styles.metaDate, { color: palette.text }]}>
              {prettyDate(entryDate)}
            </Text>
            <Text style={[styles.metaAge, { color: palette.textMuted }]}>
              {baby.name} · {ageLabel}
            </Text>
            {dateAutoSet && (
              <Text style={[styles.metaHint, { color: palette.tint }]}>
                사진 촬영일로 자동 설정됐어요
              </Text>
            )}
          </View>

          <View style={styles.anniversarySection}>
            <Text style={[styles.anniversaryLabel, { color: palette.textMuted }]}>
              기념일
            </Text>
            <View style={styles.anniversaryChips}>
              {existingAnniversaries
                .filter(a => !removedAnniversaryIds.has(a.id))
                .map(a => (
                  <View
                    key={`existing-${a.id}`}
                    style={[
                      styles.anniversaryChip,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}>
                    <Text style={styles.anniversaryChipEmoji}>{a.icon}</Text>
                    <Text
                      style={[
                        styles.anniversaryChipText,
                        { color: palette.text },
                      ]}>
                      {a.name}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        setRemovedAnniversaryIds(prev => {
                          const next = new Set(prev);
                          next.add(a.id);
                          return next;
                        })
                      }>
                      <Text
                        style={[
                          styles.anniversaryChipRemove,
                          { color: palette.textMuted },
                        ]}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))}
              {pendingAnniversaryDrafts.map((draft, idx) => (
                <View
                  key={`draft-${idx}`}
                  style={[
                    styles.anniversaryChip,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.tint,
                    },
                  ]}>
                  <Text style={styles.anniversaryChipEmoji}>{draft.icon}</Text>
                  <Text
                    style={[
                      styles.anniversaryChipText,
                      { color: palette.text },
                    ]}>
                    {draft.name}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setPendingAnniversaryDrafts(prev =>
                        prev.filter((_, i) => i !== idx)
                      )
                    }>
                    <Text
                      style={[
                        styles.anniversaryChipRemove,
                        { color: palette.textMuted },
                      ]}>
                      ×
                    </Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => setAnniversaryPickerOpen(true)}
                style={[
                  styles.anniversaryAddBtn,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.anniversaryAddText,
                    { color: palette.tint },
                  ]}>
                  + 기념일 추가
                </Text>
              </Pressable>
            </View>
          </View>

          {banner && (
            <View
              style={[
                styles.banner,
                { backgroundColor: palette.surfaceAlt, borderColor: palette.warning },
              ]}>
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={16}
                color={palette.warning}
              />
              <Text style={[styles.bannerText, { color: palette.text }]}>
                {banner}
              </Text>
            </View>
          )}

          <LayoutPicker
            value={layout}
            onChange={setLayout}
            palette={palette}
          />

          {sessions.map((photos, sIdx) => (
            <SessionCard
              key={sIdx}
              index={sIdx}
              total={sessions.length}
              photos={photos}
              mediaByUri={mediaByUri}
              palette={palette}
              text={sessionTexts[sIdx] ?? ''}
              onTextChange={value =>
                setSessionTexts(prev => {
                  const next = [...prev];
                  next[sIdx] = value;
                  return next;
                })
              }
              onTextFocus={scrollToInput}
              onPick={() => pickMedia(sIdx)}
              onCapture={() => takePhoto(sIdx)}
              onRemovePhoto={uri => removePhoto(sIdx, uri)}
              onRemoveSession={() => removeSession(sIdx)}
            />
          ))}

          {sessions.length < MAX_SESSIONS && (
            <Pressable
              onPress={addSession}
              style={[
                styles.addSessionBtn,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}>
              <Text style={[styles.addSessionText, { color: palette.tint }]}>
                + 세션 추가
              </Text>
              <Text style={[styles.addSessionSub, { color: palette.textMuted }]}>
                하루를 시간대별로 나눠 기록하면 AI가 흐름에 맞춰 써줘요
              </Text>
            </Pressable>
          )}

          {aiEnabled && (
            <View style={{ gap: 8 }}>
              <Pressable
                onPress={generateAiDraft}
                disabled={generating || allPhotos.length === 0}
                style={[
                  styles.aiBtn,
                  {
                    backgroundColor:
                      allPhotos.length === 0 ? palette.surfaceAlt : palette.tint,
                    opacity: generating ? 0.7 : 1,
                  },
                ]}>
                {generating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <IconSymbol name="sparkles" size={18} color="#fff" />
                )}
                <Text style={styles.aiBtnText}>
                  {generating
                    ? 'AI가 작성 중...'
                    : sessionTexts.some(t => t.trim())
                    ? 'AI 초안 다시 생성'
                    : nonEmptySessionCount > 1
                    ? `AI 초안 생성 (${nonEmptySessionCount}개 세션)`
                    : 'AI 초안 생성'}
                </Text>
              </Pressable>

              <Text style={[styles.aiHint, { color: palette.textMuted }]}>
                각 세션 글에 키워드만 적어두면 AI가 그걸 바탕으로 풀어써줘요
              </Text>

              {aiModel && (
                <Text style={[styles.aiModelHint, { color: palette.textMuted }]}>
                  ✨ {formatModelName(aiModel)}로 작성됨
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AnniversaryPicker
        visible={anniversaryPickerOpen}
        onClose={() => setAnniversaryPickerOpen(false)}
        onSave={draft => {
          setPendingAnniversaryDrafts(prev => [...prev, draft]);
          setAnniversaryPickerOpen(false);
        }}
        initialDate={entryDate}
      />
    </SafeAreaView>
  );
}

function LayoutPicker({
  value,
  onChange,
  palette,
}: {
  value: PhotoLayout;
  onChange: (l: PhotoLayout) => void;
  palette: typeof Colors.light;
}) {
  const options: { id: PhotoLayout; label: string }[] = [
    { id: 'polaroid', label: '폴라로이드' },
    { id: 'clean', label: '깔끔하게' },
    { id: 'grid', label: '격자' },
  ];
  return (
    <View style={styles.layoutRow}>
      <Text style={[styles.layoutLabel, { color: palette.textMuted }]}>
        사진 레이아웃
      </Text>
      <View style={[styles.layoutChips, { backgroundColor: palette.surfaceAlt }]}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              style={[
                styles.layoutChip,
                active && { backgroundColor: palette.tint },
              ]}>
              <Text
                style={[
                  styles.layoutChipText,
                  { color: active ? '#fff' : palette.text },
                ]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SessionCard({
  index,
  total,
  photos,
  mediaByUri,
  palette,
  text,
  onTextChange,
  onTextFocus,
  onPick,
  onCapture,
  onRemovePhoto,
  onRemoveSession,
}: {
  index: number;
  total: number;
  photos: string[];
  mediaByUri: Record<string, MediaMeta>;
  palette: typeof Colors.light;
  text: string;
  onTextChange: (v: string) => void;
  onTextFocus: (target: number | null) => void;
  onPick: () => void;
  onCapture: () => void;
  onRemovePhoto: (uri: string) => void;
  onRemoveSession: () => void;
}) {
  const showSessionChrome = total > 1;
  return (
    <View
      style={[
        styles.sessionCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}>
      {showSessionChrome && (
        <View style={styles.sessionHeader}>
          <Text style={[styles.sessionTitle, { color: palette.text }]}>
            세션 {index + 1}
          </Text>
          <Pressable onPress={onRemoveSession} hitSlop={8}>
            <IconSymbol name="trash" size={16} color={palette.danger} />
          </Pressable>
        </View>
      )}

      <View style={styles.photoGrid}>
        {photos.map(uri => {
          const meta = mediaByUri[uri];
          const isVideo = meta?.mediaType === 'video';
          const thumb = meta?.thumbnailUri ?? uri;
          const hasGps = meta?.latitude != null && meta?.longitude != null;
          return (
          <View key={uri} style={styles.photoWrap}>
            <Image source={{ uri: thumb }} style={styles.photoThumb} />
            {isVideo && (
              <View style={styles.videoBadge} pointerEvents="none">
                <Text style={styles.videoBadgeText}>▶</Text>
              </View>
            )}
            {hasGps && (
              <View style={styles.gpsBadge} pointerEvents="none">
                <Text style={styles.gpsBadgeText}>📍</Text>
              </View>
            )}
            <Pressable
              onPress={() => onRemovePhoto(uri)}
              style={[styles.removeBtn, { backgroundColor: palette.surface }]}
              hitSlop={8}>
              <IconSymbol name="trash" size={14} color={palette.danger} />
            </Pressable>
          </View>
          );
        })}
      </View>

      <View style={styles.addBtnRow}>
        <Pressable
          onPress={onPick}
          style={[
            styles.addBtn,
            { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}>
          <IconSymbol name="photo.on.rectangle" size={20} color={palette.tint} />
          <Text style={[styles.addBtnText, { color: palette.text }]}>사진첩</Text>
        </Pressable>
        <Pressable
          onPress={onCapture}
          style={[
            styles.addBtn,
            { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}>
          <IconSymbol name="camera.fill" size={20} color={palette.tint} />
          <Text style={[styles.addBtnText, { color: palette.text }]}>촬영</Text>
        </Pressable>
      </View>

      <TextInput
        value={text}
        onChangeText={onTextChange}
        multiline
        onFocus={e => onTextFocus(e.target as unknown as number)}
        placeholder={
          total > 1
            ? '이 시간대 키워드 또는 한 줄 메모 (예: 놀이터, 모래놀이)'
            : '오늘 키워드 또는 한 줄 메모 (예: 놀이터에서 둘이 모래놀이)'
        }
        placeholderTextColor={palette.textMuted}
        style={[
          styles.sessionBodyInput,
          {
            backgroundColor: palette.surfaceAlt,
            color: palette.text,
            borderColor: palette.border,
          },
        ]}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  metaCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaDate: { fontSize: 18, fontWeight: '700' },
  metaAge: { fontSize: 13, marginTop: 4 },
  metaHint: { fontSize: 12, marginTop: 6, fontWeight: '500' },
  anniversarySection: { gap: 8 },
  anniversaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  anniversaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  anniversaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  anniversaryChipEmoji: { fontSize: 14 },
  anniversaryChipText: { fontSize: 13, fontWeight: '500' },
  anniversaryChipRemove: { fontSize: 18, marginLeft: 2 },
  anniversaryAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  anniversaryAddText: { fontSize: 13, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerText: { fontSize: 13, flex: 1 },
  sessionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitle: { fontSize: 14, fontWeight: '600' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrap: {
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -14 }, { translateY: -14 }],
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeText: { color: '#fff', fontSize: 11, marginLeft: 2 },
  gpsBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gpsBadgeText: { color: '#fff', fontSize: 11 },
  layoutRow: { gap: 8 },
  layoutLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  layoutChips: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    gap: 4,
  },
  layoutChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  layoutChipText: { fontSize: 13, fontWeight: '500' },
  addBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    flex: 1,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addBtnText: { fontSize: 13 },
  addSessionBtn: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 4,
  },
  addSessionText: { fontSize: 14, fontWeight: '600' },
  addSessionSub: { fontSize: 12, textAlign: 'center' },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  aiHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  aiModelHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  bodyInput: {
    minHeight: 200,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    lineHeight: 22,
  },
  sessionBodyInput: {
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 80,
  },
});
