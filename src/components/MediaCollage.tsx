import { VideoView, useVideoPlayer } from 'expo-video';
import { useWindowDimensions, View, StyleSheet, Image, Pressable, Text } from 'react-native';

import type { PhotoLayout } from '@/src/types';

export type MediaItem = {
  uri: string;
  mediaType: 'photo' | 'video';
  thumbnailUri?: string | null;
};

type Props = {
  items: MediaItem[];
  layout?: PhotoLayout;
  onPressItem?: (index: number) => void;
};

export function MediaCollage({ items, layout = 'polaroid', onPressItem }: Props) {
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width - 40, 520);

  if (items.length === 0) return null;

  if (layout === 'grid') {
    return <GridLayout items={items} containerWidth={containerWidth} onPress={onPressItem} />;
  }

  if (layout === 'clean') {
    return <CleanLayout items={items} containerWidth={containerWidth} onPress={onPressItem} />;
  }

  return <PolaroidLayout items={items} containerWidth={containerWidth} onPress={onPressItem} />;
}

function PolaroidLayout({
  items,
  containerWidth,
  onPress,
}: {
  items: MediaItem[];
  containerWidth: number;
  onPress?: (i: number) => void;
}) {
  if (items.length === 1) {
    return (
      <View style={[styles.wrap, { width: containerWidth }]}>
        <Polaroid
          item={items[0]}
          width={containerWidth}
          height={containerWidth * 1.05}
          rotate={-0.8}
          onPress={() => onPress?.(0)}
        />
      </View>
    );
  }

  if (items.length === 2) {
    const w = containerWidth * 0.68;
    const h = w * 1.2;
    return (
      <View style={[styles.wrap, { width: containerWidth, gap: 4 }]}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Polaroid item={items[0]} width={w} height={h} rotate={-2} onPress={() => onPress?.(0)} />
        </View>
        <View style={{ alignSelf: 'flex-end', marginTop: -40 }}>
          <Polaroid item={items[1]} width={w} height={h} rotate={2.5} onPress={() => onPress?.(1)} />
        </View>
      </View>
    );
  }

  if (items.length === 3) {
    const bigW = containerWidth * 0.72;
    const bigH = bigW * 1.2;
    const smallW = containerWidth * 0.42;
    const smallH = smallW * 1.15;
    return (
      <View style={[styles.wrap, { width: containerWidth }]}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Polaroid item={items[0]} width={bigW} height={bigH} rotate={-1.5} onPress={() => onPress?.(0)} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: -24 }}>
          <Polaroid item={items[1]} width={smallW} height={smallH} rotate={-2.5} onPress={() => onPress?.(1)} />
          <Polaroid item={items[2]} width={smallW} height={smallH} rotate={3} onPress={() => onPress?.(2)} />
        </View>
      </View>
    );
  }

  const cellW = containerWidth * 0.72;
  const cellH = cellW * 1.1;
  return (
    <View style={[styles.wrap, { width: containerWidth }]}>
      {items.map((item, i) => (
        <View
          key={item.uri}
          style={{
            alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
            marginTop: i === 0 ? 0 : -24,
          }}>
          <Polaroid
            item={item}
            width={cellW}
            height={cellH}
            rotate={i % 2 === 0 ? -2 : 2.5}
            onPress={() => onPress?.(i)}
          />
        </View>
      ))}
    </View>
  );
}

