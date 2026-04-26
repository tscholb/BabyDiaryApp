import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AnniversaryPicker,
  type AnniversaryDraft,
} from '@/src/components/AnniversaryPicker';
import { getBaby } from '@/src/db/babies';
import {
  createAnniversary,
  deleteAnniversary,
  listAnniversaries,
  updateAnniversary,
} from '@/src/db/anniversaries';
import type { Anniversary, Baby } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { prettyDate, todayISO } from '@/src/utils/date';
import { safeBack } from '@/src/utils/navigation';

export default function AnniversariesScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [baby, setBaby] = useState<Baby | null>(null);
  const [items, setItems] = useState<Anniversary[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<Anniversary | null>(null);

  const reload = useCallback(async () => {
    const id = await getActiveBabyId();
    if (!id) {
      setBaby(null);
      setItems([]);
      return;
    }
    const [b, list] = await Promise.all([
      getBaby(id),
      listAnniversaries(id),
    ]);
    setBaby(b);
    setItems(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleSave = async (draft: AnniversaryDraft) => {
    if (!baby) return;
    if (editing) {
      await updateAnniversary(editing.id, {
        name: draft.name,
        icon: draft.icon,
        category: draft.category,
        date: draft.date,
        notes: draft.notes,
      });
    } else {
      await createAnniversary({
        babyId: baby.id,
        name: draft.name,
        icon: draft.icon,
        category: draft.category,
        date: draft.date,
        notes: draft.notes,
      });
    }
    setPickerOpen(false);
    setEditing(null);
    reload();
  };

  const handleDelete = (item: Anniversary) => {
    Alert.alert('기념일 삭제', `${item.icon} ${item.name}을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteAnniversary(item.id);
          reload();
        },
      },
    ]);
  };

  if (!baby) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: palette.background }]}
        edges={['top']}>
        <Text style={{ color: palette.textMuted }}>
          먼저 아기 프로필을 만들어주세요
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.background }}
      edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Text style={[styles.headerBtn, { color: palette.textMuted }]}>
            뒤로
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>기념일</Text>
        <Pressable
          onPress={() => {
            setEditing(null);
            setPickerOpen(true);
          }}
          hitSlop={12}>
          <Text style={[styles.headerBtn, { color: palette.tint }]}>+ 추가</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              아직 기념일이 없어요
            </Text>
            <Text style={[styles.emptyBody, { color: palette.textMuted }]}>
              100일, 첫 걸음, 첫 어린이집…{'\n'}기억하고 싶은 순간을 남겨보세요.
            </Text>
            <Pressable
              onPress={() => {
                setEditing(null);
                setPickerOpen(true);
              }}
              style={[
                styles.primaryBtn,
                { backgroundColor: palette.tint },
              ]}>
              <Text style={styles.primaryBtnText}>첫 기념일 추가하기</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => handleDelete(item)}
            onPress={() => {
              if (item.diaryId) {
                router.push(`/diary/${item.diaryId}`);
              } else {
                setEditing(item);
                setPickerOpen(true);
              }
            }}
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            <Text style={styles.cardEmoji}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: palette.text }]}>
                {item.name}
              </Text>
              <Text style={[styles.cardMeta, { color: palette.textMuted }]}>
                {prettyDate(item.date)} ·{' '}
                {getBabyAgeLabel(baby.birthDate, new Date(item.date))}
              </Text>
              {item.notes ? (
                <Text
                  numberOfLines={2}
                  style={[styles.cardNotes, { color: palette.text }]}>
                  {item.notes}
                </Text>
              ) : null}
              {item.diaryId ? (
                <Text style={[styles.cardLink, { color: palette.tint }]}>
                  연결된 일기 보기 →
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      <AnniversaryPicker
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initialDate={editing?.date ?? todayISO()}
        allowDateEdit
        initial={editing}
      />
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
  title: { fontSize: 17, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  cardEmoji: { fontSize: 28, lineHeight: 32 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 2 },
  cardNotes: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  cardLink: { fontSize: 12, marginTop: 6 },
});
