import { endOfMonth, format, startOfMonth } from 'date-fns';
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

import { CalendarGrid } from '@/src/components/CalendarGrid';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaby } from '@/src/db/babies';
import { listDiariesInRange } from '@/src/db/diaries';
import type { Baby, DiaryWithPhotos } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { prettyDate, todayISO } from '@/src/utils/date';

export default function CalendarScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [baby, setBaby] = useState<Baby | null>(null);
  const [month, setMonth] = useState(new Date());
  const [monthDiaries, setMonthDiaries] = useState<DiaryWithPhotos[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());

  const reload = useCallback(async () => {
    const id = await getActiveBabyId();
    if (!id) {
      setBaby(null);
      setMonthDiaries([]);
      return;
    }
    const b = await getBaby(id);
    setBaby(b);
    const start = format(startOfMonth(month), 'yyyy-MM-dd');
    const end = format(endOfMonth(month), 'yyyy-MM-dd');
    setMonthDiaries(await listDiariesInRange(id, start, end));
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const markedDates = new Set(monthDiaries.map(d => d.entryDate));
  const selectedDiaries = monthDiaries.filter(d => d.entryDate === selectedDate);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <View style={{ padding: 16 }}>
        <CalendarGrid
          month={month}
          palette={palette}
          markedDates={markedDates}
          selectedDate={selectedDate}
          onChangeMonth={setMonth}
          onSelectDate={setSelectedDate}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={styles.selectedHeader}>
        <View>
          <Text style={[styles.selectedDate, { color: palette.text }]}>
            {prettyDate(selectedDate)}
          </Text>
          <Text style={[styles.selectedAge, { color: palette.textMuted }]}>
            {getBabyAgeLabel(baby.birthDate, new Date(selectedDate))}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/diary/new?date=${selectedDate}`)}
          style={[styles.writeBtn, { backgroundColor: palette.tint }]}>
          <Text style={styles.writeBtnText}>
            {selectedDiaries.length > 0 ? '+ 추가' : '+ 작성'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={selectedDiaries}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <Text
            style={[styles.emptyHint, { color: palette.textMuted }]}>
            이 날의 기록이 아직 없어요
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/diary/${item.id}`)}
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            {item.photos[0] && (
              <Image
                source={{
                  uri:
                    item.photos[0].mediaType === 'video'
                      ? item.photos[0].thumbnailUri ?? item.photos[0].uri
                      : item.photos[0].uri,
                }}
                style={styles.thumb}
              />
            )}
            <Text
              numberOfLines={3}
              style={[styles.cardBody, { color: palette.text }]}>
              {item.body || '(내용 없음)'}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  selectedDate: { fontSize: 17, fontWeight: '700' },
  selectedAge: { fontSize: 12, marginTop: 2 },
  writeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  writeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyHint: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 32,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  cardBody: { flex: 1, fontSize: 14, lineHeight: 20 },
});
