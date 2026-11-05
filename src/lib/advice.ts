import type { BudgetProgress, Category, Insight, PeriodType } from '../types';
import { formatBaseMinor } from './money';

interface CategoryBudgetProgress extends BudgetProgress {
  categoryId: string;
}

interface InsightInput {
  hasExpenses: boolean;
  periodType: PeriodType;
  periodLabel: string;
  periodProgress: number;
  totalBaseMinor: number;
  previousTotalBaseMinor: number;
  topCategory: Category | null;
  topCategoryTotal: number;
  budget: BudgetProgress;
  categoryBudgets: CategoryBudgetProgress[];
  categoryNames: Map<string, string>;
}

export function buildInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const periodName = input.periodLabel;

  if (!input.hasExpenses) {
    return [{
      tone: 'neutral',
      title: `${periodName}还没有支出`,
      body: '记下第一笔消费后，这里会自动分析预算、分类占比和消费趋势。'
    }];
  }

  const overCategory = input.categoryBudgets.find((item) => item.status === 'over');
  const warningCategory = input.categoryBudgets.find((item) => item.status === 'warning');
  const budget = input.budget.budget;

  if (budget && input.budget.usage !== null) {
    const usagePercent = Math.round(input.budget.usage * 100);

    if (input.budget.status === 'over') {
      insights.push({
        tone: 'danger',
        title: `${periodName}已超出预算`,
        body: `已花费 ${formatBaseMinor(input.totalBaseMinor)}，达到预算的 ${usagePercent}%，超出 ${formatBaseMinor(Math.abs(input.budget.remainingBaseMinor ?? 0))}。建议暂停非必要支出。`
      });
    } else if (input.budget.status === 'warning') {
      insights.push({
        tone: 'warning',
        title: `${periodName}预算接近上限`,
        body: `预算已使用 ${usagePercent}%，剩余 ${formatBaseMinor(input.budget.remainingBaseMinor ?? 0)}。后续消费请优先保留必要开支。`
      });
    } else if (input.periodProgress >= 0.2) {
      const projected = input.totalBaseMinor / input.periodProgress;
      if (projected > budget.amountBaseMinor * 1.05) {
        insights.push({
          tone: 'warning',
          title: '当前消费速度偏快',
          body: `按当前进度预计周期末花费约 ${formatBaseMinor(Math.round(projected))}，高于预算。可重点检查高频小额消费。`
        });
      }
    }
  }

  if (overCategory) {
    const categoryName = input.categoryNames.get(overCategory.categoryId) ?? '该分类';
    insights.push({
      tone: 'danger',
      title: `${categoryName}预算已超支`,
      body: `该分类已花费 ${formatBaseMinor(overCategory.spentBaseMinor)}，超出分类预算 ${formatBaseMinor(Math.abs(overCategory.remainingBaseMinor ?? 0))}。`
    });
  } else if (warningCategory && insights.length < 3) {
    const categoryName = input.categoryNames.get(warningCategory.categoryId) ?? '该分类';
    insights.push({
      tone: 'warning',
      title: `${categoryName}预算即将用尽`,
      body: `分类预算已使用 ${Math.round((warningCategory.usage ?? 0) * 100)}%，后续支出需要留意。`
    });
  }

  if (input.topCategory && input.totalBaseMinor > 0 && insights.length < 3) {
    const share = Math.round(input.topCategoryTotal / input.totalBaseMinor * 100);
    if (share >= 40) {
      insights.push({
        tone: 'neutral',
        title: `${input.topCategory.name}是最大支出项`,
        body: `占${periodName}总支出的 ${share}%，金额为 ${formatBaseMinor(input.topCategoryTotal)}。如果它不是必要开支，可从这项开始优化。`
      });
    }
  }

  if (input.previousTotalBaseMinor > 0 && insights.length < 3) {
    const change = (input.totalBaseMinor - input.previousTotalBaseMinor) / input.previousTotalBaseMinor;
    if (change <= -0.1) {
      insights.push({
        tone: 'positive',
        title: '花费比上期有所下降',
        body: `较上一周期减少 ${Math.round(Math.abs(change) * 100)}%，继续保持当前的消费节奏。`
      });
    } else if (change >= 0.2) {
      insights.push({
        tone: 'warning',
        title: '花费比上期明显增加',
        body: `较上一周期增加 ${Math.round(change * 100)}%，建议按分类核对新增支出。`
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      tone: 'positive',
      title: `${periodName}消费节奏平稳`,
      body: budget
        ? `已使用预算 ${Math.round((input.budget.usage ?? 0) * 100)}%，目前没有发现明显风险。`
        : '目前支出结构正常。设置预算后，可以获得更具体的进度判断。'
    });
  }

  return insights.slice(0, 3);
}
