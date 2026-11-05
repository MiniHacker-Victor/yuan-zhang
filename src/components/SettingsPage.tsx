import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive,
  Check,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards
} from 'lucide-react';
import { db } from '../data/db';
import { parseRateToScaled, rateInputValue, RATE_SCALE } from '../lib/money';
import { exportCsv, exportJsonBackup, importJsonBackup } from '../services/backup';
import { clearManualRate, getRateAgeLabel, setManualRate, syncRates } from '../services/fx';
import { BASE_CURRENCY, CURRENCIES, type Category, type CurrencyCode, type ForeignCurrencyCode, type PeriodType } from '../types';
import CategoryIcon from './CategoryIcon';

interface SettingsPageProps {
  notify: (message: string, tone?: 'default' | 'success' | 'danger') => void;
}

const categoryColors = ['#e76f51', '#2a9d8f', '#6a994e', '#457b9d', '#bc6c25', '#9d4edd', '#3a86ff'];

export default function SettingsPage({ notify }: SettingsPageProps) {
  const fxRates = useLiveQuery(() => db.fxRates.toArray(), [], []);
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'), [], undefined);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const rate of fxRates) next[rate.currency] = rateInputValue(rate.rateToBaseScaled);
    setRateInputs(next);
  }, [fxRates]);

  useEffect(() => {
    setCategoryNames(Object.fromEntries(categories.map((category) => [category.id, category.name])));
  }, [categories]);

  const foreignCurrencies = useMemo(
    () => Object.values(CURRENCIES).filter((item) => item.code !== BASE_CURRENCY),
    []
  ) as Array<(typeof CURRENCIES)[ForeignCurrencyCode]>;

  const refreshRates = async () => {
    setSyncing(true);
    try {
      const result = await syncRates(true);
      if (result.failed.length > 0) {
        notify(`已更新 ${result.updated.length} 种汇率，${result.failed.length} 种暂时无法获取。`, 'danger');
      } else {
        notify('汇率已更新。', 'success');
      }
    } finally {
      setSyncing(false);
    }
  };

  const saveManualRate = async (currency: ForeignCurrencyCode) => {
    const scaled = parseRateToScaled(rateInputs[currency] ?? '');
    if (!scaled) {
      notify('请输入大于 0 的有效汇率。', 'danger');
      return;
    }
    await setManualRate(currency, scaled);
    notify(`${currency} 已改为手动汇率。`, 'success');
  };

  const restoreAutoRate = async (currency: ForeignCurrencyCode) => {
    await clearManualRate(currency);
    notify(`${currency} 已恢复自动汇率。`, 'success');
  };

  const runImport = async (file: File) => {
    if (!window.confirm('导入会完整替换当前浏览器中的账单、预算和设置。是否继续？')) return;
    setImporting(true);
    try {
      await importJsonBackup(file);
      notify('备份已恢复。', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : '导入失败。', 'danger');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateSetting = async (change: Partial<{ defaultCurrency: CurrencyCode; defaultPeriod: PeriodType }>) => {
    const existing = await db.settings.get('app');
    if (!existing) return;
    await db.settings.put({ ...existing, ...change });
    notify('默认设置已更新。', 'success');
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) {
      notify('请输入分类名称。', 'danger');
      return;
    }
    if (categories.some((category) => category.name === name && !category.archived)) {
      notify('已存在同名分类。', 'danger');
      return;
    }
    const nextOrder = Math.max(0, ...categories.map((category) => category.sortOrder)) + 10;
    await db.categories.add({
      id: crypto.randomUUID(),
      name,
      icon: 'other',
      color: categoryColors[categories.length % categoryColors.length],
      sortOrder: nextOrder,
      archived: false,
      createdAt: new Date().toISOString()
    });
    setNewCategory('');
    notify('分类已添加。', 'success');
  };

  const renameCategory = async (category: Category) => {
    const name = categoryNames[category.id]?.trim();
    if (!name || name === category.name) {
      setCategoryNames((values) => ({ ...values, [category.id]: category.name }));
      return;
    }
    await db.categories.update(category.id, { name });
    notify('分类名称已更新。', 'success');
  };

  const toggleArchive = async (category: Category) => {
    await db.categories.update(category.id, { archived: !category.archived });
    notify(category.archived ? '分类已恢复。' : '分类已归档，历史账单仍然保留。', 'success');
  };

  const clearAllData = async () => {
    if (!window.confirm('确认清空所有账单、预算和分类吗？此操作无法撤销，建议先导出 JSON 备份。')) return;
    await db.transaction('rw', [db.expenses, db.budgets], async () => {
      await db.expenses.clear();
      await db.budgets.clear();
    });
    notify('账单和预算已清空。', 'success');
  };

  return (
    <div className="page-stack settings-page">
      <section className="settings-hero">
        <div className="settings-hero-icon"><ShieldCheck size={25} /></div>
        <div>
          <p className="eyebrow">本地优先</p>
          <h2>你的账本默认只留在这台设备</h2>
          <p>不注册账号、不上传账单。浏览器本地数据库负责保存，定期导出 JSON 即可完成备份。</p>
        </div>
      </section>

      <section className="content-grid settings-grid">
        <article className="panel settings-section">
          <header className="panel-header">
            <div><p className="eyebrow">记账偏好</p><h2>默认选项</h2></div>
            <Settings2 size={21} className="panel-icon" />
          </header>
          <label className="field">
            <span>默认记账币种</span>
            <select value={settings?.defaultCurrency ?? BASE_CURRENCY} onChange={(event) => void updateSetting({ defaultCurrency: event.target.value as CurrencyCode })}>
              {Object.values(CURRENCIES).map((currency) => <option key={currency.code} value={currency.code}>{currency.flag} {currency.code} · {currency.name}</option>)}
            </select>
          </label>
          <label className="field spaced-field">
            <span>预算页默认周期</span>
            <select value={settings?.defaultPeriod ?? 'month'} onChange={(event) => void updateSetting({ defaultPeriod: event.target.value as PeriodType })}>
              <option value="week">每周</option>
              <option value="month">每月</option>
              <option value="year">每年</option>
            </select>
          </label>
        </article>

        <article className="panel settings-section">
          <header className="panel-header">
            <div><p className="eyebrow">数据安全</p><h2>备份与迁移</h2></div>
            <Database size={21} className="panel-icon" />
          </header>
          <div className="settings-actions-list">
            <button type="button" className="settings-action" onClick={() => void exportJsonBackup().then(() => notify('JSON 备份已导出。', 'success'))}>
              <span><FileJson size={19} /></span><div><strong>导出完整备份</strong><small>账单、预算、分类和汇率，可用于完整恢复</small></div><Download size={17} />
            </button>
            <button type="button" className="settings-action" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <span>{importing ? <LoaderCircle className="spin" size={19} /> : <Upload size={19} />}</span><div><strong>从 JSON 恢复</strong><small>校验通过后替换当前本机数据</small></div>
            </button>
            <button type="button" className="settings-action" onClick={() => void exportCsv().then(() => notify('CSV 明细已导出。', 'success'))}>
              <span><FileSpreadsheet size={19} /></span><div><strong>导出 CSV 明细</strong><small>适合在 Excel 或 Numbers 中继续分析</small></div><Download size={17} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void runImport(file);
            }}
          />
        </article>
      </section>

      <section className="panel settings-section rates-section">
        <header className="panel-header">
          <div><p className="eyebrow">英镑汇率</p><h2>自动更新，也可手动覆盖</h2></div>
          <button type="button" className="button secondary" onClick={() => void refreshRates()} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} /> {syncing ? '更新中' : '刷新汇率'}
          </button>
        </header>
        <p className="section-description">自动汇率来自 Frankfurter 公共参考数据，通常为最近工作日；手动汇率不会在刷新时被覆盖。</p>
        <div className="fx-table">
          <div className="fx-row fx-head"><span>币种</span><span>1 单位兑英镑</span><span>状态</span><span>操作</span></div>
          {foreignCurrencies.map((currency) => {
            const rate = fxRates.find((item) => item.currency === currency.code);
            return (
              <div className="fx-row" key={currency.code}>
                <span className="fx-currency"><i>{currency.flag}</i><strong>{currency.code}</strong><small>{currency.name}</small></span>
                <label className="fx-input"><span>£</span><input inputMode="decimal" value={rateInputs[currency.code] ?? ''} onChange={(event) => setRateInputs((values) => ({ ...values, [currency.code]: event.target.value }))} /></label>
                <span className={rate?.source === 'manual' ? 'source-badge manual' : 'source-badge'}>{getRateAgeLabel(rate)}</span>
                <span className="fx-actions">
                  <button type="button" className="text-button" onClick={() => void saveManualRate(currency.code)}><Check size={14} /> 手动</button>
                  {rate?.source === 'manual' && <button type="button" className="text-button subtle" onClick={() => void restoreAutoRate(currency.code)}><RotateCcw size={14} /> 自动</button>}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel settings-section category-settings">
        <header className="panel-header">
          <div><p className="eyebrow">消费分类</p><h2>维护你的分类体系</h2></div>
          <span className="panel-badge">{categories.filter((category) => !category.archived).length} 个使用中</span>
        </header>
        <div className="new-category-row">
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="新分类名称" onKeyDown={(event) => { if (event.key === 'Enter') void addCategory(); }} />
          <button type="button" className="button primary" onClick={() => void addCategory()}><Plus size={16} /> 添加分类</button>
        </div>
        <div className="category-settings-list">
          {categories.map((category) => (
            <div className={category.archived ? 'category-settings-row archived' : 'category-settings-row'} key={category.id}>
              <span className="category-list-icon" style={{ background: category.color }}><CategoryIcon icon={category.icon} size={16} /></span>
              <input
                value={categoryNames[category.id] ?? ''}
                onChange={(event) => setCategoryNames((values) => ({ ...values, [category.id]: event.target.value }))}
                onBlur={() => void renameCategory(category)}
                aria-label={`${category.name}分类名称`}
              />
              <button type="button" className="text-button subtle" onClick={() => void toggleArchive(category)}>
                {category.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                {category.archived ? '恢复' : '归档'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="danger-zone">
        <div><Globe2 size={20} /><span><strong>清空本机账本</strong><small>只删除账单和预算，分类及设置保留。请先导出备份。</small></span></div>
        <button type="button" className="button danger" onClick={() => void clearAllData()}><Trash2 size={16} /> 清空数据</button>
      </section>
    </div>
  );
}
