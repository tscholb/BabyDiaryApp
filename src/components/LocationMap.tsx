import { useMemo } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  averageCoords,
  lngLatToTileFloat,
  osmTileUrl,
} from '@/src/utils/tileMath';

type Coord = { latitude: number; longitude: number };

type Props = {
  points: Coord[];
  height?: number;
  zoom?: number;
};

const TILE_HEADERS = { 'User-Agent': 'BabyDiaryApp/1.0 (personal)' };

export function LocationMap({ points, height = 160, zoom = 14 }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const center = useMemo(() => averageCoords(points), [points]);

  if (!center) return null;

  const openInMapApp = () => {
    const { latitude, longitude } = center;
    const label = '사진 위치';
    const ios = `maps://?ll=${latitude},${longitude}&q=${encodeURIComponent(
      label
    )}`;
    const android = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(
      label
    )})`;
    const fallback = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const primary = Platform.OS === 'ios' ? ios : android;
    Linking.canOpenURL(primary)
      .then(ok => Linking.openURL(ok ? primary : fallback))
      .catch(() => Linking.openURL(fallback));
  };

  return (
    <Pressable onPress={openInMapApp}>
      <View
        style={[
          styles.container,
          {
            height,
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.border,
          },
        ]}>
        <MapTiles points={points} center={center} zoom={zoom} />
        <View
          style={[
            styles.footer,
            { backgroundColor: 'rgba(0,0,0,0.55)' },
          ]}>
          <Text style={styles.footerText}>
            📍 이날의 장소 · 지도 앱에서 열기
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function MapTiles({
  points,
  center,
  zoom,
}: {
  points: Coord[];
  center: Coord;
  zoom: number;
}) {
  // Float tile coords for center.
  const { x: cxf, y: cyf } = lngLatToTileFloat(
    center.longitude,
    center.latitude,
    zoom
  );

  // 2x2 grid centered on the point: pick the 4 tiles closest to center.
  const leftTileX = Math.floor(cxf - 0.5);
  const topTileY = Math.floor(cyf - 0.5);

  const tiles: Array<{ tx: number; ty: number; col: number; row: number }> = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      tiles.push({
        tx: leftTileX + col,
        ty: topTileY + row,
        col,
        row,
      });
    }
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {tiles.map(t => {
        const url = osmTileUrl({ x: t.tx, y: t.ty, z: zoom });
        return (
          <Image
            key={`${t.tx}-${t.ty}`}
            source={{ uri: url, headers: TILE_HEADERS }}
            style={{
              position: 'absolute',
              left: `${t.col * 50}%`,
              top: `${t.row * 50}%`,
              width: '50%',
              height: '50%',
            }}
            resizeMode="cover"
          />
        );
      })}
      {points.map((p, i) => {
        const { x: pxf, y: pyf } = lngLatToTileFloat(
          p.longitude,
          p.latitude,
          zoom
        );
        const fx = (pxf - leftTileX) / 2;
        const fy = (pyf - topTileY) / 2;
        if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${fx * 100}%`,
              top: `${fy * 100}%`,
              transform: [{ translateX: -12 }, { translateY: -22 }],
            }}>
            <Text style={styles.pinEmoji}>📍</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  pinEmoji: { fontSize: 22 },
});
