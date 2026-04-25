import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaby } from '@/src/db/babies';
import { listDiaries, listDiariesInRange } from '@/src/db/diaries';
import { exportBackup } from '@/src/services/backup';
import { exportDiariesAsPdf } from '@/src/services/pdfExport';
import type { Baby } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';

export default function ExportScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [baby, setBaby] = useState<Baby | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const id = await getActiveBabyId();
        setBaby(id ? await getBaby(id) : null);
      })();
    }, [])
  );

  const exportMonth = async (offsetMonths: number) => {
    if (!baby) return;
    const target = addMonths(new Date(), offsetMonths);
    const start = format(startOfMonth(target), 'yyyy-MM-dd');
    const end = format(endOfMonth(target), 'yyyy-MM-dd');
    const title = format(target, 'yyyy년 M월');
    await doExport(baby, start, end, title, `month-${offsetMonths}`);
  };

  const exportAll = async () => {
    if (!baby) return;
    setExporting('all');
    try {
      const diaries = await listDiaries(baby.id);
      const result = await exportDiariesAsPdf({
        baby,
        diaries,
        title: '전체 기록',
      });
      if (!result.ok) {
        Alert.alert('내보내기 실패', result.message);
      }
    } finally {
      setExporting(null);
    }
  };

  const exportZipBackup = async () => {
    setExporting('zip');
    try {
      const result = await exportBackup();
      if (!result.ok) {
        Alert.alert('백업 실패', result.message);
      } else {
        Alert.alert(
          '백업 완료',
          `아기 ${result.stats.babies}명, 일기 ${result.stats.diaries}개, 사진 ${result.stats.photos}장이 포함됐어요.`
        );
      }
    } finally {
      setExporting(null);
    }
  };

  const doExport = async (
    b: Baby,
    start: string,
    end: string,
    title: string,
    key: string
  ) => {
    setExporting(key);
    try {
      const diaries = await listDiariesInRange(b.id, start, end);
      const result = await exportDiariesAsPdf({ baby: b, diaries, title });
      if (!result.ok) {
        Alert.alert('내보내기 실패', result.message);
      }
    } finally {
      setExporting(null);
    }
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

  const now = new Date();
  const lastMonth = subMonths(now, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={[styles.title, { color: palette.text }]}>내보내기</Text>
        <Text style={[styles.desc, { color: palette.textMuted }]}>
          선택한 기간의 일기를 PDF로 만들어 공유할 수 있어요. 카톡, 이메일,
          클라우드 드라이브 어디든 저장 가능합니다.
        </Text>

        <Option
          palette={palette}
          label={`이번 달 (${format(now, 'M월')})`}
          sublabel="오늘까지의 이번 달 기록"
          loading={exporting === 'month-0'}
          disabled={exporting !== null}
          onPress={() => exportMonth(0)}
        />

        <Option
          palette={palette}
          label={`지난 달 (${format(lastMonth, 'M월')})`}
          sublabel="한 달 전체 기록"
          loading={exporting === 'month--1'}
          disabled={exporting !== null}
          onPress={() => exportMonth(-1)}
        />

        <Option
          palette={palette}
          label="전체 기록"
          sublabel="지금까지 작성한 모든 일기"
          loading={exporting === 'all'}
          disabled={exporting !== null}
          onPress={exportAll}
        />

        <View style={{ height: 16 }} />
        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
          전체 백업
        </Text>
        <Text style={[styles.desc, { color: palette.textMuted }]}>
          복원을 위한 zip 파일을 만듭니다. 기기 변경 시 "가져오기"로 복원할 수
          있어요.
        </Text>
        <Option
          palette={palette}
          label="백업 파일 (.zip) 내보내기"
          sublabel="모든 일기 + 사진 + 설정"
          loading={exporting === 'zip'}
          disabled={exporting !== null}
          onPress={exportZipBackup}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Option({
  palette,
  label,
  sublabel,
  loading,
  disabled,
  onPress,
}: {
  palette: typeof Colors.light;
  label: string;
  sublabel?: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.5 : 1,
        },
      ]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardLabel, { color: palette.text }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.cardSub, { color: palette.textMuted }]}>
            {sublabel}
          </Text>
        )}
      </View>
      {loading && <ActivityIndicator color={palette.tint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  desc: { fontSize: 13, lineHeight: 20 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardLabel: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 13, marginTop: 4 },
});
