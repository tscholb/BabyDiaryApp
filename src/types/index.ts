export type Baby = {
  id: number;
  name: string;
  birthDate: string;
  profileImageUri: string | null;
  createdAt: string;
};

export type PhotoLayout = 'polaroid' | 'clean' | 'grid';

export type MediaType = 'photo' | 'video';

export type Diary = {
  id: number;
  babyId: number;
  entryDate: string;
  body: string;
  mood: string | null;
  aiGenerated: number;
  photoLayout: PhotoLayout;
  sessionBodies: string[];
  createdAt: string;
  updatedAt: string;
};

export type Photo = {
  id: number;
  diaryId: number;
  uri: string;
  orderIndex: number;
  sessionIndex: number;
  capturedAt: string | null;
  mediaType: MediaType;
  thumbnailUri: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

export type DiaryWithPhotos = Diary & {
  photos: Photo[];
};

export type AnniversaryCategory =
  | 'date'
  | 'physical'
  | 'language'
  | 'social'
  | 'event'
  | 'custom';

export type Anniversary = {
  id: number;
  babyId: number;
  name: string;
  icon: string;
  category: AnniversaryCategory | null;
  date: string;
  diaryId: number | null;
  notes: string | null;
  createdAt: string;
};

export type AiProvider = 'gemini' | 'claude' | 'openai';

export type AiSettings = {
  enabled: boolean;
  provider: AiProvider;
  keyStatus: 'ok' | 'invalid' | 'rate_limited' | 'unknown';
  rateLimitResetAt: string | null;
  customStyle: string;
};
