import { db } from '../data/db';
import type { AppBackup, Category, Expense, FxRateCache } from '../types';
import { CURRENCIES } from '../types';
import { minorToMajor } from '../lib/money';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function createBackup(): Promise<AppBackup> {
  const [expenses, categories, budgets, fxRates, settings] = await Promise.all([
    db.expenses.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.fxRates.toArray(),
    db.settings.toArray()
  ]);

  return {
    app: 'yuanledger',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    expenses,
    categories,
    budgets,
    fxRates,
    settings
  };
}

export async function exportJsonBackup(): Promise<void> {
  const backup = await createBackup();
  const date = new Date().toLocaleDateString('en-CA');
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }),
    `yuanledger-backup-${date}.json`
  );
}

function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== 'object') return false;
  const expense = value as Partial<Expense>;
  return typeof expense.id === 'string' &&
    typeof expense.occurredOn === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(expense.occurredOn) &&
    Number.isSafeInteger(expense.amountMinor) &&
    expense.amountMinor! > 0 &&
    typeof expense.currency === 'string' &&
    expense.currency in CURRENCIES &&
    Number.isSafeInteger(expense.rateToBaseScaled) &&
    expense.rateToBaseScaled! > 0 &&
    Number.isSafeInteger(expense.baseAmountMinor) &&
    expense.baseAmountMinor! > 0 &&
    typeof expense.categoryId === 'string';
}

function isCategory(value: unknown): value is Category {
  if (!value || typeof value !== 'object') return false;
  const category = value as Partial<Category>;
  return typeof category.id === 'string' && typeof category.name === 'string';
}

function isFxRate(value: unknown): value is FxRateCache {
  if (!value || typeof value !== 'object') return false;
  const rate = value as Partial<FxRateCache>;
  return typeof rate.currency === 'string' &&
    rate.currency in CURRENCIES &&
    Number.isSafeInteger(rate.rateToBaseScaled) &&
    rate.rateToBaseScaled! > 0;
}

export function parseBackup(value: unknown): AppBackup {
  if (!value || typeof value !== 'object') throw new Error('备份文件内容无效');
  const backup = value as Partial<AppBackup>;

  if (backup.app !== 'yuanledger' || backup.schemaVersion !== 2) {
    throw new Error('备份版本不受支持');
  }

  if (!Array.isArray(backup.expenses) || !backup.expenses.every(isExpense)) {
    throw new Error('账单数据损坏或格式不正确');
  }

  if (!Array.isArray(backup.categories) || !backup.categories.every(isCategory)) {
    throw new Error('分类数据损坏或格式不正确');
  }

  if (!Array.isArray(backup.budgets) || !Array.isArray(backup.fxRates) || !Array.isArray(backup.settings)) {
    throw new Error('备份内容不完整');
  }

  if (!backup.fxRates.every(isFxRate)) {
    throw new Error('汇率数据损坏或格式不正确');
  }

  return backup as AppBackup;
}

export async function importJsonBackup(file: File): Promise<AppBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('无法读取 JSON 文件');
  }

  const backup = parseBackup(parsed);

  await db.transaction('rw', [db.expenses, db.categories, db.budgets, db.fxRates, db.settings], async () => {
    await Promise.all([
      db.expenses.clear(),
      db.categories.clear(),
      db.budgets.clear(),
      db.fxRates.clear(),
      db.settings.clear()
    ]);
    await db.expenses.bulkAdd(backup.expenses);
    await db.categories.bulkAdd(backup.categories);
    await db.budgets.bulkAdd(backup.budgets);
    await db.fxRates.bulkAdd(backup.fxRates);
    await db.settings.bulkAdd(backup.settings);
  });

  return backup;
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function exportCsv(): Promise<void> {
  const [expenses, categories] = await Promise.all([
    db.expenses.orderBy('occurredOn').reverse().toArray(),
    db.categories.toArray()
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const rows = [
    ['日期', '原币金额', '币种', '汇率(1币=英镑)', '英镑金额', '分类', '备注'],
    ...expenses.map((expense) => [
      expense.occurredOn,
      minorToMajor(expense.amountMinor, expense.currency).toFixed(CURRENCIES[expense.currency].digits),
      expense.currency,
      (expense.rateToBaseScaled / 100_000_000).toFixed(6),
      (expense.baseAmountMinor / 100).toFixed(2),
      categoryNames.get(expense.categoryId) ?? '已归档分类',
      expense.note
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const date = new Date().toLocaleDateString('en-CA');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `yuanledger-${date}.csv`);
}
