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
