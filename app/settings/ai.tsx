import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getAiSettings,
  getApiKey,
  setApiKey,
  updateAiSettings,
} from '@/src/services/aiSettings';
import type { AiProvider, AiSettings } from '@/src/types';

const PROVIDERS: { id: AiProvider; label: string; hint: string }[] = [
  { id: 'gemini', label: 'Gemini (무료 추천)', hint: 'aistudio.google.com에서 무료 발급' },
  { id: 'claude', label: 'Claude', hint: 'console.anthropic.com' },
  { id: 'openai', label: 'OpenAI', hint: 'platform.openai.com' },
];

export default function AiSettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [currentKeyPresent, setCurrentKeyPresent] = useState(false);
  const [styleInput, setStyleInput] = useState('');

  const reload = useCallback(async () => {
    const s = await getAiSettings();
    setSettings(s);
    const k = await getApiKey(s.provider);
    setCurrentKeyPresent(!!k);
    setKeyInput('');
    setStyleInput(s.customStyle ?? '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (!settings) return null;

  const selectProvider = async (p: AiProvider) => {
    const next = await updateAiSettings({ provider: p, keyStatus: 'unknown' });
    setSettings(next);
    const k = await getApiKey(p);
    setCurrentKeyPresent(!!k);
    setKeyInput('');
  };

  const saveKey = async () => {
    if (!keyInput.trim()) {
      Alert.alert('API 키를 입력해주세요');
      return;
    }
    await setApiKey(settings.provider, keyInput.trim());
    await updateAiSettings({ keyStatus: 'unknown', rateLimitResetAt: null });
    Alert.alert('저장되었어요');
    reload();
  };

  const saveStyle = async () => {
    const next = await updateAiSettings({ customStyle: styleInput.trim() });
    setSettings(next);
    Alert.alert('저장되었어요');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <Text style={[styles.title, { color: palette.text }]}>AI 설정</Text>

        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: palette.textMuted }]}>
            제공자 선택
          </Text>
          {PROVIDERS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => selectProvider(p.id)}
              style={[
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: settings.provider === p.id ? palette.tint : palette.border,
                  borderWidth: settings.provider === p.id ? 2 : StyleSheet.hairlineWidth,
                },
              ]}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>
                {p.label}
              </Text>
              <Text style={[styles.rowSub, { color: palette.textMuted }]}>
                {p.hint}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: palette.textMuted }]}>
            API 키
          </Text>
          {currentKeyPresent && (
            <Text style={[styles.rowSub, { color: palette.textMuted }]}>
              저장된 키가 있어요. 새 키를 입력하면 덮어씁니다.
            </Text>
          )}
          <TextInput
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="sk-... 또는 AIzaSy..."
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border },
            ]}
          />
          <Pressable
            onPress={saveKey}
            style={[styles.primaryBtn, { backgroundColor: palette.tint }]}>
            <Text style={styles.primaryBtnText}>키 저장</Text>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: palette.textMuted }]}>
            말투 / 스타일 (선택)
          </Text>
          <Text style={[styles.rowSub, { color: palette.textMuted }]}>
            AI가 일기 초안을 쓸 때 참고할 스타일을 자유롭게 적어주세요. 예: &quot;INFJ
            느낌으로 감성적이게&quot;, &quot;짧고 담백하게&quot;, &quot;구어체로 친근하게&quot;
          </Text>
          <TextInput
            value={styleInput}
            onChangeText={setStyleInput}
            placeholder="예: 감성적이고 시적인 느낌으로 써줘"
            placeholderTextColor={palette.textMuted}
            multiline
            style={[
              styles.styleInput,
              {
                backgroundColor: palette.surface,
                color: palette.text,
                borderColor: palette.border,
              },
            ]}
          />
          <Pressable
            onPress={saveStyle}
            style={[styles.primaryBtn, { backgroundColor: palette.tint }]}>
            <Text style={styles.primaryBtnText}>스타일 저장</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>상태</Text>
          <Text style={[styles.rowSub, { color: palette.textMuted }]}>
            {describe(settings, currentKeyPresent)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function describe(s: AiSettings, hasKey: boolean): string {
  if (!hasKey) return 'API 키가 저장되지 않았어요';
  switch (s.keyStatus) {
    case 'ok': return '정상 작동 중';
    case 'invalid': return 'API 키가 유효하지 않아요. 새 키를 입력해주세요.';
    case 'rate_limited':
      return s.rateLimitResetAt
        ? `사용량 초과 — ${new Date(s.rateLimitResetAt).toLocaleString('ko-KR')}에 리셋 예정`
        : '사용량 초과';
    default: return '키 저장됨 · 첫 사용 시 자동 검증';
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  input: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  styleInput: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
