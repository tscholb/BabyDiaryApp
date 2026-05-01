import {
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const RECENT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 60;
const COLUMNS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

type SectionItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'row'; key: string; assets: MediaLibrary.Asset[] };

export function effectiveTime(asset: MediaLibrary.Asset): number {
  if (asset.creationTime && asset.creationTime > 0) return asset.creationTime;
  if (asset.modificationTime && asset.modificationTime > 0)
    return asset.modificationTime;
  return 0;
}

function bucketFor(
  asset: MediaLibrary.Asset,
  todayStart: Date
): { key: string; label: string; sortKey: number } | null {
  const time = effectiveTime(asset);
  if (!time) return null;
  const date = new Date(time);
  const photoStart = startOfDay(date);
  const dayDiff = Math.floor(
    (todayStart.getTime() - photoStart.getTime()) / DAY_MS
  );

  if (dayDiff < 7) {
    const key = format(photoStart, 'yyyy-MM-dd');
    let label: string;
    if (dayDiff === 0) label = `오늘 · ${format(photoStart, 'M월 d일')}`;
    else if (dayDiff === 1) label = `어제 · ${format(photoStart, 'M월 d일')}`;
    else
      label = `${format(photoStart, 'M월 d일')} (${WEEKDAY[photoStart.getDay()]})`;
    return { key, label, sortKey: photoStart.getTime() };
  }
  if (dayDiff < 30) {
    const weekStart = startOfWeek(photoStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(photoStart, { weekStartsOn: 1 });
    const key = `week-${format(weekStart, 'yyyy-MM-dd')}`;
    const label = `${format(weekStart, 'M월 d일')} ~ ${format(weekEnd, 'M월 d일')}`;
    return { key, label, sortKey: weekStart.getTime() };
  }
  const monthStart = new Date(photoStart.getFullYear(), photoStart.getMonth(), 1);
  const key = `month-${format(monthStart, 'yyyy-MM')}`;
  const label = format(monthStart, 'yyyy년 M월');
  return { key, label, sortKey: monthStart.getTime() };
}

function buildSections(
  assets: MediaLibrary.Asset[],
  todayStart: Date
): SectionItem[] {
  const buckets = new Map<
    string,
    { label: string; sortKey: number; assets: MediaLibrary.Asset[] }
  >();
  for (const asset of assets) {
    const bucket = bucketFor(asset, todayStart);
    if (!bucket) continue;
    const existing = buckets.get(bucket.key);
    if (existing) {
      existing.assets.push(asset);
    } else {
      buckets.set(bucket.key, {
        label: bucket.label,
        sortKey: bucket.sortKey,
        assets: [asset],
      });
    }
  }
  for (const bucket of buckets.values()) {
    bucket.assets.sort((a, b) => effectiveTime(b) - effectiveTime(a));
  }
  const sorted = Array.from(buckets.values()).sort(
    (a, b) => b.sortKey - a.sortKey
  );
  const items: SectionItem[] = [];
  for (const bucket of sorted) {
    items.push({
      type: 'header',
      key: `header-${bucket.label}`,
      label: bucket.label,
    });
    for (let i = 0; i < bucket.assets.length; i += COLUMNS) {
      items.push({
        type: 'row',
        key: `row-${bucket.label}-${i}`,
        assets: bucket.assets.slice(i, i + COLUMNS),
      });
    }
  }
  return items;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (assets: MediaLibrary.Asset[]) => void;
  excludedAssetIds: Set<string>;
  maxSelection: number;
};

export function PhotoLibraryPicker({
  visible,
  onClose,
  onConfirm,
  excludedAssetIds,
  maxSelection,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width } = useWindowDimensions();
  const cellSize = Math.floor(width / COLUMNS) - 2;

  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [permError, setPermError] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelected([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setAssets([]);
      setEndCursor(undefined);
      setHasMore(true);
      setSelected([]);
      setPermError(false);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        if (!cancelled) setPermError(true);
        return;
      }
      if (!cancelled) await fetchPage(undefined, true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function fetchPage(after: string | undefined, replace: boolean) {
    if (loading) return;
    setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after,
        mediaType: ['photo', 'video'],
        sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
      });
      setAssets(prev => (replace ? result.assets : [...prev, ...result.assets]));
      setEndCursor(result.endCursor);
      setHasMore(result.hasNextPage);
    } finally {
      setLoading(false);
    }
  }

  const todayStart = useMemo(() => startOfDay(new Date()), [visible]);
  const recentThreshold = useMemo(() => Date.now() - RECENT_THRESHOLD_MS, [visible]);

  const items = useMemo(
    () => buildSections(assets, todayStart),
    [assets, todayStart]
  );

  const isAlreadyAdded = (id: string) => excludedAssetIds.has(id);

  const toggle = (asset: MediaLibrary.Asset) => {
    if (isAlreadyAdded(asset.id)) return;
    setSelected(prev => {
      const idx = prev.findIndex(a => a.id === asset.id);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= maxSelection) return prev;
      return [...prev, asset];
    });
  };

  const renderCell = (asset: MediaLibrary.Asset) => {
    const added = isAlreadyAdded(asset.id);
    const sIdx = selected.findIndex(a => a.id === asset.id);
    const assetTime = effectiveTime(asset);
    const isNew = assetTime > 0 && assetTime > recentThreshold;
    const isVideo = asset.mediaType === 'video';
    return (
      <Pressable
        key={asset.id}
        onPress={() => toggle(asset)}
        style={{
          width: cellSize,
          height: cellSize,
          margin: 1,
        }}>
        <Image
          source={{ uri: asset.uri }}
          style={{
            width: '100%',
            height: '100%',
            opacity: added ? 0.35 : 1,
            backgroundColor: palette.surfaceAlt,
          }}
        />
        {added && (
          <View style={styles.addedOverlay}>
            <Text style={styles.addedText}>✓ 추가됨</Text>
          </View>
        )}
        {!added && sIdx >= 0 && (
          <View
            style={[styles.selectionDot, { backgroundColor: palette.tint }]}>
            <Text style={styles.selectionDotText}>{sIdx + 1}</Text>
          </View>
        )}
        {!added && sIdx < 0 && <View style={styles.selectionRing} />}
        {isNew && (
          <View style={[styles.newBadge, { backgroundColor: palette.tint }]}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        {isVideo && (
          <View style={styles.videoBadge} pointerEvents="none">
            <Text style={styles.videoBadgeText}>▶</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: palette.background }}
        edges={['top']}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: palette.textMuted }]}>
              취소
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>
            {selected.length > 0
              ? `${selected.length}장 선택`
              : `사진 선택 · 최대 ${maxSelection}장`}
          </Text>
          <Pressable
            onPress={() => onConfirm(selected)}
            disabled={selected.length === 0}
            hitSlop={12}>
            <Text
              style={[
                styles.headerBtn,
                {
                  color:
                    selected.length === 0 ? palette.textMuted : palette.tint,
                  fontWeight: '600',
                },
              ]}>
              완료
            </Text>
          </Pressable>
        </View>

        {permError ? (
          <View style={styles.center}>
            <Text style={{ color: palette.textMuted }}>
              사진 접근 권한이 필요해요
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.key}
            onEndReached={() => {
              if (hasMore && !loading && endCursor) {
                fetchPage(endCursor, false);
              }
            }}
            onEndReachedThreshold={0.6}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View
                    style={[
                      styles.sectionHeader,
                      {
                        backgroundColor: palette.background,
                        borderBottomColor: palette.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.sectionHeaderText,
                        { color: palette.text },
                      ]}>
                      {item.label}
                    </Text>
                  </View>
                );
              }
              return (
                <View style={styles.row}>
                  {item.assets.map(asset => renderCell(asset))}
                  {Array.from({ length: COLUMNS - item.assets.length }).map(
                    (_, i) => (
                      <View
                        key={`pad-${i}`}
                        style={{ width: cellSize, height: cellSize, margin: 1 }}
                      />
                    )
                  )}
                </View>
              );
            }}
            ListFooterComponent={
              loading ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator color={palette.tint} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={[styles.center, { paddingTop: 80 }]}>
                  <Text style={{ color: palette.textMuted }}>
                    사진이 없어요
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 15 },
  title: { fontSize: 16, fontWeight: '600' },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  sectionHeaderText: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row' },
  addedOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 3,
    borderRadius: 6,
  },
  addedText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  selectionDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  selectionDotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  selectionRing: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeText: { color: '#fff', fontSize: 10, marginLeft: 1 },
});
