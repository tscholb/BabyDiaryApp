import type { AnniversaryCategory } from '../types';

export type AnniversaryPreset = {
  name: string;
  icon: string;
  category: AnniversaryCategory;
};

export const ANNIVERSARY_PRESETS: AnniversaryPreset[] = [
  { name: '50일', icon: '🍼', category: 'date' },
  { name: '100일', icon: '🎉', category: 'date' },
  { name: '200일', icon: '🎊', category: 'date' },
  { name: '첫 생일', icon: '🎂', category: 'date' },
  { name: '두 돌', icon: '🎂', category: 'date' },

  { name: '첫 미소', icon: '😊', category: 'physical' },
  { name: '첫 뒤집기', icon: '🌀', category: 'physical' },
  { name: '첫 앉기', icon: '🪑', category: 'physical' },
  { name: '첫 기기', icon: '🐛', category: 'physical' },
  { name: '첫 걸음', icon: '👣', category: 'physical' },
  { name: '첫 이', icon: '🦷', category: 'physical' },

  { name: '첫 옹알이', icon: '💬', category: 'language' },
  { name: '첫 단어', icon: '🗣️', category: 'language' },
  { name: '엄마/아빠 처음 부른 날', icon: '💖', category: 'language' },
  { name: '첫 문장', icon: '📖', category: 'language' },

  { name: '첫 외출', icon: '🚶', category: 'social' },
  { name: '첫 비행기', icon: '✈️', category: 'social' },
  { name: '첫 어린이집', icon: '🎒', category: 'social' },
  { name: '첫 친구', icon: '👫', category: 'social' },

  { name: '백일잔치', icon: '🎈', category: 'event' },
  { name: '돌잔치', icon: '🎁', category: 'event' },
  { name: '첫 명절', icon: '🌙', category: 'event' },
  { name: '첫 크리스마스', icon: '🎄', category: 'event' },
];

export const CATEGORY_LABELS: Record<AnniversaryCategory, string> = {
  date: '날짜',
  physical: '신체',
  language: '언어',
  social: '사회',
  event: '이벤트',
  custom: '직접 입력',
};

export const QUICK_EMOJI_PALETTE = [
  '🎉', '🎂', '🎈', '🏆', '⭐', '✨',
  '❤️', '💕', '💖', '🥰', '😊', '🌟',
  '👶', '🍼', '👣', '🦷', '🧸', '🎁',
  '🎊', '🥇', '🌸', '🦄', '🌈', '🎀',
];
