import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

type Palette = typeof Colors.light;

type Props = {
  month: Date;
  palette: Palette;
  markedDates: Set<string>;
  selectedDate: string | null;
  onChangeMonth: (next: Date) => void;
  onSelectDate: (iso: string) => void;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function CalendarGrid({
  month,
  palette,
  markedDates,
  selectedDate,
  onChangeMonth,
  onSelectDate,
}: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const today = new Date();

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.header}>
        <Pressable onPress={() => onChangeMonth(subMonths(month, 1))} hitSlop={12}>
          <Text style={[styles.arrow, { color: palette.tint }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>
          {format(month, 'yyyy년 M월')}
        </Text>
        <Pressable onPress={() => onChangeMonth(addMonths(month, 1))} hitSlop={12}>
          <Text style={[styles.arrow, { color: palette.tint }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.weekday,
              {
                color:
                  i === 0
                    ? palette.danger
                    : i === 6
                    ? palette.tint
                    : palette.textMuted,
              },
            ]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map(day => {
          const iso = format(day, 'yyyy-MM-dd');
          const isCurMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate === iso;
          const hasEntry = markedDates.has(iso);
          const dayOfWeek = day.getDay();
          const dayColor = !isCurMonth
            ? palette.textMuted
            : dayOfWeek === 0
            ? palette.danger
            : dayOfWeek === 6
            ? palette.tint
            : palette.text;

          return (
            <Pressable
              key={iso}
              onPress={() => onSelectDate(iso)}
              style={styles.cell}>
              <View
                style={[
                  styles.dayWrap,
                  isSelected && { backgroundColor: palette.tint },
                  !isSelected && isToday && {
                    borderWidth: 1,
                    borderColor: palette.tint,
                  },
                ]}>
                <Text
                  style={[
                    styles.dayNum,
                    {
                      color: isSelected ? '#fff' : dayColor,
                      opacity: isCurMonth ? 1 : 0.35,
                    },
                  ]}>
                  {day.getDate()}
                </Text>
              </View>
              {hasEntry && (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isSelected ? '#fff' : palette.tint,
                    },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  title: { fontSize: 18, fontWeight: '700' },
  arrow: { fontSize: 28, paddingHorizontal: 12, lineHeight: 30 },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 14, fontWeight: '500' },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
