export const CURRENCIES = {
  GBP: { code: 'GBP', name: '英镑', symbol: '£', digits: 2, flag: '🇬🇧' },
  CNY: { code: 'CNY', name: '人民币', symbol: '¥', digits: 2, flag: '🇨🇳' },
  USD: { code: 'USD', name: '美元', symbol: '$', digits: 2, flag: '🇺🇸' },
  HKD: { code: 'HKD', name: '港币', symbol: 'HK$', digits: 2, flag: '🇭🇰' },
  EUR: { code: 'EUR', name: '欧元', symbol: '€', digits: 2, flag: '🇪🇺' },
  JPY: { code: 'JPY', name: '日元', symbol: '¥', digits: 0, flag: '🇯🇵' }
} as const;

export const BASE_CURRENCY = 'GBP' as const;
export type CurrencyCode = keyof typeof CURRENCIES;
export type ForeignCurrencyCode = Exclude<CurrencyCode, typeof BASE_CURRENCY>;
export type PeriodType = 'week' | 'month' | 'year';
export type BudgetStatus = 'normal' | 'warning' | 'over';

export interface Expense {
  id: string;
  occurredOn: string;
  amountMinor: number;
  currency: CurrencyCode;
  rateToBaseScaled: number;
  baseAmountMinor: number;
  categoryId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

export interface BudgetVersion {
  id: string;
  periodType: PeriodType;
  categoryId: string | null;
  amountBaseMinor: number;
  effectiveFrom: string;
  createdAt: string;
}

export interface FxRateCache {
  currency: ForeignCurrencyCode;
  rateToBaseScaled: number;
  rateDate: string;
  fetchedAt: string;
  source: 'frankfurter' | 'manual';
}

export interface AppSettings {
  id: 'app';
  defaultCurrency: CurrencyCode;
  defaultPeriod: PeriodType;
  schemaVersion: 2;
}

export interface AppBackup {
  app: 'yuanledger';
  schemaVersion: 2;
  exportedAt: string;
  expenses: Expense[];
  categories: Category[];
  budgets: BudgetVersion[];
  fxRates: FxRateCache[];
  settings: AppSettings[];
}

export interface CategoryTotal {
  categoryId: string;
  totalBaseMinor: number;
  count: number;
}

export interface CurrencyTotal {
  currency: CurrencyCode;
  originalMinor: number;
  baseMinor: number;
  count: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  totalBaseMinor: number;
}

export interface BudgetProgress {
  budget: BudgetVersion | null;
  spentBaseMinor: number;
  remainingBaseMinor: number | null;
  usage: number | null;
  status: BudgetStatus | 'unset';
}

export interface Insight {
  tone: 'positive' | 'neutral' | 'warning' | 'danger';
  title: string;
  body: string;
}

export interface PeriodAnalytics {
  periodType: PeriodType;
  start: string;
  end: string;
  label: string;
  totalBaseMinor: number;
  previousTotalBaseMinor: number;
  expenses: Expense[];
  categoryTotals: CategoryTotal[];
  currencyTotals: CurrencyTotal[];
  trend: TrendPoint[];
  budget: BudgetProgress;
  insights: Insight[];
}
