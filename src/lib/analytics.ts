import type {
  BudgetProgress,
  BudgetVersion,
  Category,
  CurrencyCode,
  Expense,
  PeriodType
} from '../types';
import { buildInsights } from './advice';
import {
  buildTrend,
  expensesInRange,
  formatPeriodLabel,
  getPeriodProgress,
  getPeriodRange,
  getPreviousRange
} from './periods';

export function resolveBudget(
  budgets: BudgetVersion[],
  periodType: PeriodType,
  periodStart: string,
  categoryId: string | null
): BudgetVersion | null {
  const candidates = budgets
    .filter((budget) =>
      budget.periodType === periodType &&
      budget.categoryId === categoryId &&
      budget.effectiveFrom <= periodStart
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));

  return candidates[0] ?? null;
}

export function getBudgetProgress(
  budgets: BudgetVersion[],
  periodType: PeriodType,
  periodStart: string,
  spentBaseMinor: number,
  categoryId: string | null = null
): BudgetProgress {
  const budget = resolveBudget(budgets, periodType, periodStart, categoryId);

  if (!budget) {
    return { budget: null, spentBaseMinor, remainingBaseMinor: null, usage: null, status: 'unset' };
  }

  const usage = spentBaseMinor / budget.amountBaseMinor;
  const status = usage > 1 ? 'over' : usage >= 0.8 ? 'warning' : 'normal';

  return {
    budget,
    spentBaseMinor,
    remainingBaseMinor: budget.amountBaseMinor - spentBaseMinor,
    usage,
    status
  };
}

export function buildPeriodAnalytics(input: {
  allExpenses: Expense[];
  categories: Category[];
  budgets: BudgetVersion[];
  periodType: PeriodType;
  anchor: Date;
  now?: Date;
}) {
  const { allExpenses, categories, budgets, periodType, anchor, now = new Date() } = input;
  const range = getPeriodRange(periodType, anchor);
  const previousRange = getPreviousRange(periodType, range);
  const expenses = expensesInRange(allExpenses, range).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const previousExpenses = expensesInRange(allExpenses, previousRange);
  const totalBaseMinor = expenses.reduce((total, expense) => total + expense.baseAmountMinor, 0);
  const previousTotalBaseMinor = previousExpenses.reduce((total, expense) => total + expense.baseAmountMinor, 0);

  const categoryMap = new Map<string, { totalBaseMinor: number; count: number }>();
  const currencyMap = new Map<CurrencyCode, { originalMinor: number; baseMinor: number; count: number }>();

  for (const expense of expenses) {
    const category = categoryMap.get(expense.categoryId) ?? { totalBaseMinor: 0, count: 0 };
    category.totalBaseMinor += expense.baseAmountMinor;
    category.count += 1;
    categoryMap.set(expense.categoryId, category);

    const currency = currencyMap.get(expense.currency) ?? { originalMinor: 0, baseMinor: 0, count: 0 };
    currency.originalMinor += expense.amountMinor;
    currency.baseMinor += expense.baseAmountMinor;
    currency.count += 1;
    currencyMap.set(expense.currency, currency);
  }

  const categoryTotals = [...categoryMap.entries()]
    .map(([categoryId, totals]) => ({ categoryId, ...totals }))
    .sort((left, right) => right.totalBaseMinor - left.totalBaseMinor);
  const currencyTotals = [...currencyMap.entries()]
    .map(([currency, totals]) => ({ currency, ...totals }))
    .sort((left, right) => right.baseMinor - left.baseMinor);
  const budget = getBudgetProgress(budgets, periodType, range.startKey, totalBaseMinor);

  const categoryBudgetProgress = budgets
    .filter((candidate) => candidate.categoryId !== null)
    .map((candidate) => candidate.categoryId as string)
    .filter((categoryId, index, list) => list.indexOf(categoryId) === index)
    .map((categoryId) => {
      const categoryTotal = categoryTotals.find((item) => item.categoryId === categoryId)?.totalBaseMinor ?? 0;
      return getBudgetProgress(budgets, periodType, range.startKey, categoryTotal, categoryId).budget
        ? { categoryId, ...getBudgetProgress(budgets, periodType, range.startKey, categoryTotal, categoryId) }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const label = formatPeriodLabel(periodType, range);
  const topCategory = categoryTotals[0]
    ? categories.find((category) => category.id === categoryTotals[0].categoryId) ?? null
    : null;

  const insights = buildInsights({
    hasExpenses: expenses.length > 0,
    periodType,
    periodLabel: label,
    periodProgress: getPeriodProgress(range, now),
    totalBaseMinor,
    previousTotalBaseMinor,
    topCategory,
    topCategoryTotal: categoryTotals[0]?.totalBaseMinor ?? 0,
    budget,
    categoryBudgets: categoryBudgetProgress,
    categoryNames: new Map(categories.map((category) => [category.id, category.name]))
  });

  return {
    periodType,
    start: range.startKey,
    end: range.endKey,
    label,
    totalBaseMinor,
    previousTotalBaseMinor,
    expenses,
    categoryTotals,
    currencyTotals,
    trend: buildTrend(periodType, range, expenses),
    budget,
    insights
  };
}
