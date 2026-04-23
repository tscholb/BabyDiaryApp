import { useWindowDimensions, View, StyleSheet, Image, Pressable } from 'react-native';

type Props = {
  uris: string[];
  onPressPhoto?: (index: number) => void;
};

export function PhotoCollage({ uris, onPressPhoto }: Props) {
  const { width } = useWindowDimensions();
  const containerWidth = Math.min(width - 40, 520);

  if (uris.length === 0) return null;

  if (uris.length === 1) {
    return (
      <View style={[styles.wrap, { width: containerWidth }]}>
        <Polaroid
          uri={uris[0]}
          width={containerWidth}
          height={containerWidth * 1.05}
          rotate={-0.8}
          onPress={() => onPressPhoto?.(0)}
        />
      </View>
    );
  }

  if (uris.length === 2) {
    const w = containerWidth * 0.68;
    const h = w * 1.2;
    return (
      <View style={[styles.wrap, { width: containerWidth, gap: 4 }]}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Polaroid uri={uris[0]} width={w} height={h} rotate={-2} onPress={() => onPressPhoto?.(0)} />
        </View>
        <View style={{ alignSelf: 'flex-end', marginTop: -40 }}>
          <Polaroid uri={uris[1]} width={w} height={h} rotate={2.5} onPress={() => onPressPhoto?.(1)} />
        </View>
      </View>
    );
  }

  if (uris.length === 3) {
    const bigW = containerWidth * 0.72;
    const bigH = bigW * 1.2;
    const smallW = containerWidth * 0.42;
    const smallH = smallW * 1.15;
    return (
      <View style={[styles.wrap, { width: containerWidth }]}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Polaroid uri={uris[0]} width={bigW} height={bigH} rotate={-1.5} onPress={() => onPressPhoto?.(0)} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: -24 }}>
          <Polaroid uri={uris[1]} width={smallW} height={smallH} rotate={-2.5} onPress={() => onPressPhoto?.(1)} />
          <Polaroid uri={uris[2]} width={smallW} height={smallH} rotate={3} onPress={() => onPressPhoto?.(2)} />
        </View>
      </View>
    );
  }

  const cellW = containerWidth * 0.72;
  const cellH = cellW * 1.1;
  return (
    <View style={[styles.wrap, { width: containerWidth, gap: 0 }]}>
      {uris.map((uri, i) => (
        <View
          key={uri}
          style={{
            alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
            marginTop: i === 0 ? 0 : -24,
          }}>
          <Polaroid
            uri={uri}
            width={cellW}
            height={cellH}
            rotate={i % 2 === 0 ? -2 : 2.5}
            onPress={() => onPressPhoto?.(i)}
          />
        </View>
      ))}
    </View>
  );
}

function Polaroid({
  uri,
  width,
  height,
  rotate,
  onPress,
}: {
  uri: string;
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
      <Image
        source={{ uri }}
        style={{ width: width - 16, height, borderRadius: 2 }}
        resizeMode="cover"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginVertical: 24,
  },
});
