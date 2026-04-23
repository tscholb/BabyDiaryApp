import { format } from 'date-fns';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return format(date, 'yyyy년 M월 d일');
}

export function parseExifDate(
  exif: Record<string, unknown> | null | undefined
): string | null {
  if (!exif) return null;
  const raw =
    (exif.DateTimeOriginal as string | undefined) ??
    (exif.DateTimeDigitized as string | undefined) ??
    (exif.DateTime as string | undefined);
  if (!raw) return null;
  const match = raw.match(/(\d{4}):(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
