import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Baby } from '@/src/types';
import { getBabyAgeLabel } from '@/src/utils/babyAge';
import { prettyDate } from '@/src/utils/date';

export type ShareCardProps = {
  baby: Baby;
  entryDate: string;
  body: string;
  photos: { uri: string; mediaType: 'photo' | 'video'; thumbnailUri: string | null }[];
  sessionLabel?: string;
};

export const SHARE_CARD_WIDTH = 1080;

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { baby, entryDate, body, photos, sessionLabel },
  ref
) {
  const showablePhotos = photos.slice(0, 4);
  const photoStyle = pickPhotoLayout(showablePhotos.length);

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{prettyDate(entryDate)}</Text>
        <Text style={styles.age}>
          {baby.name} · {getBabyAgeLabel(baby.birthDate, new Date(entryDate))}
        </Text>
        {sessionLabel ? (
          <Text style={styles.sessionLabel}>{sessionLabel}</Text>
        ) : null}
        <View style={styles.divider} />
      </View>

      <View style={photoStyle.gridStyle}>
        {showablePhotos.map((p, i) => (
          <View key={i} style={photoStyle.cellStyle}>
            <Image
              source={{
                uri: p.mediaType === 'video' && p.thumbnailUri ? p.thumbnailUri : p.uri,
              }}
              style={styles.photo}
              resizeMode="cover"
            />
            {p.mediaType === 'video' ? (
              <View style={styles.playBadge} pointerEvents="none">
                <Text style={styles.playGlyph}>▶</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {body ? <Text style={styles.body}>{body}</Text> : null}

      <Text style={styles.footer}>아기 성장노트</Text>
    </View>
  );
});

function pickPhotoLayout(count: number) {
  if (count === 1) {
    return {
      gridStyle: styles.grid1,
      cellStyle: styles.cell1,
    };
  }
  if (count === 2) {
    return {
      gridStyle: styles.grid2,
      cellStyle: styles.cell2,
    };
  }
  if (count === 3) {
    return {
      gridStyle: styles.grid3,
      cellStyle: styles.cell3,
    };
  }
  return {
    gridStyle: styles.grid4,
    cellStyle: styles.cell4,
  };
}

const PADDING = 56;
const INNER = SHARE_CARD_WIDTH - PADDING * 2;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    backgroundColor: '#FFF9F5',
    paddingHorizontal: PADDING,
    paddingTop: PADDING,
    paddingBottom: PADDING * 0.7,
  },
  header: {
    marginBottom: 32,
  },
  date: {
    fontSize: 56,
    fontWeight: '800',
    color: '#2D2A2E',
    letterSpacing: -1,
  },
  age: {
    fontSize: 28,
    color: '#8A8589',
    marginTop: 12,
  },
  sessionLabel: {
    fontSize: 24,
    color: '#FF8A7A',
    marginTop: 8,
    fontWeight: '600',
  },
  divider: {
    marginTop: 24,
    height: 2,
    backgroundColor: '#F0E3DB',
    width: 120,
  },
  grid1: {
    width: INNER,
    marginBottom: 32,
  },
  cell1: {
    width: INNER,
    aspectRatio: 4 / 3,
    borderRadius: 24,
    overflow: 'hidden',
  },
  grid2: {
    width: INNER,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  cell2: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  grid3: {
    width: INNER,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  cell3: {
    width: (INNER - 12) / 2,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  grid4: {
    width: INNER,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  cell4: {
    width: (INNER - 12) / 2,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    color: '#fff',
    fontSize: 26,
    marginLeft: 4,
  },
  body: {
    fontSize: 32,
    lineHeight: 50,
    color: '#2D2A2E',
    marginTop: 8,
  },
  footer: {
    marginTop: 56,
    fontSize: 22,
    color: '#B8ADA8',
    textAlign: 'center',
    letterSpacing: 1,
  },
});
