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
import { parseExifDate, prettyDate, todayISO } from '@/src/utils/date';
import { safeBack } from '@/src/utils/navigation';

const MAX_PHOTOS = 8;

export default function DiaryEditorScreen() {
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const editingId = id ? Number(id) : null;
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [baby, setBaby] = useState<Baby | null>(null);
  const [entryDate, setEntryDate] = useState(date ?? todayISO());
  const [body, setBody] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [originalPhotoUris, setOriginalPhotoUris] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [dateAutoSet, setDateAutoSet] = useState(false);
  const [userTouchedDate, setUserTouchedDate] = useState(
    Boolean(date) || Boolean(id)
  );

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
          const uris = diary.photos.map(p => p.uri);
          setPhotoUris(uris);
          setOriginalPhotoUris(uris);
        }
      }
    })();
  }, [editingId, router]);

  const ageLabel = useMemo(() => {
    if (!baby) return '';
    return getBabyAgeLabel(baby.birthDate, new Date(entryDate));
  }, [baby, entryDate]);

  const pickPhotos = async () => {
    const remaining = MAX_PHOTOS - photoUris.length;
    if (remaining <= 0) {
      Alert.alert(`사진은 최대 ${MAX_PHOTOS}장까지 추가할 수 있어요`);
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
      const stored = await Promise.all(
        result.assets.map(a => persistPhoto(a.uri))
      );
      setPhotoUris(prev => [...prev, ...stored]);
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

  const takePhoto = async () => {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert(`사진은 최대 ${MAX_PHOTOS}장까지 추가할 수 있어요`);
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
      const stored = await persistPhoto(result.assets[0].uri);
      setPhotoUris(prev => [...prev, stored]);
      maybeApplyExifDate(result.assets);
    } catch (e) {
      Alert.alert('사진 저장 실패', e instanceof Error ? e.message : String(e));
    }
  };

  const removePhoto = (uri: string) => {
    setPhotoUris(prev => prev.filter(u => u !== uri));
  };

  const generateAiDraft = async () => {
    if (!baby) return;
    if (photoUris.length === 0) {
      Alert.alert('사진을 먼저 추가해주세요');
      return;
    }
    setGenerating(true);
    setBanner(null);
    try {
      const result = await generateDiaryFromPhotos({
        photoUris,
        babyName: baby.name,
        babyAgeLabel: ageLabel,
        entryDate,
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
    if (!body.trim() && photoUris.length === 0) {
      Alert.alert('사진이나 내용 중 하나는 있어야 해요');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateDiary(editingId, { body: body.trim(), entryDate, photoUris });
        const removed = originalPhotoUris.filter(u => !photoUris.includes(u));
        await Promise.all(removed.map(u => deletePhoto(u)));
      } else {
        await createDiary({
          babyId: baby.id,
          entryDate,
          body: body.trim(),
          photoUris,
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
      const toDiscard = photoUris.filter(u => !originalPhotoUris.includes(u));
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
            <View>
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

          <View style={styles.photoGrid}>
            {photoUris.map(uri => (
              <View key={uri} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <Pressable
                  onPress={() => removePhoto(uri)}
                  style={[styles.removeBtn, { backgroundColor: palette.surface }]}
                  hitSlop={8}>
                  <IconSymbol name="trash" size={16} color={palette.danger} />
                </Pressable>
              </View>
            ))}
            {photoUris.length < MAX_PHOTOS && (
              <View style={styles.addBtnRow}>
                <Pressable
                  onPress={pickPhotos}
                  style={[
                    styles.addBtn,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}>
                  <IconSymbol
                    name="photo.on.rectangle"
                    size={22}
                    color={palette.tint}
                  />
                  <Text style={[styles.addBtnText, { color: palette.text }]}>
                    사진첩
                  </Text>
                </Pressable>
                <Pressable
                  onPress={takePhoto}
                  style={[
                    styles.addBtn,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}>
                  <IconSymbol name="camera.fill" size={22} color={palette.tint} />
                  <Text style={[styles.addBtnText, { color: palette.text }]}>
                    촬영
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {aiEnabled && (
            <Pressable
              onPress={generateAiDraft}
              disabled={generating || photoUris.length === 0}
              style={[
                styles.aiBtn,
                {
                  backgroundColor:
                    photoUris.length === 0 ? palette.surfaceAlt : palette.tint,
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
                  : 'AI 초안 생성'}
              </Text>
            </Pressable>
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
    borderRadius: 10,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  addBtn: {
    flex: 1,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBtnText: { fontSize: 12 },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bodyInput: {
    minHeight: 200,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    lineHeight: 22,
  },
});
