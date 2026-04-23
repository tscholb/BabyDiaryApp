import * as FileSystem from 'expo-file-system/legacy';
import type { AiProvider } from '../types';
import { getApiKey, getAiSettings, updateAiSettings } from './aiSettings';
import { scheduleRateLimitResetNotification } from './notifications';

export type AiResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'disabled' | 'no_key' | 'invalid_key' | 'rate_limited' | 'network' | 'unknown'; message: string };

type GenerateInput = {
  photoUris: string[];
  babyName: string;
  babyAgeLabel: string;
  entryDate: string;
};

const PROMPT = (input: GenerateInput) => `너는 따뜻한 육아 일기 작가야. 아래 사진(들)을 보고, 이 아기의 하루를 1~3문장으로 정답게 묘사해줘.

- 아기 이름: ${input.babyName}
- 나이: ${input.babyAgeLabel}
- 날짜: ${input.entryDate}
- 말투: 부드럽고 따뜻한 존댓말, 너무 길지 않게
- 이모지는 1개 이하만 자연스럽게
- 아기가 실제로 사진에서 보이는 행동만 묘사. 추측하지 말 것
- 한국어로 작성`;

export async function generateDiaryFromPhotos(
  input: GenerateInput
): Promise<AiResult> {
  const settings = await getAiSettings();
  if (!settings.enabled) {
    return { ok: false, reason: 'disabled', message: 'AI 자동 작성이 꺼져 있어요.' };
  }

  const key = await getApiKey(settings.provider);
  if (!key) {
    return { ok: false, reason: 'no_key', message: 'API 키가 설정되지 않았어요.' };
  }

  try {
    switch (settings.provider) {
      case 'gemini':
        return await callGemini(key, input);
      case 'claude':
        return await callClaude(key, input);
      case 'openai':
        return await callOpenAI(key, input);
    }
  } catch (e) {
    return {
      ok: false,
      reason: 'network',
      message: e instanceof Error ? e.message : '네트워크 오류가 발생했어요.',
    };
  }
}

async function photoToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function handleRateLimit(provider: AiProvider, resetAt: Date) {
  await updateAiSettings({
    keyStatus: 'rate_limited',
    rateLimitResetAt: resetAt.toISOString(),
  });
  await scheduleRateLimitResetNotification(provider, resetAt);
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const msg =
        json?.error?.message ??
        json?.error?.code ??
        json?.message ??
        text.slice(0, 200);
      return String(msg);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return '';
  }
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryGeminiModel(
  model: string,
  key: string,
  body: string
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }
  );
}

async function callGemini(key: string, input: GenerateInput): Promise<AiResult> {
  const images = await Promise.all(
    input.photoUris.slice(0, 4).map(async uri => ({
      inlineData: { mimeType: 'image/jpeg', data: await photoToBase64(uri) },
    }))
  );
  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT(input) }, ...images] }],
  });

  let lastRes: Response | null = null;
  let lastDetail = '';

  for (const model of GEMINI_MODELS) {
    let res = await tryGeminiModel(model, key, body);

    if (res.status === 503) {
      await sleep(1500);
      res = await tryGeminiModel(model, key, body);
    }
    if (res.status === 503) {
      await sleep(3000);
      res = await tryGeminiModel(model, key, body);
    }

    lastRes = res;

    if (res.status === 401 || res.status === 403) {
      const detail = await readErrorBody(res);
      await updateAiSettings({ keyStatus: 'invalid' });
      return {
        ok: false,
        reason: 'invalid_key',
        message: `API 키가 유효하지 않아요. ${detail ? `(${detail})` : ''}`.trim(),
      };
    }
    if (res.status === 429) {
      const resetAt = new Date();
      resetAt.setHours(24, 0, 0, 0);
      await handleRateLimit('gemini', resetAt);
      return {
        ok: false,
        reason: 'rate_limited',
        message: '오늘 AI 사용량을 다 썼어요. 내일 리셋됩니다.',
      };
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as
        | string
        | undefined;
      if (!text) {
        return { ok: false, reason: 'unknown', message: 'AI 응답이 비어있어요.' };
      }
      await updateAiSettings({ keyStatus: 'ok', rateLimitResetAt: null });
      return { ok: true, text: text.trim() };
    }

    if (res.status === 503 || res.status === 500 || res.status === 404) {
      lastDetail = await readErrorBody(res);
      continue;
    }

    lastDetail = await readErrorBody(res);
    break;
  }

  return {
    ok: false,
    reason: 'unknown',
    message: `AI 호출 실패 (${lastRes?.status ?? '?'}): ${lastDetail}`,
  };
}

async function callClaude(key: string, input: GenerateInput): Promise<AiResult> {
  const images = await Promise.all(
    input.photoUris.slice(0, 4).map(async uri => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: await photoToBase64(uri),
      },
    }))
  );

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [...images, { type: 'text', text: PROMPT(input) }],
        },
      ],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    const detail = await readErrorBody(res);
    await updateAiSettings({ keyStatus: 'invalid' });
    return {
      ok: false,
      reason: 'invalid_key',
      message: `API 키가 유효하지 않아요. ${detail ? `(${detail})` : ''}`.trim(),
    };
  }
  if (res.status === 429) {
    const resetAt = new Date(Date.now() + 60_000);
    await handleRateLimit('claude', resetAt);
    return {
      ok: false,
      reason: 'rate_limited',
      message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
    };
  }
  if (!res.ok) {
    const detail = await readErrorBody(res);
    return {
      ok: false,
      reason: 'unknown',
      message: `AI 호출 실패 (${res.status}): ${detail}`,
    };
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text as string | undefined;
  if (!text) {
    return { ok: false, reason: 'unknown', message: 'AI 응답이 비어있어요.' };
  }

  await updateAiSettings({ keyStatus: 'ok', rateLimitResetAt: null });
  return { ok: true, text: text.trim() };
}

async function callOpenAI(key: string, input: GenerateInput): Promise<AiResult> {
  const images = await Promise.all(
    input.photoUris.slice(0, 4).map(async uri => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/jpeg;base64,${await photoToBase64(uri)}` },
    }))
  );

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: PROMPT(input) }, ...images],
        },
      ],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    const detail = await readErrorBody(res);
    await updateAiSettings({ keyStatus: 'invalid' });
    return {
      ok: false,
      reason: 'invalid_key',
      message: `API 키가 유효하지 않아요. ${detail ? `(${detail})` : ''}`.trim(),
    };
  }
  if (res.status === 429) {
    const resetAt = new Date(Date.now() + 60_000);
    await handleRateLimit('openai', resetAt);
    return {
      ok: false,
      reason: 'rate_limited',
      message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
    };
  }
  if (!res.ok) {
    const detail = await readErrorBody(res);
    return {
      ok: false,
      reason: 'unknown',
      message: `AI 호출 실패 (${res.status}): ${detail}`,
    };
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content as string | undefined;
  if (!text) {
    return { ok: false, reason: 'unknown', message: 'AI 응답이 비어있어요.' };
  }

  await updateAiSettings({ keyStatus: 'ok', rateLimitResetAt: null });
  return { ok: true, text: text.trim() };
}
