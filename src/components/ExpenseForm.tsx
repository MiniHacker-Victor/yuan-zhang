import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BadgeDollarSign, CalendarDays, Check, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { db } from '../data/db';
import { convertToBaseMinor, formatBaseMinor, formatRate, parseAmountToMinor, parseRateToScaled, rateInputValue } from '../lib/money';
import { isFutureDateKey, toDateKey } from '../lib/periods';
import { getRateToBase } from '../services/fx';
import { BASE_CURRENCY, CURRENCIES, type Category, type CurrencyCode, type Expense } from '../types';
import CategoryIcon from './CategoryIcon';

interface ExpenseFormProps {
  expense: Expense | null;
  categories: Category[];
  defaultCurrency: CurrencyCode;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function ExpenseForm({ expense, categories, defaultCurrency, onClose, onSaved }: ExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [rate, setRate] = useState('1');
  const [occurredOn, setOccurredOn] = useState(toDateKey(new Date()));
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rateLoading, setRateLoading] = useState(false);

  const rateCache = useLiveQuery(
    async () => currency === BASE_CURRENCY ? undefined : await db.fxRates.get(currency),
    [currency]
  );

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setError('');
      if (expense) {
        setAmount(expense.amountMinor / 10 ** CURRENCIES[expense.currency].digits > 0
          ? (expense.amountMinor / 10 ** CURRENCIES[expense.currency].digits).toFixed(CURRENCIES[expense.currency].digits)
          : '');
        setCurrency(expense.currency);
        setRate(rateInputValue(expense.rateToBaseScaled));
        setOccurredOn(expense.occurredOn);
        setCategoryId(expense.categoryId);
        setNote(expense.note);
        return;
      }

      setAmount('');
      setCurrency(defaultCurrency);
      setOccurredOn(toDateKey(new Date()));
      setCategoryId(categories.find((category) => !category.archived)?.id ?? categories[0]?.id ?? '');
      setNote('');

      if (defaultCurrency === BASE_CURRENCY) {
        setRate('1');
        return;
      }

      setRateLoading(true);
      try {
        const cachedRate = await getRateToBase(defaultCurrency);
        if (!cancelled) setRate(rateInputValue(cachedRate));
      } catch {
        if (!cancelled) setRate('');
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [categories, defaultCurrency, expense]);

  const amountMinor = useMemo(() => parseAmountToMinor(amount, currency), [amount, currency]);
  const rateScaled = useMemo(() => parseRateToScaled(rate), [rate]);
  const baseAmountMinor = amountMinor && rateScaled
    ? convertToBaseMinor(amountMinor, currency, rateScaled)
    : null;
  const activeCategories = categories.filter((category) => !category.archived || category.id === categoryId);

  const changeCurrency = async (nextCurrency: CurrencyCode) => {
    setCurrency(nextCurrency);
    setError('');

    if (nextCurrency === BASE_CURRENCY) {
      setRate('1');
      return;
    }

    setRateLoading(true);
    try {
      const cachedRate = await getRateToBase(nextCurrency);
      setRate(rateInputValue(cachedRate));
    } catch {
      setRate('');
      setError(`${CURRENCIES[nextCurrency].name}暂无可用汇率，请填写 1 ${nextCurrency} 等于多少英镑。`);
    } finally {
      setRateLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!amountMinor) {
      setError('请输入大于 0 的正确金额。');
      return;
    }

    if (!categoryId) {
      setError('请选择消费分类。');
      return;
    }

    if (!occurredOn || isFutureDateKey(occurredOn)) {
      setError('请选择今天或更早的有效日期。');
      return;
    }

    if (!rateScaled) {
      setError('请输入大于 0 的英镑汇率。');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      await db.expenses.put({
        id: expense?.id ?? crypto.randomUUID(),
        amountMinor,
        currency,
        rateToBaseScaled: rateScaled,
        baseAmountMinor: convertToBaseMinor(amountMinor, currency, rateScaled),
        occurredOn,
        categoryId,
        note: note.trim(),
        createdAt: expense?.createdAt ?? now,
        updatedAt: now
      });
      onSaved(expense ? '账单已更新。' : '账单已记录。');
    } catch {
      setError('保存失败，请稍后重试。');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{expense ? '修改现有记录' : '快速记录消费'}</p>
            <h2 id="expense-form-title">{expense ? '编辑账单' : '记一笔'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="关闭">
            <X size={21} />
          </button>
        </header>

        <form onSubmit={submit} className="expense-form">
          <div className="amount-currency-row">
            <label className="field amount-field">
              <span>金额</span>
              <div className="amount-input-wrap">
                <span>{CURRENCIES[currency].symbol}</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  aria-label="账单金额"
                />
              </div>
            </label>

            <label className="field currency-field">
              <span>币种</span>
              <select value={currency} onChange={(event) => void changeCurrency(event.target.value as CurrencyCode)}>
                {Object.values(CURRENCIES).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.flag} {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid two">
            <label className="field">
              <span><CalendarDays size={15} aria-hidden="true" /> 消费日期</span>
              <input
                type="date"
                value={occurredOn}
                max={toDateKey(new Date())}
                onChange={(event) => setOccurredOn(event.target.value)}
              />
            </label>

            <label className="field">
              <span><BadgeDollarSign size={15} aria-hidden="true" /> 英镑汇率 {rateLoading && <LoaderCircle className="spin" size={14} />}</span>
              <div className="rate-input-wrap">
                <span>1 {currency} =</span>
                <input
                  inputMode="decimal"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  disabled={currency === BASE_CURRENCY}
                  aria-label={`1 ${currency} 等于多少英镑`}
                />
                <span>GBP</span>
              </div>
            </label>
          </div>

          <div className="rate-meta">
            <span>
              {currency === BASE_CURRENCY
                ? '英镑账单无需换算'
                : rateCache
                  ? `${rateCache.source === 'manual' ? '手动汇率' : '自动汇率'} · ${formatRate(rateCache.rateToBaseScaled)} · ${rateCache.rateDate}`
                  : '尚无缓存，请手动填写汇率'}
            </span>
            {currency !== BASE_CURRENCY && rateCache && (
              <button type="button" className="text-button" onClick={() => setRate(rateInputValue(rateCache.rateToBaseScaled))}>
                <RefreshCw size={14} /> 使用当前汇率
              </button>
            )}
          </div>

          <fieldset className="category-fieldset">
            <legend>消费分类</legend>
            <div className="category-picker">
              {activeCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={categoryId === category.id ? 'category-option selected' : 'category-option'}
                  style={{ '--category-color': category.color } as React.CSSProperties}
                  onClick={() => setCategoryId(category.id)}
                >
                  <span className="category-option-icon"><CategoryIcon icon={category.icon} /></span>
                  {category.name}
                  {categoryId === category.id && <Check size={14} className="category-check" />}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>备注 <small>可选</small></span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={120}
              placeholder="例如：和朋友晚餐、地铁月票"
            />
          </label>

          <div className="conversion-preview">
            <span>折算英镑</span>
            <strong>{baseAmountMinor ? formatBaseMinor(baseAmountMinor) : '等待输入金额和汇率'}</strong>
            <small>保存后此金额不会随未来汇率变化</small>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <footer className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>取消</button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
              {saving ? '保存中' : expense ? '保存修改' : '确认记账'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
