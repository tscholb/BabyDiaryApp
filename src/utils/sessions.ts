import type { Photo } from '../types';

export function groupPhotosBySession(photos: Photo[]): string[][] {
  if (photos.length === 0) return [[]];
  const map = new Map<number, Photo[]>();
  for (const p of photos) {
    if (!map.has(p.sessionIndex)) map.set(p.sessionIndex, []);
    map.get(p.sessionIndex)!.push(p);
  }
  const sortedKeys = Array.from(map.keys()).sort((a, b) => a - b);
  return sortedKeys.map(k =>
    map
      .get(k)!
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(p => p.uri)
  );
}