function CleanLayout({
  items,
  containerWidth,
  onPress,
}: {
  items: MediaItem[];
  containerWidth: number;
  onPress?: (i: number) => void;
}) {
  if (items.length === 1) {
    return (
      <View style={[styles.wrap, { width: containerWidth }]}>
        <MediaFrame
          item={items[0]}
          width={containerWidth}
          height={containerWidth}
          onPress={() => onPress?.(0)}
        />
      </View>
    );
  }

  if (items.length === 2) {
    const w = (containerWidth - 8) / 2;
    return (
      <View style={[styles.wrap, { width: containerWidth, flexDirection: 'row', gap: 8 }]}>
        {items.map((item, i) => (
          <MediaFrame
            key={item.uri}
            item={item}
            width={w}
            height={w * 1.2}
            onPress={() => onPress?.(i)}
          />
        ))}
      </View>
    );
  }

  if (items.length === 3) {
    const mainW = containerWidth;
    const smallW = (containerWidth - 8) / 2;
    return (
      <View style={[styles.wrap, { width: containerWidth, gap: 8 }]}>
        <MediaFrame item={items[0]} width={mainW} height={mainW * 0.7} onPress={() => onPress?.(0)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <MediaFrame item={items[1]} width={smallW} height={smallW} onPress={() => onPress?.(1)} />
          <MediaFrame item={items[2]} width={smallW} height={smallW} onPress={() => onPress?.(2)} />
        </View>
      </View>
    );
  }

  const cols = 2;
  const cellW = (containerWidth - 8) / cols;
  return (
    <View style={[styles.wrap, { width: containerWidth }]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item, i) => (
          <MediaFrame
            key={item.uri}
            item={item}
            width={cellW}
            height={cellW}
            onPress={() => onPress?.(i)}
          />
        ))}
      </View>
    </View>
  );
}

function GridLayout({
  items,
  containerWidth,
  onPress,
}: {
  items: MediaItem[];
  containerWidth: number;
  onPress?: (i: number) => void;
}) {
  const cols = items.length <= 4 ? 2 : 3;
  const gap = 4;
  const cellW = (containerWidth - gap * (cols - 1)) / cols;
  return (
    <View style={[styles.wrap, { width: containerWidth }]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {items.map((item, i) => (
          <MediaFrame
            key={item.uri}
            item={item}
            width={cellW}
            height={cellW}
            borderRadius={4}
            onPress={() => onPress?.(i)}
          />
        ))}
      </View>
    </View>
  );
}

function Polaroid({
  item,
  width,
  height,
  rotate,
  onPress,
}: {
  item: MediaItem;
  width: number;
  height: number;
  rotate: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width,
        transform: [{ rotate: `${rotate}deg` }],
        backgroundColor: '#FFFFFF',
        padding: 8,
        paddingBottom: 20,
        borderRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}>
      <MediaSurface
        item={item}
        width={width - 16}
        height={height}
        borderRadius={2}
      />
    </Pressable>
  );
}

function MediaFrame({
  item,
  width,
  height,
  borderRadius = 10,
  onPress,
}: {
  item: MediaItem;
  width: number;
  height: number;
  borderRadius?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ width, height, borderRadius, overflow: 'hidden' }}>
      <MediaSurface item={item} width={width} height={height} borderRadius={borderRadius} />
    </Pressable>
  );
}

function MediaSurface({
  item,
  width,
  height,
  borderRadius,
}: {
  item: MediaItem;
  width: number;
  height: number;
  borderRadius: number;
}) {
  if (item.mediaType === 'video') {
    return <VideoSurface item={item} width={width} height={height} borderRadius={borderRadius} />;
  }
  return (
    <Image
      source={{ uri: item.uri }}
      style={{ width, height, borderRadius }}
      resizeMode="cover"
    />
  );
}

function VideoSurface({
  item,
  width,
  height,
  borderRadius,
}: {
  item: MediaItem;
  width: number;
  height: number;
  borderRadius: number;
}) {
  if (item.thumbnailUri) {
    return (
      <View style={{ width, height, borderRadius, overflow: 'hidden' }}>
        <Image
          source={{ uri: item.thumbnailUri }}
          style={{ width, height }}
          resizeMode="cover"
        />
        <View style={styles.playBadge} pointerEvents="none">
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>
    );
  }
  return <InlineVideo item={item} width={width} height={height} borderRadius={borderRadius} />;
}

function InlineVideo({
  item,
  width,
  height,
  borderRadius,
}: {
  item: MediaItem;
  width: number;
  height: number;
  borderRadius: number;
}) {
  const player = useVideoPlayer(item.uri, p => {
    p.loop = false;
    p.muted = true;
  });

  return (
    <View style={{ width, height, borderRadius, overflow: 'hidden' }}>
      <VideoView
        player={player}
        style={{ width, height }}
        nativeControls={false}
        contentFit="cover"
      />
      <View style={styles.playBadge} pointerEvents="none">
        <Text style={styles.playIcon}>▶</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginVertical: 24,
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 2,
  },
});
