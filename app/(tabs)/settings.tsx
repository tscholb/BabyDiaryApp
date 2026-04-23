import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBaby } from '@/src/db/babies';
import { getAiSettings, updateAiSettings } from '@/src/services/aiSettings';
import {
  cancelRateLimitNotification,
  ensureNotificationPermission,
} from '@/src/services/notifications';
import type { AiSettings, Baby } from '@/src/types';
import { getActiveBabyId } from '@/src/utils/activeBaby';

export default function SettingsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [baby, setBaby] = useState<Baby | null>(null);
  const [ai, setAi] = useState<AiSettings | null>(null);

  const reload = useCallback(async () => {
    const id = await getActiveBabyId();
    setBaby(id ? await getBaby(id) : null);
    setAi(await getAiSettings());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const toggleAi = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(
          '알림 권한이 필요해요',
          'AI 사용량 리셋 알림을 보내려면 알림 권한을 허용해주세요.'
        );
      }
    } else {
      await Promise.all([
        cancelRateLimitNotification('gemini'),
        cancelRateLimitNotification('claude'),
        cancelRateLimitNotification('openai'),
      ]);
    }
    const next = await updateAiSettings({ enabled });
    setAi(next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        <Text style={[styles.title, { color: palette.text }]}>설정</Text>

        <Section title="아기 프로필" palette={palette}>
          {baby ? (
            <Row
              palette={palette}
              label={baby.name}
              sublabel={baby.birthDate}
              onPress={() => router.push(`/baby/${baby.id}/edit`)}
            />
          ) : (
            <Row
              palette={palette}
              label="프로필 만들기"
              onPress={() => router.push('/baby/new')}
            />
          )}
        </Section>

        <Section title="AI 자동 작성" palette={palette}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.rowLabel, { color: palette.text }]}>
                  AI 자동 작성
                </Text>
                <Text style={[styles.rowSub, { color: palette.textMuted }]}>
                  사진을 분석해 하루 요약 초안을 만들어드려요
                </Text>
              </View>
              <Switch
                value={ai?.enabled ?? false}
                onValueChange={toggleAi}
                trackColor={{ true: palette.tint }}
              />
            </View>
          </View>

          <Row
            palette={palette}
            label="AI 설정"
            sublabel={ai ? `${providerLabel(ai.provider)} · ${statusLabel(ai)}` : ''}
            onPress={() => router.push('/settings/ai')}
          />
        </Section>

        <Section title="데이터" palette={palette}>
          <Row
            palette={palette}
            label="내보내기 / 백업"
            sublabel="PDF 또는 zip으로 저장"
            onPress={() => router.push('/settings/export')}
          />
          <Row
            palette={palette}
            label="가져오기 / 복원"
            sublabel="백업 파일에서 복원"
            onPress={() => router.push('/settings/import')}
          />
        </Section>

        <Text style={[styles.footer, { color: palette.textMuted }]}>
          버전 0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: typeof Colors.light;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Row({
  label,
  sublabel,
  onPress,
  palette,
}: {
  label: string;
  sublabel?: string;
  onPress?: () => void;
  palette: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.rowSub, { color: palette.textMuted }]}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

function providerLabel(p: AiSettings['provider']) {
  if (p === 'gemini') return 'Gemini';
  if (p === 'claude') return 'Claude';
  return 'OpenAI';
}

function statusLabel(s: AiSettings) {
  if (!s.enabled) return '꺼짐';
  switch (s.keyStatus) {
    case 'ok': return '정상';
    case 'invalid': return '키 오류';
    case 'rate_limited': return '한도 초과';
    default: return '미설정';
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
