import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaby } from '@/src/db/babies';
import { createDiary, getDiary, updateDiary } from '@/src/db/diaries';
import { generateDiaryFromPhotos } from '@/src/services/ai';
import { getAiSettings } from '@/src/services/aiSettings';
import { deletePhoto, persistPhoto } from '@/src/services/photoStorage';
import type { Baby } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { parseExifDate, parseExifDateTime, prettyDate, todayISO } from '@/src/utils/date';
import { safeBack } from '@/src/utils/navigation';
import { groupPhotosBySession } from '@/src/utils/sessions';

const MAX_PHOTOS_PER_SESSION = 6;
const MAX_SESSIONS = 5;

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
  const [capturedAtByUri, setCapturedAtByUri] = useState<
    Record<string, string | null>
  >({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [dateAutoSet, setDateAutoSet] = useState(false);
  const [userTouchedDate, setUserTouchedDate] = useState(
    Boolean(date) || Boolean(id)
  );
  const [customRequest, setCustomRequest] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);

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
          const grouped = groupPhotosBySession(diary.photos);
          const initial = grouped.length > 0 ? grouped : [[]];
          setSessions(initial.map(s => [...s]));
          setOriginalSessions(initial.map(s => [...s]));

          const existingCapturedAt: Record<string, string | null> = {};
          for (const p of diary.photos) {
            existingCapturedAt[p.uri] = p.capturedAt;
          }
          setCapturedAtByUri(existingCapturedAt);
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

  const pickPhotos = async (sIdx: number) => {
    const remaining = MAX_PHOTOS_PER_SESSION - sessions[sIdx].length;
    if (remaining <= 0) {
      Alert.alert(`한 세션에 최대 ${MAX_PHOTOS_PER_SESSION}장까지 넣을 수 있어요`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진첩 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
      exif: true,
    });
    if (result.canceled) return;
    try {
      const storedWithExif = await Promise.all(
        result.assets.map(async a => ({
          uri: await persistPhoto(a.uri),
          capturedAt: parseExifDateTime(
            a.exif as Record<string, unknown> | null
          ),
        }))
      );
      setSessions(prev =>
        prev.map((s, i) =>
          i === sIdx ? [...s, ...storedWithExif.map(x => x.uri)] : s
        )
      );
      setCapturedAtByUri(prev => {
        const next = { ...prev };
        for (const { uri, capturedAt } of storedWithExif) {
          next[uri] = capturedAt;
        }
        return next;
      });
      maybeApplyExifDate(result.assets);
    } catch (e) {
      Alert.alert('사진 저장 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const takePhoto = async (sIdx: number) => {
    if (sessions[sIdx].length >= MAX_PHOTOS_PER_SESSION) {
      Alert.alert(`한 세션에 최대 ${MAX_PHOTOS_PER_SESSION}장까지 넣을 수 있어요`);
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
      const stored = await persistPhoto(asset.uri);
      const capturedAt =
        parseExifDateTime(asset.exif as Record<string, unknown> | null) ??
        new Date().toISOString();
      addPhotoToSession(sIdx, stored);
      setCapturedAtByUri(prev => ({ ...prev, [stored]: capturedAt }));
      maybeApplyExifDate(result.assets);
    } catch (e) {
      Alert.alert('사진 저장 실패', e instanceof Error ? e.message : String(e));
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
            if (!editingId) {
              await Promise.all(toRemove.map(u => deletePhoto(u)));
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
      const result = await generateDiaryFromPhotos({
        photoSessions: sessions,
        capturedAtByUri,
        babyName: baby.name,
        babyAgeLabel: ageLabel,
        entryDate,
        customRequest: customRequest.trim() || undefined,
      });
      if (result.ok) {
        setBody(result.text);
        setAiUsed(true);
      } else {
        setBanner(result.message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!baby) return;
    if (!body.trim() && allPhotos.length === 0) {
      Alert.alert('사진이나 내용 중 하나는 있어야 해요');
      return;
    }
    setSaving(true);
    try {
      const cleanedSessions = sessions.map(s => [...s]);
      if (editingId) {
        await updateDiary(editingId, {
          body: body.trim(),
          entryDate,
          photoSessions: cleanedSessions,
          capturedAtByUri,
        });
        const originalUris = originalSessions.flat();
        const currentUris = allPhotos;
        const removed = originalUris.filter(u => !currentUris.includes(u));
        await Promise.all(removed.map(u => deletePhoto(u)));
      } else {
        await createDiary({
          babyId: baby.id,
          entryDate,
          body: body.trim(),
          photoSessions: cleanedSessions,
          capturedAtByUri,
          aiGenerated: aiUsed,
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
      await Promise.all(toDiscard.map(u => deletePhoto(u)));
    }
    safeBack();
  };

  if (!baby) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
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
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled">
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

          {sessions.map((photos, sIdx) => (
            <SessionCard
              key={sIdx}
              index={sIdx}
              total={sessions.length}
              photos={photos}
              palette={palette}
              onPick={() => pickPhotos(sIdx)}
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
                onPress={() => setRequestOpen(v => !v)}
                style={styles.requestToggle}>
                <Text
                  style={[styles.requestToggleText, { color: palette.tint }]}>
                  {requestOpen
                    ? '− 요청사항 닫기'
                    : customRequest.trim()
                    ? `+ 요청사항 (${customRequest.trim().length}자)`
                    : '+ 이번 일기에만 적용할 요청사항 추가'}
                </Text>
              </Pressable>

              {requestOpen && (
                <TextInput
                  value={customRequest}
                  onChangeText={setCustomRequest}
                  placeholder="예: 오늘은 짧고 담백하게, 감탄사 없이"
                  placeholderTextColor={palette.textMuted}
                  multiline
                  style={[
                    styles.requestInput,
                    {
                      backgroundColor: palette.surface,
                      color: palette.text,
                      borderColor: palette.border,
                    },
                  ]}
                />
              )}

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
                    : body
                    ? 'AI 초안 다시 생성'
                    : nonEmptySessionCount > 1
                    ? `AI 초안 생성 (${nonEmptySessionCount}개 세션)`
                    : 'AI 초안 생성'}
                </Text>
              </Pressable>
            </View>
          )}

          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="오늘 아기의 모습을 기록해보세요..."
            placeholderTextColor={palette.textMuted}
            style={[
              styles.bodyInput,
              {
                backgroundColor: palette.surface,
                color: palette.text,
                borderColor: palette.border,
              },
            ]}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SessionCard({
  index,
  total,
  photos,
  palette,
  onPick,
  onCapture,
  onRemovePhoto,
  onRemoveSession,
}: {
  index: number;
  total: number;
  photos: string[];
  palette: typeof Colors.light;
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
        {photos.map(uri => (
          <View key={uri} style={styles.photoWrap}>
            <Image source={{ uri }} style={styles.photoThumb} />
            <Pressable
              onPress={() => onRemovePhoto(uri)}
              style={[styles.removeBtn, { backgroundColor: palette.surface }]}
              hitSlop={8}>
              <IconSymbol name="trash" size={14} color={palette.danger} />
            </Pressable>
          </View>
        ))}
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
  requestToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  requestToggleText: { fontSize: 13, fontWeight: '600' },
  requestInput: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  bodyInput: {
    minHeight: 200,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    lineHeight: 22,
  },
});
