import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AiProvider } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('ai-status', {
    name: 'AI 상태 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

const AI_RESET_IDENTIFIER_PREFIX = 'ai-rate-limit-reset-';

export async function scheduleRateLimitResetNotification(
  provider: AiProvider,
  resetAt: Date
): Promise<void> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return;
  await ensureAndroidChannel();

  const identifier = `${AI_RESET_IDENTIFIER_PREFIX}${provider}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

  if (resetAt.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'AI 사용량이 리셋됐어요 ✨',
      body: '다시 AI 자동 작성을 사용할 수 있어요.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: resetAt,
      channelId: Platform.OS === 'android' ? 'ai-status' : undefined,
    },
  });
}

export async function cancelRateLimitNotification(
  provider: AiProvider
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(
    `${AI_RESET_IDENTIFIER_PREFIX}${provider}`
  ).catch(() => {});
}
