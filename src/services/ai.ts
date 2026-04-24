import * as FileSystem from 'expo-file-system/legacy';
import type { AiProvider } from '../types';
import { getApiKey, getAiSettings, updateAiSettings } from './aiSettings';
import { scheduleRateLimitResetNotification } from './notifications';

export type AiResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'disabled' | 'no_key' | 'invalid_key' | 'rate_limited' | 'network' | 'unknown'; message: string };

type GenerateInput = {
  photoSessions: string[][];
  capturedAtByUri?: Record<string, string | null>;
  babyName: string;
  babyAgeLabel: string;
  entryDate: string;
  customStyle?: string;
  customRequest?: string;
};

function formatKoreanTimeRange(
  session: string[],
  capturedAtByUri: Record<string, string | null> | undefined
): string | null {
  if (!capturedAtByUri) return null;
  const times = session
    .map(uri => capturedAtByUri[uri])
    .filter((t): t is string => Boolean(t))
    .map(t => {
      const m = t.match(/T(\d{2}):(\d{2})/);
      if (!m) return null;
      return { h: Number(m[1]), m: Number(m[2]), raw: t };
    })
    .filter((t): t is { h: number; m: number; raw: string } => t !== null)
    .sort((a, b) => a.raw.localeCompare(b.raw));

  if (times.length === 0) return null;

  const fmt = (h: number, m: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h === 0) return `오전 12:${pad(m)}`;
    if (h < 12) return `오전 ${h}:${pad(m)}`;
    if (h === 12) return `오후 12:${pad(m)}`;
    return `오후 ${h - 12}:${pad(m)}`;
  };

  const first = times[0];
  const last = times[times.length - 1];
  if (times.length === 1 || (first.h === last.h && first.m === last.m)) {
    return fmt(first.h, first.m);
  }
  return `${fmt(first.h, first.m)} ~ ${fmt(last.h, last.m)}`;
}

const PROMPT = (input: GenerateInput) => {
  const styleBlock = input.customStyle?.trim()
    ? `\n사용자가 설정한 기본 말투/스타일:\n${input.customStyle.trim()}\n(위 스타일을 우선 반영해서 써줘. 아래 규칙과 충돌하면 사용자 스타일이 우선이야.)\n`
    : '';
  const requestBlock = input.customRequest?.trim()
    ? `\n이번 일기에만 적용할 요청:\n${input.customRequest.trim()}\n(이 요청을 가장 우선으로 반영해서 써줘.)\n`
    : '';

  const nonEmptySessions = input.photoSessions.filter(s => s.length > 0);
  const nonEmptySessionCount = nonEmptySessions.length;

  const sessionTimeLines = nonEmptySessions
    .map((session, i) => {
      const range = formatKoreanTimeRange(session, input.capturedAtByUri);
      return range ? `- [세션 ${i + 1}]: ${range}에 찍힘` : null;
    })
    .filter((x): x is string => Boolean(x));

  const timeHintBlock =
    sessionTimeLines.length > 0
      ? `\n각 세션의 실제 촬영 시각 (사진 EXIF 기반, 참고용):
${sessionTimeLines.join('\n')}
이 시각을 바탕으로 자연스러운 시간 표현을 써줘 (예: 실제로 아침 7시면 "이른 아침에", 오후 3시면 "오후에", 저녁 8시면 "저녁에"). 사용자가 넘긴 세션 순서와 실제 시각이 모순되면 실제 시각을 우선해서 자연스럽게 써줘.\n`
      : '';

  const sessionBlock =
    nonEmptySessionCount > 1
      ? `\n사용자가 오늘 하루를 ${nonEmptySessionCount}개 세션으로 나눠 사진을 넣었어. 세션은 기본적으로 시간 순서라고 가정해.
각 세션 앞에는 "[세션 N]" 구분자가 있고 그 뒤 사진들이 이어져. 세션 사이에는 시간이 흘렀다고 봐.
한 편의 글로 자연스럽게 이어쓰되, 시간 흐름이 느껴지도록 "아침에는... 이후에는... 마지막으로는..." 같은 전환을 자연스럽게 넣어줘. 세션을 번호로 부르지 말고 자연스러운 시간 표현으로 대체.\n`
      : '';

  const lengthGuide =
    nonEmptySessionCount > 1
      ? `${nonEmptySessionCount}개 세션이 이어지는 하루를 3~5문장 정도로`
      : '2~4문장으로';

  return `너는 지금 아기의 엄마 또는 아빠가 되어 직접 육아일기를 쓰고 있어. 아래 사진(들)을 보고, 오늘 우리 아기의 하루를 ${lengthGuide} 정답게 적어줘.

아기 정보:
- 이름: ${input.babyName}
- 나이: ${input.babyAgeLabel}
- 날짜: ${input.entryDate}
${sessionBlock}${timeHintBlock}${styleBlock}${requestBlock}
작성 규칙:
- 이름은 반드시 **성(姓)을 빼고 이름 부분만** 부를 것. 예: '김서현' → '서현이', '이지훈' → '지훈이'. 받침이 있으면 '이'를, 없으면 '가' 또는 그대로 붙여 자연스럽게 호명
- 1인칭 부모 시점으로 "우리 서현이가...", "오늘은...", "너무 예뻤어" 처럼 자연스럽게
- 기본적으로 반말 또는 편안한 경어체 (너무 딱딱한 존댓말 X), 단 위에 스타일/요청이 있으면 그걸 우선
- 사랑스럽고 다정한 톤, 살짝 감탄이나 감정 넣어도 OK
- 아기가 사진 속에서 실제로 하는 행동·표정·옷차림만 묘사. 사실에 없는 건 추측하지 말 것
- 이모지는 최대 1개까지만 자연스럽게
- 한국어로 작성
- 인삿말이나 설명 없이 바로 일기 본문만`;
};

