import { useMemo, useState } from 'react';
import {
  CalendarRange,
  Check,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { db } from '../data/db';
import { formatBaseMinor, formatOriginalAmount, formatRate } from '../lib/money';
import { CURRENCIES, type Category, type CurrencyCode, type Expense } from '../types';
import { BASE_CURRENCY } from '../types';
import CategoryIcon from './CategoryIcon';
import EmptyState from './EmptyState';

interface TransactionsProps {
  expenses: Expense[];
  categories: Category[];
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  notify: (message: string, tone?: 'default' | 'success' | 'danger') => void;
}

export default function Transactions({ expenses, categories, onAdd, onEdit, notify }: TransactionsProps) {
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState<'ALL' | CurrencyCode>('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const filtered = useMemo(() => expenses
    .filter((expense) =>
      (currency === 'ALL' || expense.currency === currency) &&
      (categoryId === 'ALL' || expense.categoryId === categoryId) &&
      (!startDate || expense.occurredOn >= startDate) &&
      (!endDate || expense.occurredOn <= endDate) &&
      (!query.trim() || expense.note.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    )
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt)), [categoryId, currency, endDate, expenses, query, startDate]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    for (const expense of filtered) {
      const group = groups.get(expense.occurredOn) ?? [];
      group.push(expense);
      groups.set(expense.occurredOn, group);
    }
    return [...groups.entries()];
  }, [filtered]);

  const totalBaseMinor = filtered.reduce((total, expense) => total + expense.baseAmountMinor, 0);
  const hasFilters = query || currency !== 'ALL' || categoryId !== 'ALL' || startDate || endDate;

  const clearFilters = () => {
    setQuery('');
    setCurrency('ALL');
    setCategoryId('ALL');
    setStartDate('');
    setEndDate('');
  };

  const removeExpense = async (expense: Expense) => {
    const category = categoryMap.get(expense.categoryId)?.name ?? '该账单';
    if (!window.confirm(`确认删除这笔${category} ${formatOriginalAmount(expense.amountMinor, expense.currency)}？删除后无法撤销。`)) {
      return;
    }
    await db.expenses.delete(expense.id);
    notify('账单已删除。', 'success');
  };

  return (
    <div className="page-stack transactions-page">
      <section className="page-summary-bar">
        <div>
          <p className="eyebrow">筛选结果</p>
          <strong>{formatBaseMinor(totalBaseMinor)}</strong>
          <span>共 {filtered.length} 笔账单</span>
        </div>
        <button type="button" className="button primary" onClick={onAdd}><Plus size={18} /> 记一笔</button>
      </section>

      <section className="panel filter-panel">
        <div className="filter-main">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索备注" aria-label="搜索备注" />
          </label>
          <label>
            <span>币种</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value as 'ALL' | CurrencyCode)}>
              <option value="ALL">全部币种</option>
              {Object.values(CURRENCIES).map((item) => <option value={item.code} key={item.code}>{item.flag} {item.code}</option>)}
            </select>
          </label>
          <label>
            <span>分类</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="ALL">全部分类</option>
              {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        <div className="filter-dates">
          <CalendarRange size={17} aria-hidden="true" />
          <label><span>从</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label><span>至</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          {hasFilters && <button type="button" className="text-button" onClick={clearFilters}><X size={15} /> 清除筛选</button>}
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={hasFilters ? <Search size={25} /> : <ReceiptText size={25} />}
            title={hasFilters ? '没有符合条件的账单' : '还没有账单'}
            body={hasFilters ? '尝试调整币种、分类或日期范围。' : '从第一笔消费开始，逐步了解自己的消费结构。'}
            action={hasFilters
              ? <button type="button" className="button secondary" onClick={clearFilters}>清除筛选</button>
              : <button type="button" className="button primary" onClick={onAdd}><Plus size={17} /> 记第一笔</button>}
          />
        </section>
      ) : (
        <section className="ledger-list">
          {grouped.map(([date, group]) => {
            const groupTotal = group.reduce((sum, item) => sum + item.baseAmountMinor, 0);
            return (
              <div className="ledger-day" key={date}>
                <header className="ledger-day-header">
                  <span>{new Date(`${date}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                  <strong>{formatBaseMinor(groupTotal)}</strong>
                </header>
                <div className="ledger-card">
                  {group.map((expense) => {
                    const category = categoryMap.get(expense.categoryId);
                    return (
                      <article className="ledger-row" key={expense.id}>
                        <span className="category-list-icon" style={{ background: category?.color ?? '#7d8597' }}>
                          <CategoryIcon icon={category?.icon ?? 'other'} size={18} />
                        </span>
                        <div className="ledger-row-main">
                          <strong>{category?.name ?? '已归档分类'}</strong>
                          <span>
                            {expense.note || '无备注'}
                            {expense.currency !== BASE_CURRENCY && ` · ${formatRate(expense.rateToBaseScaled)}`}
                          </span>
                        </div>
                        <div className="ledger-amount">
                          <strong>{formatOriginalAmount(expense.amountMinor, expense.currency)}</strong>
                          {expense.currency !== BASE_CURRENCY && <span>≈ {formatBaseMinor(expense.baseAmountMinor)}</span>}
                        </div>
                        <div className="row-actions">
                          <button type="button" className="icon-button small" onClick={() => onEdit(expense)} aria-label="编辑账单"><Pencil size={15} /></button>
                          <button type="button" className="icon-button small danger" onClick={() => void removeExpense(expense)} aria-label="删除账单"><Trash2 size={15} /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
