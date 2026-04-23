import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { getBaby, updateBaby } from '@/src/db/babies';
import { safeBack } from '@/src/utils/navigation';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function EditBabyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const babyId = Number(id);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const baby = await getBaby(babyId);
      if (baby) {
        setName(baby.name);
        setBirthDate(baby.birthDate);
      }
    })();
  }, [babyId]);

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
      await updateBaby(babyId, { name: name.trim(), birthDate });
      safeBack();
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <Text style={[styles.title, { color: palette.text }]}>프로필 수정</Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.textMuted }]}>이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
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