const MAX_PHOTOS_PER_CALL = 8;

function flattenSessions(sessions: string[][]): { uris: string[]; markers: number[] } {
  const uris: string[] = [];
  const markers: number[] = [];
  let budget = MAX_PHOTOS_PER_CALL;
  for (let i = 0; i < sessions.length; i++) {
    if (sessions[i].length === 0) continue;
    markers.push(uris.length);
    for (const uri of sessions[i]) {
      if (budget <= 0) break;
      uris.push(uri);
      budget--;
    }
  }
  return { uris, markers };
}

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

  const resolvedInput: GenerateInput = {
    ...input,
    customStyle: input.customStyle ?? settings.customStyle ?? '',
    capturedAtByUri: input.capturedAtByUri,
  };

  try {
    switch (settings.provider) {
      case 'gemini':
        return await callGemini(key, resolvedInput);
      case 'claude':
        return await callClaude(key, resolvedInput);
      case 'openai':
        return await callOpenAI(key, resolvedInput);
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

async function buildGeminiParts(input: GenerateInput) {
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: PROMPT(input) }];
  const { uris, markers } = flattenSessions(input.photoSessions);
  const nonEmpty = input.photoSessions.filter(s => s.length > 0).length;
  let sessionCounter = 0;
  for (let i = 0; i < uris.length; i++) {
    if (markers.includes(i) && nonEmpty > 1) {
      sessionCounter++;
      parts.push({ text: `\n[세션 ${sessionCounter}]` });
    }
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: await photoToBase64(uris[i]) },
    });
  }
  return parts;
}

async function callGemini(key: string, input: GenerateInput): Promise<AiResult> {
  const parts = await buildGeminiParts(input);
  const body = JSON.stringify({
    contents: [{ parts }],
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

type ClaudeContent =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: 'image/jpeg'; data: string };
    };

async function callClaude(key: string, input: GenerateInput): Promise<AiResult> {
  const content: ClaudeContent[] = [{ type: 'text', text: PROMPT(input) }];
  const { uris, markers } = flattenSessions(input.photoSessions);
  const nonEmpty = input.photoSessions.filter(s => s.length > 0).length;
  let sessionCounter = 0;
  for (let i = 0; i < uris.length; i++) {
    if (markers.includes(i) && nonEmpty > 1) {
      sessionCounter++;
      content.push({ type: 'text', text: `\n[세션 ${sessionCounter}]` });
    }
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: await photoToBase64(uris[i]),
      },
    });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content,
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

type OpenAiContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

async function callOpenAI(key: string, input: GenerateInput): Promise<AiResult> {
  const content: OpenAiContent[] = [{ type: 'text', text: PROMPT(input) }];
  const { uris, markers } = flattenSessions(input.photoSessions);
  const nonEmpty = input.photoSessions.filter(s => s.length > 0).length;
  let sessionCounter = 0;
  for (let i = 0; i < uris.length; i++) {
    if (markers.includes(i) && nonEmpty > 1) {
      sessionCounter++;
      content.push({ type: 'text', text: `\n[세션 ${sessionCounter}]` });
    }
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${await photoToBase64(uris[i])}`,
      },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content,
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
