import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { importBackup } from '@/src/services/backup';

export default function ImportScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [restoring, setRestoring] = useState(false);

  const startRestore = async () => {
    const pick = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed'],
      copyToCacheDirectory: true,
    });
    if (pick.canceled) return;
    const file = pick.assets[0];

    Alert.alert(
      '복원 확인',
      '복원하면 현재 기기의 모든 일기와 사진이 백업 파일 내용으로 교체됩니다. 계속하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              const result = await importBackup(file.uri);
              if (result.ok) {
                Alert.alert(
                  '복원 완료',
                  `아기 ${result.stats.babies}명, 일기 ${result.stats.diaries}개, 사진 ${result.stats.photos}장이 복원됐어요.`,
                  [{ text: '확인', onPress: () => router.replace('/') }]
                );
              } else {
                Alert.alert('복원 실패', result.message);
              }
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={[styles.title, { color: palette.text }]}>가져오기</Text>

        <View
          style={[
            styles.warning,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.warning,
            },
          ]}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={18}
            color={palette.warning}
          />
          <Text style={[styles.warningText, { color: palette.text }]}>
            복원하면 현재 기기의 모든 일기와 사진이 **완전히 교체**됩니다. 현재
            데이터를 먼저 백업해두는 걸 권장드려요.
          </Text>
        </View>

        <Pressable
          onPress={startRestore}
          disabled={restoring}
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: palette.text }]}>
              백업 파일 선택
            </Text>
            <Text style={[styles.cardSub, { color: palette.textMuted }]}>
              .zip 파일을 선택하면 복원이 시작됩니다
            </Text>
          </View>
          {restoring && <ActivityIndicator color={palette.tint} />}
        </Pressable>

        {restoring && (
          <Text style={[styles.restoringText, { color: palette.textMuted }]}>
            복원 중... 사진이 많으면 시간이 걸릴 수 있어요
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700' },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 20 },
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
  restoringText: { textAlign: 'center', fontSize: 13 },
});
