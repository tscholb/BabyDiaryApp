import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ANNIVERSARY_PRESETS,
  CATEGORY_LABELS,
  QUICK_EMOJI_PALETTE,
} from '@/src/constants/anniversaryPresets';
import type { Anniversary, AnniversaryCategory } from '@/src/types';

const CATEGORY_ORDER: AnniversaryCategory[] = [
  'date',
  'physical',
  'language',
  'social',
  'event',
];

export type AnniversaryDraft = {
  name: string;
  icon: string;
  category: AnniversaryCategory | null;
  date: string;
  notes: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: AnniversaryDraft) => void;
  initialDate: string;
  allowDateEdit?: boolean;
  initial?: Anniversary | null;
};

export function AnniversaryPicker({
  visible,
  onClose,
  onSave,
  initialDate,
  allowDateEdit = false,
  initial = null,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎉');
  const [category, setCategory] = useState<AnniversaryCategory | null>(null);
  const [date, setDate] = useState(initialDate);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setIcon(initial.icon);
      setCategory(initial.category);
      setDate(initial.date);
      setNotes(initial.notes ?? '');
    } else {
      setName('');
      setIcon('🎉');
      setCategory(null);
      setDate(initialDate);
      setNotes('');
    }
  }, [visible, initial, initialDate]);

  const presetGroups = useMemo(() => {
    const groups = new Map<AnniversaryCategory, typeof ANNIVERSARY_PRESETS>();
    for (const preset of ANNIVERSARY_PRESETS) {
      const list = groups.get(preset.category) ?? [];
      list.push(preset);
      groups.set(preset.category, list);
    }
    return groups;
  }, []);

  const trimmedName = name.trim();
  const trimmedIcon = icon.trim() || '🎉';
  const isValid = trimmedName.length > 0 && date.length === 10;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      name: trimmedName,
      icon: trimmedIcon,
      category,
      date,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: palette.text }]}>
                {initial ? '기념일 수정' : '기념일 추가'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={[styles.closeBtn, { color: palette.textMuted }]}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.label, { color: palette.textMuted }]}>
                자주 쓰는 기념일
              </Text>
              <View style={{ gap: 12, marginBottom: 16 }}>
                {CATEGORY_ORDER.map(cat => {
                  const presets = presetGroups.get(cat) ?? [];
                  if (presets.length === 0) return null;
                  return (
                    <View key={cat}>
                      <Text
                        style={[
                          styles.categoryLabel,
                          { color: palette.textMuted },
                        ]}>
                        {CATEGORY_LABELS[cat]}
                      </Text>
                      <View style={styles.chipRow}>
                        {presets.map(preset => {
                          const selected =
                            trimmedName === preset.name &&
                            trimmedIcon === preset.icon;
                          return (
                            <Pressable
                              key={preset.name}
                              onPress={() => {
                                setName(preset.name);
                                setIcon(preset.icon);
                                setCategory(preset.category);
                              }}
                              style={[
                                styles.chip,
                                {
                                  backgroundColor: selected
                                    ? palette.tint
                                    : palette.surfaceAlt,
                                  borderColor: selected
                                    ? palette.tint
                                    : palette.border,
                                },
                              ]}>
                              <Text style={styles.chipEmoji}>{preset.icon}</Text>
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color: selected ? '#fff' : palette.text,
                                  },
                                ]}>
                                {preset.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: palette.textMuted }]}>
                이름
              </Text>
              <TextInput
                value={name}
                onChangeText={t => {
                  setName(t);
                  if (category !== 'custom') setCategory('custom');
                }}
                placeholder="예: 첫 비행기"
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surfaceAlt,
                    color: palette.text,
                    borderColor: palette.border,
                  },
                ]}
              />

              <Text
                style={[
                  styles.label,
                  { color: palette.textMuted, marginTop: 16 },
                ]}>
                아이콘
              </Text>
              <View style={styles.emojiRow}>
                {QUICK_EMOJI_PALETTE.map(em => {
                  const selected = trimmedIcon === em;
                  return (
                    <Pressable
                      key={em}
                      onPress={() => setIcon(em)}
                      style={[
                        styles.emojiBtn,
                        {
                          backgroundColor: selected
                            ? palette.tint
                            : palette.surfaceAlt,
                          borderColor: selected
                            ? palette.tint
                            : palette.border,
                        },
                      ]}>
                      <Text style={styles.emoji}>{em}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={icon}
                onChangeText={setIcon}
                placeholder="원하는 이모지 직접 입력"
                placeholderTextColor={palette.textMuted}
                maxLength={12}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surfaceAlt,
                    color: palette.text,
                    borderColor: palette.border,
                    marginTop: 8,
                    textAlign: 'center',
                    fontSize: 22,
                  },
                ]}
              />

              {allowDateEdit && (
                <>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.textMuted, marginTop: 16 },
                    ]}>
                    날짜 (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="2025-04-26"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surfaceAlt,
                        color: palette.text,
                        borderColor: palette.border,
                      },
                    ]}
                  />
                </>
              )}

              <Text
                style={[
                  styles.label,
                  { color: palette.textMuted, marginTop: 16 },
                ]}>
                메모 (선택)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="기억하고 싶은 한 줄"
                placeholderTextColor={palette.textMuted}
                multiline
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surfaceAlt,
                    color: palette.text,
                    borderColor: palette.border,
                    minHeight: 60,
                    textAlignVertical: 'top',
                  },
                ]}
              />
            </ScrollView>

            <Pressable
              onPress={handleSave}
              disabled={!isValid}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: isValid ? palette.tint : palette.border,
                },
              ]}>
              <Text style={styles.saveBtnText}>
                {initial ? '수정 완료' : '추가'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  categoryLabel: { fontSize: 11, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '500' },
  input: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
