import { describe, expect, it } from 'vitest';
import {
  buildTrend,
  formatPeriodLabel,
  getPeriodProgress,
  getPeriodRange,
  getPreviousRange,
  shiftPeriod
} from './periods';
import type { Expense } from '../types';

const expense = (occurredOn: string, baseAmountMinor: number): Expense => ({
  id: occurredOn,
  occurredOn,
  amountMinor: baseAmountMinor,
  currency: 'GBP',
  rateToBaseScaled: 100_000_000,
  baseAmountMinor,
  categoryId: 'food',
  note: '',
  createdAt: `${occurredOn}T00:00:00.000Z`,
  updatedAt: `${occurredOn}T00:00:00.000Z`
});

describe('period helpers', () => {
  it('uses Monday through Sunday for weekly ranges', () => {
    const range = getPeriodRange('week', new Date(2026, 8, 16, 12));
    expect(range.startKey).toBe('2026-09-14');
    expect(range.endKey).toBe('2026-09-20');
    expect(formatPeriodLabel('week', range)).toBe('9月14日–9月20日');
  });

  it('handles month and year boundaries', () => {
    const range = getPeriodRange('month', new Date(2026, 0, 15));
    expect(range.startKey).toBe('2026-01-01');
    expect(range.endKey).toBe('2026-01-31');
    expect(getPreviousRange('month', range).startKey).toBe('2025-12-01');

    const year = getPeriodRange('year', new Date(2026, 5, 1));
    expect(year.startKey).toBe('2026-01-01');
    expect(year.endKey).toBe('2026-12-31');
    expect(shiftPeriod(year.start, 'year', 1).getFullYear()).toBe(2027);
  });

  it('calculates inclusive period progress', () => {
    const range = getPeriodRange('week', new Date(2026, 8, 16));
    expect(getPeriodProgress(range, new Date(2026, 8, 16, 12))).toBeCloseTo(3 / 7);
    expect(getPeriodProgress(range, new Date(2026, 8, 30))).toBe(1);
  });

  it('aggregates weekly expense buckets by local date', () => {
    const range = getPeriodRange('week', new Date(2026, 8, 16));
    const points = buildTrend('week', range, [expense('2026-09-14', 1000), expense('2026-09-14', 500), expense('2026-09-16', 2000)]);
    expect(points).toHaveLength(7);
    expect(points[0].totalBaseMinor).toBe(1500);
    expect(points[2].totalBaseMinor).toBe(2000);
  });
});
