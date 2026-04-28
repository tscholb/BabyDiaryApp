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
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets(prev => (replace ? result.assets : [...prev, ...result.assets]));
      setEndCursor(result.endCursor);
      setHasMore(result.hasNextPage);
    } finally {
      setLoading(false);
    }
  }

  const recentThreshold = useMemo(() => Date.now() - RECENT_THRESHOLD_MS, [visible]);

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
            data={assets}
            keyExtractor={item => item.id}
            numColumns={COLUMNS}
            onEndReached={() => {
              if (hasMore && !loading && endCursor) {
                fetchPage(endCursor, false);
              }
            }}
            onEndReachedThreshold={0.6}
            renderItem={({ item }) => {
              const added = isAlreadyAdded(item.id);
              const sIdx = selected.findIndex(a => a.id === item.id);
              const isNew =
                item.creationTime != null &&
                item.creationTime > recentThreshold;
              const isVideo = item.mediaType === 'video';
              return (
                <Pressable
                  onPress={() => toggle(item)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    margin: 1,
                  }}>
                  <Image
                    source={{ uri: item.uri }}
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
                      style={[
                        styles.selectionDot,
                        { backgroundColor: palette.tint },
                      ]}>
                      <Text style={styles.selectionDotText}>{sIdx + 1}</Text>
                    </View>
                  )}
                  {!added && sIdx < 0 && (
                    <View style={styles.selectionRing} />
                  )}
                  {isNew && (
                    <View
                      style={[
                        styles.newBadge,
                        { backgroundColor: palette.tint },
                      ]}>
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
