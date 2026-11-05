import { db } from '../data/db';
import { RATE_SCALE } from '../lib/money';
import { BASE_CURRENCY, CURRENCIES, type CurrencyCode, type ForeignCurrencyCode, type FxRateCache } from '../types';

const FX_API = 'https://api.frankfurter.dev/v2/rates';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface FxSyncResult {
  updated: ForeignCurrencyCode[];
  failed: ForeignCurrencyCode[];
  skippedManual: ForeignCurrencyCode[];
}

function isForeignCurrency(currency: CurrencyCode): currency is ForeignCurrencyCode {
  return currency !== BASE_CURRENCY;
}

async function fetchRate(currency: ForeignCurrencyCode): Promise<FxRateCache> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  try {
    const url = new URL(FX_API);
    url.searchParams.set('base', currency);
    url.searchParams.set('quotes', BASE_CURRENCY);
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`汇率接口返回 ${response.status}`);
    }

    const payload = await response.json() as Array<{
      date?: string;
      base?: string;
      quote?: string;
      rate?: number;
    }>;
    const item = payload.find((entry) => entry.base === currency && entry.quote === BASE_CURRENCY);

    if (!item?.rate || !item.date || !Number.isFinite(item.rate) || item.rate <= 0) {
      throw new Error('汇率响应格式不正确');
    }

    return {
      currency,
      rateToBaseScaled: Math.round(item.rate * RATE_SCALE),
      rateDate: item.date,
      fetchedAt: new Date().toISOString(),
      source: 'frankfurter'
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function syncRates(force = false): Promise<FxSyncResult> {
  const currencies = (Object.keys(CURRENCIES) as CurrencyCode[]).filter(isForeignCurrency);
  const cached = await db.fxRates.bulkGet(currencies);
  const result: FxSyncResult = { updated: [], failed: [], skippedManual: [] };
  const now = Date.now();

  await Promise.all(currencies.map(async (currency, index) => {
    const existing = cached[index];

    if (existing?.source === 'manual') {
      result.skippedManual.push(currency);
      return;
    }

    if (!force && existing && now - new Date(existing.fetchedAt).getTime() < CACHE_TTL_MS) {
      return;
    }

    try {
      const rate = await fetchRate(currency);
      await db.fxRates.put(rate);
      result.updated.push(currency);
    } catch {
      result.failed.push(currency);
    }
  }));

  return result;
}

export async function getRateToBase(currency: CurrencyCode): Promise<number> {
  if (currency === BASE_CURRENCY) return RATE_SCALE;
  const rate = await db.fxRates.get(currency);
  if (!rate) throw new Error(`${currency} 尚无可用汇率`);
  return rate.rateToBaseScaled;
}

export async function setManualRate(currency: ForeignCurrencyCode, rateToBaseScaled: number): Promise<void> {
  await db.fxRates.put({
    currency,
    rateToBaseScaled,
    rateDate: new Date().toLocaleDateString('en-CA'),
    fetchedAt: new Date().toISOString(),
    source: 'manual'
  });
}

export async function clearManualRate(currency: ForeignCurrencyCode): Promise<void> {
  const existing = await db.fxRates.get(currency);
  if (existing?.source === 'manual') {
    await db.fxRates.delete(currency);
    await syncRates(true);
  }
}

export function getRateAgeLabel(rate: FxRateCache | undefined): string {
  if (!rate) return '尚未获取';
  if (rate.source === 'manual') return '手动汇率';
  return `${rate.rateDate} · 自动`;
}
