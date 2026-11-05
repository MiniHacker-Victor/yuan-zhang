import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, History, PiggyBank, Save, Target } from 'lucide-react';
import { db } from '../data/db';
import { getBudgetProgress, resolveBudget } from '../lib/analytics';
import { formatBaseMinor, parseAmountToMinor } from '../lib/money';
import { formatPeriodLabel, getPeriodRange, nextPeriodStart, toDateKey } from '../lib/periods';
import type { BudgetVersion, Category, Expense, PeriodType } from '../types';
import { BASE_CURRENCY } from '../types';
import BudgetRing from './BudgetRing';
import CategoryIcon from './CategoryIcon';

interface BudgetsProps {
  budgets: BudgetVersion[];
  categories: Category[];
  expenses: Expense[];
  defaultPeriod: PeriodType;
  notify: (message: string, tone?: 'default' | 'success' | 'danger') => void;
}

const periodNames: Record<PeriodType, string> = { week: '每周', month: '每月', year: '每年' };

function amountForBudget(budget: BudgetVersion | null): string {
  return budget ? (budget.amountBaseMinor / 100).toFixed(2) : '';
}

export default function Budgets({ budgets, categories, expenses, defaultPeriod, notify }: BudgetsProps) {
  const [periodType, setPeriodType] = useState<PeriodType>(defaultPeriod);
  const [totalAmount, setTotalAmount] = useState('');
  const [totalEffective, setTotalEffective] = useState<'current' | 'next'>('current');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [categoryAmount, setCategoryAmount] = useState('');
  const [categoryEffective, setCategoryEffective] = useState<'current' | 'next'>('current');
  const [saving, setSaving] = useState<'total' | 'category' | null>(null);

  const range = useMemo(() => getPeriodRange(periodType, new Date()), [periodType]);
  const spentBaseMinor = useMemo(() => expenses
    .filter((expense) => expense.occurredOn >= range.startKey && expense.occurredOn <= range.endKey)
    .reduce((total, expense) => total + expense.baseAmountMinor, 0), [expenses, range.endKey, range.startKey]);
  const progress = getBudgetProgress(budgets, periodType, range.startKey, spentBaseMinor);
  const activeTotalBudget = resolveBudget(budgets, periodType, range.startKey, null);
  const activeCategoryBudget = resolveBudget(budgets, periodType, range.startKey, categoryId);

  useEffect(() => {
    setTotalAmount(amountForBudget(activeTotalBudget));
    setTotalEffective(activeTotalBudget ? 'next' : 'current');
  }, [activeTotalBudget, periodType]);

  useEffect(() => {
    setCategoryAmount(amountForBudget(activeCategoryBudget));
    setCategoryEffective(activeCategoryBudget ? 'next' : 'current');
  }, [activeCategoryBudget, categoryId, periodType]);

  const categoryBudgets = useMemo(() => budgets
    .filter((budget) => budget.categoryId !== null)
    .map((budget) => budget.categoryId as string)
    .filter((id, index, list) => list.indexOf(id) === index)
    .map((id) => ({ category: categories.find((category) => category.id === id), budget: resolveBudget(budgets, periodType, range.startKey, id) }))
    .filter((item): item is { category: Category; budget: BudgetVersion } => Boolean(item.category && item.budget))
    .sort((left, right) => left.category.sortOrder - right.category.sortOrder), [budgets, categories, periodType, range.startKey]);

  const categoryBudgetTotal = categoryBudgets.reduce((total, item) => total + item.budget.amountBaseMinor, 0);
  const categoryOverAllocation = activeTotalBudget && categoryBudgetTotal > activeTotalBudget.amountBaseMinor;

  const saveBudget = async (scope: 'total' | 'category') => {
    const input = scope === 'total' ? totalAmount : categoryAmount;
    const amountMinor = parseAmountToMinor(input, BASE_CURRENCY);
    if (!amountMinor) {
      notify('请输入大于 0 的预算金额。', 'danger');
      return;
    }

    const selectedCategoryId = scope === 'category' ? categoryId : null;
    if (scope === 'category' && !selectedCategoryId) {
      notify('请先选择分类。', 'danger');
      return;
    }

    const effectiveChoice = scope === 'total' ? totalEffective : categoryEffective;
    const effectiveFrom = effectiveChoice === 'current'
      ? range.startKey
      : toDateKey(nextPeriodStart(periodType, range));
    const existing = budgets.find((budget) =>
      budget.periodType === periodType &&
      budget.categoryId === selectedCategoryId &&
      budget.effectiveFrom === effectiveFrom
    );

    setSaving(scope);
    try {
      await db.budgets.put({
        id: existing?.id ?? crypto.randomUUID(),
        periodType,
        categoryId: selectedCategoryId,
        amountBaseMinor: amountMinor,
        effectiveFrom,
        createdAt: existing?.createdAt ?? new Date().toISOString()
      });
      notify(effectiveChoice === 'current' ? '预算已在本期生效。' : '预算将从下期开始生效。', 'success');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="page-stack budgets-page">
      <section className="budget-intro">
        <div>
          <p className="eyebrow">预算计划</p>
          <h2>为每个周期设一道边界</h2>
          <p>预算统一以英镑计算。修改预算会保留历史版本，过去的消费判断不会被新金额覆盖。</p>
        </div>
        <div className="segmented" aria-label="预算周期">
          {(Object.keys(periodNames) as PeriodType[]).map((type) => (
            <button type="button" key={type} className={periodType === type ? 'active' : ''} onClick={() => setPeriodType(type)}>
              {periodNames[type]}
            </button>
          ))}
        </div>
      </section>

      <section className="content-grid budget-overview-grid">
        <article className="panel budget-progress-panel">
          <div>
            <p className="eyebrow">{formatPeriodLabel(periodType, range)}</p>
            <h2>{progress.budget ? '预算使用情况' : '本期尚未设置预算'}</h2>
            <div className="budget-progress-copy">
              <span>已花费<strong>{formatBaseMinor(spentBaseMinor)}</strong></span>
              <span>预算总额<strong>{progress.budget ? formatBaseMinor(progress.budget.amountBaseMinor) : '—'}</strong></span>
              <span>剩余额度<strong className={(progress.remainingBaseMinor ?? 0) < 0 ? 'negative' : ''}>{progress.remainingBaseMinor === null ? '—' : formatBaseMinor(progress.remainingBaseMinor)}</strong></span>
            </div>
            {progress.budget && progress.remainingBaseMinor !== null && progress.remainingBaseMinor < 0 && (
              <p className="budget-alert"><AlertTriangle size={16} /> 已超出预算，建议暂停非必要支出。</p>
            )}
          </div>
          <BudgetRing usage={progress.usage} status={progress.status} size={132} />
        </article>

        <article className="panel budget-form-panel">
          <header className="panel-header">
            <div><p className="eyebrow">总预算</p><h2>{periodNames[periodType]}支出上限</h2></div>
            <Target size={21} className="panel-icon" />
          </header>
          <label className="field money-field">
            <span>预算金额（英镑）</span>
            <div><span>£</span><input inputMode="decimal" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="例如 800.00" /></div>
          </label>
          <div className="effective-choice">
            <span>生效时间</span>
            <label><input type="radio" name="total-effective" checked={totalEffective === 'current'} onChange={() => setTotalEffective('current')} /> 本期立即生效</label>
            <label><input type="radio" name="total-effective" checked={totalEffective === 'next'} onChange={() => setTotalEffective('next')} /> 下期开始生效</label>
          </div>
          <button type="button" className="button primary full" onClick={() => void saveBudget('total')} disabled={saving === 'total'}>
            <Save size={17} /> {saving === 'total' ? '保存中' : activeTotalBudget ? '保存新版本' : '设置总预算'}
          </button>
        </article>
      </section>

      <section className="content-grid budget-detail-grid">
        <article className="panel category-budget-editor">
          <header className="panel-header">
            <div><p className="eyebrow">分类预算</p><h2>重点分类单独控制</h2></div>
            <PiggyBank size={21} className="panel-icon" />
          </header>
          <div className="form-grid two">
            <label className="field">
              <span>选择分类</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                {categories.filter((category) => !category.archived).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>预算金额（英镑）</span>
              <input inputMode="decimal" value={categoryAmount} onChange={(event) => setCategoryAmount(event.target.value)} placeholder="0.00" />
            </label>
          </div>
          <div className="effective-choice horizontal">
            <label><input type="radio" name="category-effective" checked={categoryEffective === 'current'} onChange={() => setCategoryEffective('current')} /> 本期立即生效</label>
            <label><input type="radio" name="category-effective" checked={categoryEffective === 'next'} onChange={() => setCategoryEffective('next')} /> 下期开始生效</label>
          </div>
          <button type="button" className="button primary" onClick={() => void saveBudget('category')} disabled={saving === 'category' || !categoryId}>
            <Check size={17} /> {saving === 'category' ? '保存中' : activeCategoryBudget ? '保存分类预算' : '添加分类预算'}
          </button>
          {categoryOverAllocation && (
            <p className="budget-alert"><AlertTriangle size={16} /> 分类预算合计已超过总预算，请确认分配是否合理。</p>
          )}
        </article>

        <article className="panel active-budgets-panel">
          <header className="panel-header">
            <div><p className="eyebrow">当前生效</p><h2>分类分配</h2></div>
            <span className="panel-badge">{categoryBudgets.length} 项</span>
          </header>
          {categoryBudgets.length > 0 ? (
            <div className="active-budget-list">
              {categoryBudgets.map(({ category, budget }) => {
                const spent = expenses
                  .filter((expense) => expense.occurredOn >= range.startKey && expense.occurredOn <= range.endKey && expense.categoryId === category.id)
                  .reduce((total, expense) => total + expense.baseAmountMinor, 0);
                const usage = spent / budget.amountBaseMinor;
                return (
                  <button
                    type="button"
                    className="active-budget-row"
                    key={category.id}
                    onClick={() => setCategoryId(category.id)}
                  >
                    <span className="category-list-icon" style={{ background: category.color }}><CategoryIcon icon={category.icon} size={16} /></span>
                    <span><strong>{category.name}</strong><small>{formatBaseMinor(spent)} / {formatBaseMinor(budget.amountBaseMinor)}</small></span>
                    <b className={usage > 1 ? 'negative' : usage >= 0.8 ? 'warning-text' : ''}>{Math.round(usage * 100)}%</b>
                  </button>
                );
              })}
            </div>
          ) : <div className="mini-empty">还没有分类预算</div>}
          <p className="history-note"><History size={15} /> 保存后，旧预算版本仍用于计算历史周期。</p>
        </article>
      </section>
    </div>
  );
}
