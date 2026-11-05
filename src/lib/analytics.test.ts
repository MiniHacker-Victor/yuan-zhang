import { describe, expect, it } from 'vitest';
import type { BudgetVersion, Category, Expense } from '../types';
import { buildPeriodAnalytics, getBudgetProgress, resolveBudget } from './analytics';

const budgets: BudgetVersion[] = [
  { id: 'old', periodType: 'month', categoryId: null, amountBaseMinor: 500_000, effectiveFrom: '2026-08-01', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'new', periodType: 'month', categoryId: null, amountBaseMinor: 800_000, effectiveFrom: '2026-09-01', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'food', periodType: 'month', categoryId: 'food', amountBaseMinor: 200_000, effectiveFrom: '2026-09-01', createdAt: '2026-09-01T00:00:00Z' }
];

const categories: Category[] = [
  { id: 'food', name: '餐饮', icon: 'food', color: '#e76f51', sortOrder: 10, archived: false, createdAt: '' },
  { id: 'transport', name: '交通', icon: 'transport', color: '#2a9d8f', sortOrder: 20, archived: false, createdAt: '' }
];

function expense(id: string, occurredOn: string, baseAmountMinor: number, categoryId = 'food'): Expense {
  return {
    id,
    occurredOn,
    amountMinor: baseAmountMinor,
    currency: 'GBP',
    rateToBaseScaled: 100_000_000,
    baseAmountMinor,
    categoryId,
    note: '',
    createdAt: `${occurredOn}T08:00:00Z`,
    updatedAt: `${occurredOn}T08:00:00Z`
  };
}

describe('budget analytics', () => {
  it('selects the latest budget effective before the period', () => {
    expect(resolveBudget(budgets, 'month', '2026-08-15', null)?.id).toBe('old');
    expect(resolveBudget(budgets, 'month', '2026-09-15', null)?.id).toBe('new');
    expect(resolveBudget(budgets, 'month', '2026-07-01', null)).toBeNull();
  });

  it('classifies normal, warning and over-budget states', () => {
    expect(getBudgetProgress(budgets, 'month', '2026-09-01', 400_000).status).toBe('normal');
    expect(getBudgetProgress(budgets, 'month', '2026-09-01', 700_000).status).toBe('warning');
    expect(getBudgetProgress(budgets, 'month', '2026-09-01', 810_000).status).toBe('over');
  });

  it('combines category, currency and advice calculations', () => {
    const analytics = buildPeriodAnalytics({
      allExpenses: [expense('food-1', '2026-09-02', 300_000), expense('transport-1', '2026-09-03', 100_000, 'transport')],
      categories,
      budgets,
      periodType: 'month',
      anchor: new Date(2026, 8, 15),
      now: new Date(2026, 8, 15)
    });

    expect(analytics.totalBaseMinor).toBe(400_000);
    expect(analytics.categoryTotals[0].categoryId).toBe('food');
    expect(analytics.currencyTotals[0].currency).toBe('GBP');
    expect(analytics.insights.length).toBeGreaterThan(0);
  });

  it('warns when category budget is exceeded', () => {
    const analytics = buildPeriodAnalytics({
      allExpenses: [expense('food-1', '2026-09-02', 230_000)],
      categories,
      budgets,
      periodType: 'month',
      anchor: new Date(2026, 8, 15),
      now: new Date(2026, 8, 15)
    });

    expect(analytics.insights.some((insight) => insight.title.includes('餐饮预算已超支'))).toBe(true);
  });
});
