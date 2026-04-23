import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createBaby } from '@/src/db/babies';
import { setActiveBabyId } from '@/src/utils/activeBaby';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function NewBabyScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('이름을 입력해주세요');
      return;
    }
    if (!DATE_REGEX.test(birthDate)) {
      Alert.alert('생일을 YYYY-MM-DD 형식으로 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      const baby = await createBaby({ name: name.trim(), birthDate });
      await setActiveBabyId(baby.id);
      router.replace('/');
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <Text style={[styles.title, { color: palette.text }]}>
        아기 프로필 만들기
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.textMuted }]}>이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예) 민준"
          placeholderTextColor={palette.textMuted}
          style={[
            styles.input,
            { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.textMuted }]}>생일</Text>
        <TextInput
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          style={[
            styles.input,
            { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border },
          ]}
        />
      </View>

      <Pressable
        onPress={submit}
        disabled={saving}
        style={[styles.primaryBtn, { backgroundColor: palette.tint, opacity: saving ? 0.6 : 1 }]}>
        <Text style={styles.primaryBtnText}>{saving ? '저장 중...' : '저장'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  field: { gap: 6 },
  label: { fontSize: 13 },
  input: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  primaryBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
