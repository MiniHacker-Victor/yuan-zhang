import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isAfter,
  parse,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Expense, PeriodType, TrendPoint } from '../types';

export interface PeriodRange {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(value: string): Date {
  return parse(value, 'yyyy-MM-dd', new Date());
}

export function getPeriodRange(periodType: PeriodType, anchor: Date): PeriodRange {
  let start: Date;
  let end: Date;

  if (periodType === 'week') {
    start = startOfWeek(anchor, { weekStartsOn: 1 });
    end = endOfWeek(anchor, { weekStartsOn: 1 });
  } else if (periodType === 'year') {
    start = startOfYear(anchor);
    end = endOfYear(anchor);
  } else {
    start = startOfMonth(anchor);
    end = endOfMonth(anchor);
  }

  return { start, end, startKey: toDateKey(start), endKey: toDateKey(end) };
}

export function shiftPeriod(anchor: Date, periodType: PeriodType, amount: number): Date {
  if (periodType === 'week') return addWeeks(anchor, amount);
  if (periodType === 'year') return addYears(anchor, amount);
  return addMonths(anchor, amount);
}

export function getPreviousRange(periodType: PeriodType, range: PeriodRange): PeriodRange {
  return getPeriodRange(periodType, shiftPeriod(range.start, periodType, -1));
}

export function formatPeriodLabel(periodType: PeriodType, range: PeriodRange): string {
  if (periodType === 'year') return format(range.start, 'yyyy年', { locale: zhCN });
  if (periodType === 'month') return format(range.start, 'yyyy年M月', { locale: zhCN });

  const sameYear = range.start.getFullYear() === range.end.getFullYear();
  const start = format(range.start, sameYear ? 'M月d日' : 'yyyy年M月d日', { locale: zhCN });
  const end = format(range.end, 'M月d日', { locale: zhCN });
  return `${start}–${end}`;
}

export function isRangeCurrent(range: PeriodRange, now = new Date()): boolean {
  const today = toDateKey(now);
  return today >= range.startKey && today <= range.endKey;
}

export function getPeriodProgress(range: PeriodRange, now = new Date()): number {
  if (!isRangeCurrent(range, now)) {
    return toDateKey(now) > range.endKey ? 1 : 0;
  }

  const totalDays = differenceInCalendarDays(range.end, range.start) + 1;
  const elapsedDays = differenceInCalendarDays(now, range.start) + 1;
  return Math.min(1, Math.max(0, elapsedDays / totalDays));
}

export function expensesInRange(expenses: Expense[], range: PeriodRange): Expense[] {
  return expenses.filter((expense) => expense.occurredOn >= range.startKey && expense.occurredOn <= range.endKey);
}

export function buildTrend(periodType: PeriodType, range: PeriodRange, expenses: Expense[]): TrendPoint[] {
  if (periodType === 'year') {
    const months = eachMonthOfInterval({ start: range.start, end: range.end });
    return months.map((month) => {
      const key = format(month, 'yyyy-MM');
      return {
        key,
        label: format(month, 'M月', { locale: zhCN }),
        totalBaseMinor: expenses
          .filter((expense) => expense.occurredOn.startsWith(key))
          .reduce((total, expense) => total + expense.baseAmountMinor, 0)
      };
    });
  }

  const days = eachDayOfInterval({ start: range.start, end: range.end });
  return days.map((day) => {
    const key = toDateKey(day);
    return {
      key,
      label: periodType === 'week'
        ? format(day, 'EEEEE', { locale: zhCN })
        : format(day, 'd', { locale: zhCN }),
      totalBaseMinor: expenses
        .filter((expense) => expense.occurredOn === key)
        .reduce((total, expense) => total + expense.baseAmountMinor, 0)
    };
  });
}

export function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function isFutureDateKey(value: string, now = new Date()): boolean {
  return isAfter(fromDateKey(value), new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
}

export function nextPeriodStart(periodType: PeriodType, range: PeriodRange): Date {
  if (periodType === 'week') return addWeeks(range.start, 1);
  if (periodType === 'year') return addYears(range.start, 1);
  return addMonths(range.start, 1);
}

export function periodBoundary(periodType: PeriodType, date: Date): Date {
  if (periodType === 'week') return startOfWeek(date, { weekStartsOn: 1 });
  if (periodType === 'year') return startOfYear(date);
  return startOfMonth(date);
}

export function addPeriodDays(date: Date, days: number): Date {
  return addDays(date, days);
}
