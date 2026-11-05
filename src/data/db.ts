import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, BudgetVersion, Category, Expense, FxRateCache } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';

export class LedgerDatabase extends Dexie {
  expenses!: EntityTable<Expense, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  budgets!: EntityTable<BudgetVersion, 'id'>;
  fxRates!: EntityTable<FxRateCache, 'currency'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('yuanledger');

    this.version(1).stores({
      expenses: 'id, occurredOn, currency, categoryId, createdAt',
      categories: 'id, sortOrder, archived',
      budgets: 'id, periodType, categoryId, effectiveFrom, [periodType+categoryId+effectiveFrom]',
      fxRates: 'currency, rateDate, fetchedAt',
      settings: 'id'
    });

    this.on('populate', (transaction) => {
      void transaction.table('categories').bulkAdd(DEFAULT_CATEGORIES);
      void transaction.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new LedgerDatabase();

export async function ensureDefaults(): Promise<void> {
  const [categoryCount, settings] = await Promise.all([
    db.categories.count(),
    db.settings.get('app')
  ]);

  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  if (!settings) {
    await db.settings.add(DEFAULT_SETTINGS);
  }
}
