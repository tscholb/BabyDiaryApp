export type Baby = {
  id: number;
  name: string;
  birthDate: string;
  profileImageUri: string | null;
  createdAt: string;
};

export type Diary = {
  id: number;
  babyId: number;
  entryDate: string;
  body: string;
  mood: string | null;
  aiGenerated: number;
  createdAt: string;
  updatedAt: string;
};

export type Photo = {
  id: number;
  diaryId: number;
  uri: string;
  orderIndex: number;
  createdAt: string;
};

export type DiaryWithPhotos = Diary & {
  photos: Photo[];
};

export type AiProvider = 'gemini' | 'claude' | 'openai';

export type AiSettings = {
  enabled: boolean;
  provider: AiProvider;
  keyStatus: 'ok' | 'invalid' | 'rate_limited' | 'unknown';
  rateLimitResetAt: string | null;
  customStyle: string;
};
