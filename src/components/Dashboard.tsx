import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays } from 'date-fns';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Plus,
  ReceiptText,
  Sparkles,
  WalletCards
} from 'lucide-react';
import { buildPeriodAnalytics } from '../lib/analytics';
import { convertFromBaseMinor, formatBaseMinor, formatOriginalAmount, RATE_SCALE } from '../lib/money';
import { formatPeriodLabel, getPeriodRange, isRangeCurrent, shiftPeriod } from '../lib/periods';
import { db } from '../data/db';
import { BASE_CURRENCY, CURRENCIES, type BudgetVersion, type Category, type CurrencyCode, type Expense, type PeriodType } from '../types';
import BudgetRing from './BudgetRing';
import CategoryIcon from './CategoryIcon';
import TrendChart from './TrendChart';

interface DashboardProps {
  expenses: Expense[];
  categories: Category[];
  budgets: BudgetVersion[];
  defaultPeriod: PeriodType;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onViewAll: () => void;
}

const periodLabels: Record<PeriodType, string> = {
  week: '周',
  month: '月',
  year: '年'
};

export default function Dashboard({ expenses, categories, budgets, defaultPeriod, onAdd, onEdit, onViewAll }: DashboardProps) {
  const [periodType, setPeriodType] = useState<PeriodType>(defaultPeriod);
  const [anchor, setAnchor] = useState(new Date());
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(BASE_CURRENCY);
  const fxRates = useLiveQuery(() => db.fxRates.toArray(), [], []);

  const analytics = useMemo(() => buildPeriodAnalytics({
    allExpenses: expenses,
    categories,
    budgets,
    periodType,
    anchor
  }), [anchor, budgets, categories, expenses, periodType]);

  const range = getPeriodRange(periodType, anchor);
  const isCurrent = isRangeCurrent(range);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const maxCategory = analytics.categoryTotals[0]?.totalBaseMinor ?? 1;
  const comparison = analytics.previousTotalBaseMinor > 0
    ? (analytics.totalBaseMinor - analytics.previousTotalBaseMinor) / analytics.previousTotalBaseMinor
    : null;
  const displayRate = displayCurrency === BASE_CURRENCY
    ? RATE_SCALE
    : fxRates.find((rate) => rate.currency === displayCurrency)?.rateToBaseScaled;
  const convertForDisplay = (baseAmountMinor: number): number | null => {
    if (!displayRate) return null;
    return convertFromBaseMinor(baseAmountMinor, displayCurrency, displayRate);
  };
  const formatForDisplay = (baseAmountMinor: number, compact = false): string => {
    const converted = convertForDisplay(baseAmountMinor);
    if (converted === null) return '汇率待更新';
    return displayCurrency === BASE_CURRENCY
      ? formatBaseMinor(converted, compact)
      : formatOriginalAmount(converted, displayCurrency);
  };
  const elapsedDays = isCurrent
    ? Math.max(1, differenceInCalendarDays(new Date(), range.start) + 1)
    : Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const averageDaily = analytics.expenses.length > 0
    ? analytics.totalBaseMinor / elapsedDays
    : 0;

  const changePeriodType = (next: PeriodType) => {
    setPeriodType(next);
    setAnchor(new Date());
  };

  return (
    <div className="dashboard page-stack">
      <section className="dashboard-toolbar">
        <div className="segmented" aria-label="统计周期">
          {(Object.keys(periodLabels) as PeriodType[]).map((type) => (
            <button
              type="button"
              key={type}
              className={periodType === type ? 'active' : ''}
              onClick={() => changePeriodType(type)}
            >
              {periodLabels[type]}
            </button>
          ))}
        </div>
        <div className="toolbar-controls">
          <label className="display-currency">
            <span>换算显示</span>
            <select value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value as CurrencyCode)}>
              {Object.values(CURRENCIES).map((currency) => (
                <option value={currency.code} key={currency.code}>{currency.flag} {currency.code}</option>
              ))}
            </select>
          </label>
          <div className="period-navigation">
          <button type="button" className="icon-button" onClick={() => setAnchor((value) => shiftPeriod(value, periodType, -1))} aria-label="上一个周期">
            <ChevronLeft size={19} />
          </button>
          <span><CalendarDays size={16} /> {formatPeriodLabel(periodType, range)}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setAnchor((value) => shiftPeriod(value, periodType, 1))}
            disabled={isCurrent}
            aria-label="下一个周期"
          >
            <ChevronRight size={19} />
          </button>
          {!isCurrent && <button type="button" className="text-button" onClick={() => setAnchor(new Date())}>回到本期</button>}
          </div>
        </div>
      </section>

      <section className="hero-grid">
        <article className="hero-card">
          <div className="hero-topline">
            <span>{analytics.label}总花费 · {displayCurrency}</span>
            {comparison !== null && (
              <span className={comparison <= 0 ? 'change positive' : 'change negative'}>
                {comparison <= 0 ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                较上期 {Math.abs(Math.round(comparison * 100))}%
              </span>
            )}
          </div>
          <strong className="hero-total">{formatForDisplay(analytics.totalBaseMinor)}</strong>
          <p>共 {analytics.expenses.length} 笔消费 · {analytics.currencyTotals.length || 0} 种币种</p>
          <div className="hero-meta">
            <div>
              <span>日均花费</span>
              <b>{formatForDisplay(Math.round(averageDaily))}</b>
            </div>
            <div>
              <span>最大分类</span>
              <b>{analytics.categoryTotals[0] ? categoryMap.get(analytics.categoryTotals[0].categoryId)?.name ?? '未分类' : '暂无'}</b>
            </div>
            <button type="button" onClick={onAdd}><Plus size={17} /> 记一笔</button>
          </div>
        </article>

        <article className="budget-card">
          <div className="budget-card-copy">
            <div>
              <p className="eyebrow">预算状态</p>
              <h2>{analytics.budget.budget ? '掌控节奏' : '还没有设置预算'}</h2>
            </div>
            {analytics.budget.budget ? (
              <div className="budget-numbers">
                <p>剩余额度</p>
                <strong className={analytics.budget.remainingBaseMinor !== null && analytics.budget.remainingBaseMinor < 0 ? 'negative' : ''}>
                  {formatBaseMinor(analytics.budget.remainingBaseMinor ?? 0)}
                </strong>
                <small>预算 {formatBaseMinor(analytics.budget.budget.amountBaseMinor)}</small>
              </div>
            ) : (
              <p className="muted">在预算页设置总预算，系统会持续评估消费进度。</p>
            )}
          </div>
          <BudgetRing usage={analytics.budget.usage} status={analytics.budget.status} />
        </article>
      </section>

      <section className="content-grid">
        <article className="panel trend-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">消费走势</p>
              <h2>{periodType === 'year' ? '月度趋势' : '每日趋势'}</h2>
            </div>
            <span className="panel-badge">{displayCurrency} · 最新汇率估算</span>
          </header>
          {analytics.expenses.length > 0
            ? <TrendChart points={analytics.trend} currency={displayCurrency} rateToBaseScaled={displayRate ?? 0} />
            : <div className="mini-empty">记录消费后显示趋势</div>}
        </article>

        <article className="panel category-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">分类分布</p>
              <h2>钱花在了哪里</h2>
            </div>
          </header>
          {analytics.categoryTotals.length > 0 ? (
            <div className="category-breakdown">
              {analytics.categoryTotals.slice(0, 6).map((item) => {
                const category = categoryMap.get(item.categoryId);
                const share = analytics.totalBaseMinor ? item.totalBaseMinor / analytics.totalBaseMinor : 0;
                return (
                  <div className="category-row" key={item.categoryId}>
                    <span className="category-list-icon" style={{ background: category?.color ?? '#7d8597' }}>
                      <CategoryIcon icon={category?.icon ?? 'other'} size={16} />
                    </span>
                    <div className="category-row-copy">
                      <div><strong>{category?.name ?? '已归档分类'}</strong><span>{Math.round(share * 100)}%</span></div>
                      <div className="progress-track"><i style={{ width: `${item.totalBaseMinor / maxCategory * 100}%`, background: category?.color ?? '#7d8597' }} /></div>
                    </div>
                    <b>{formatForDisplay(item.totalBaseMinor)}</b>
                  </div>
                );
              })}
            </div>
          ) : <div className="mini-empty">暂无分类数据</div>}
        </article>
      </section>

      <section className="content-grid lower-grid">
        <article className="panel insight-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">消费总结</p>
              <h2>给你的建议</h2>
            </div>
            <Sparkles size={20} className="panel-icon" aria-hidden="true" />
          </header>
          <div className="insights-list">
            {analytics.insights.map((insight, index) => (
              <div className={`insight ${insight.tone}`} key={`${insight.title}-${index}`}>
                <span className="insight-icon">{insight.tone === 'positive' ? <Sparkles size={17} /> : <Lightbulb size={17} />}</span>
                <div><strong>{insight.title}</strong><p>{insight.body}</p></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel currency-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">原币汇总</p>
              <h2>多币种账单</h2>
            </div>
            <WalletCards size={20} className="panel-icon" aria-hidden="true" />
          </header>
          {analytics.currencyTotals.length > 0 ? (
            <div className="currency-list">
              {analytics.currencyTotals.map((item) => (
                <div className="currency-row" key={item.currency}>
                  <div><strong>{item.currency}</strong><span>{item.count} 笔</span></div>
                  <div><b>{formatOriginalAmount(item.originalMinor, item.currency)}</b><span>≈ {formatBaseMinor(item.baseMinor)}</span></div>
                </div>
              ))}
            </div>
          ) : <div className="mini-empty">暂无外币账单</div>}
        </article>
      </section>

      <section className="panel recent-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">最近记录</p>
            <h2>本期账单</h2>
          </div>
          <button type="button" className="text-button" onClick={onViewAll}>查看全部 <ArrowRight size={15} /></button>
        </header>
        {analytics.expenses.length > 0 ? (
          <div className="recent-list">
            {analytics.expenses.slice(0, 6).map((expense) => {
              const category = categoryMap.get(expense.categoryId);
              return (
                <button type="button" className="recent-row" key={expense.id} onClick={() => onEdit(expense)}>
                  <span className="category-list-icon" style={{ background: category?.color ?? '#7d8597' }}>
                    <CategoryIcon icon={category?.icon ?? 'other'} size={17} />
                  </span>
                  <span className="recent-main">
                    <strong>{category?.name ?? '已归档分类'}</strong>
                    <small>{expense.occurredOn}{expense.note ? ` · ${expense.note}` : ''}</small>
                  </span>
                  <span className="recent-amount">
                    <strong>{formatOriginalAmount(expense.amountMinor, expense.currency)}</strong>
                    {expense.currency !== BASE_CURRENCY && <small>≈ {formatBaseMinor(expense.baseAmountMinor)}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <button type="button" className="empty-inline" onClick={onAdd}>
            <ReceiptText size={22} /><span><strong>还没有账单</strong><small>点击这里记录第一笔消费</small></span>
          </button>
        )}
      </section>
    </div>
  );
}
