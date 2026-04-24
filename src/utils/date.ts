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

export function parseExifDateTime(
  exif: Record<string, unknown> | null | undefined
): string | null {
  if (!exif) return null;
  const raw =
    (exif.DateTimeOriginal as string | undefined) ??
    (exif.DateTimeDigitized as string | undefined) ??
    (exif.DateTime as string | undefined);
  if (!raw) return null;
  const match = raw.match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
}

export function prettyTimeKo(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return '';
  const h = Number(match[1]);
  const m = match[2];
  if (h === 0) return `오전 12:${m}`;
  if (h < 12) return `오전 ${h}:${m}`;
  if (h === 12) return `오후 12:${m}`;
  return `오후 ${h - 12}:${m}`;
}
