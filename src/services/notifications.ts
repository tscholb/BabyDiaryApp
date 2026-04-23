import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { AiProvider } from '../types';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

type NotificationsModule = typeof import('expo-notifications');
let notificationsPromise: Promise<NotificationsModule | null> | null = null;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!notificationsPromise) {
    notificationsPromise = import('expo-notifications')
      .then(mod => {
        mod.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        return mod;
      })
      .catch(() => null);
  }
  return notificationsPromise;
}

export function isNotificationsAvailable(): boolean {
  return !isExpoGo;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const N = await getNotifications();
  if (!N) return false;
  const { status } = await N.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await N.requestPermissionsAsync();
  return req.status === 'granted';
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  const N = await getNotifications();
  if (!N) return;
  await N.setNotificationChannelAsync('ai-status', {
    name: 'AI 상태 알림',
    importance: N.AndroidImportance.DEFAULT,
  });
}

const AI_RESET_IDENTIFIER_PREFIX = 'ai-rate-limit-reset-';

export async function scheduleRateLimitResetNotification(
  provider: AiProvider,
  resetAt: Date
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return;
  await ensureAndroidChannel();

  const identifier = `${AI_RESET_IDENTIFIER_PREFIX}${provider}`;
  await N.cancelScheduledNotificationAsync(identifier).catch(() => {});

  if (resetAt.getTime() <= Date.now()) return;

  await N.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'AI 사용량이 리셋됐어요 ✨',
      body: '다시 AI 자동 작성을 사용할 수 있어요.',
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: resetAt,
      channelId: Platform.OS === 'android' ? 'ai-status' : undefined,
    },
  });
}

export async function cancelRateLimitNotification(
  provider: AiProvider
): Promise<void> {
  const N = await getNotifications();
  if (!N) return;
  await N.cancelScheduledNotificationAsync(
    `${AI_RESET_IDENTIFIER_PREFIX}${provider}`
  ).catch(() => {});
}
