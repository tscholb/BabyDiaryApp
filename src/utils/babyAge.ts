import {
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  parseISO,
} from 'date-fns';

export function getBabyAgeLabel(birthDate: string, on: Date = new Date()): string {
  const birth = parseISO(birthDate);
  const days = differenceInDays(on, birth);
  if (days < 0) return '출생 예정';
  if (days < 30) return `생후 ${days}일`;

  const months = differenceInMonths(on, birth);
  if (months < 24) return `${months}개월`;

  const years = differenceInYears(on, birth);
  const remainderMonths = months - years * 12;
  if (remainderMonths === 0) return `${years}살`;
  return `${years}살 ${remainderMonths}개월`;
}
