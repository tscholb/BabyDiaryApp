import * as SecureStore from 'expo-secure-store';
import { kvGetJSON, kvSetJSON } from '../db/kv';
import type { AiProvider, AiSettings } from '../types';

const SETTINGS_KEY = 'ai_settings';
const API_KEY_PREFIX = 'ai_api_key_';

const DEFAULT: AiSettings = {
  enabled: false,
  provider: 'gemini',
  keyStatus: 'unknown',
  rateLimitResetAt: null,
};

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await kvGetJSON<AiSettings>(SETTINGS_KEY);
  return { ...DEFAULT, ...(stored ?? {}) };
}

export async function updateAiSettings(
  patch: Partial<AiSettings>
): Promise<AiSettings> {
  const current = await getAiSettings();
  const next = { ...current, ...patch };
  await kvSetJSON(SETTINGS_KEY, next);
  return next;
}

export async function getApiKey(provider: AiProvider): Promise<string | null> {
  return SecureStore.getItemAsync(`${API_KEY_PREFIX}${provider}`);
}

export async function setApiKey(
  provider: AiProvider,
  key: string
): Promise<void> {
  await SecureStore.setItemAsync(`${API_KEY_PREFIX}${provider}`, key);
}

export async function clearApiKey(provider: AiProvider): Promise<void> {
  await SecureStore.deleteItemAsync(`${API_KEY_PREFIX}${provider}`);
}
