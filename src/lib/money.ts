import { BASE_CURRENCY, CURRENCIES, type CurrencyCode } from '../types';

export const RATE_SCALE = 100_000_000;

export function parseAmountToMinor(value: string, currency: CurrencyCode): number | null {
  const cleaned = value.trim().replaceAll(',', '').replace(/^\+/, '');

  if (!/^\d+(?:\.\d*)?$/.test(cleaned)) {
    return null;
  }

  const [wholePart, fractionPart = ''] = cleaned.split('.');
  const digits = CURRENCIES[currency].digits;
  const fraction = fractionPart.padEnd(digits, '0').slice(0, digits);
  const minor = Number(wholePart) * 10 ** digits + (digits > 0 ? Number(fraction || '0') : 0);

  if (!Number.isSafeInteger(minor) || minor <= 0) {
    return null;
  }

  return minor;
}

export function parseRateToScaled(value: string): number | null {
  const cleaned = value.trim().replaceAll(',', '').replace(/^\+/, '');

  if (!/^\d+(?:\.\d*)?$/.test(cleaned)) {
    return null;
  }

  const rate = Number(cleaned);
  const scaled = Math.round(rate * RATE_SCALE);

  if (!Number.isSafeInteger(scaled) || scaled <= 0) {
    return null;
  }

  return scaled;
}

export function minorToMajor(amountMinor: number, currency: CurrencyCode): number {
  return amountMinor / 10 ** CURRENCIES[currency].digits;
}

export function convertToBaseMinor(
  amountMinor: number,
  currency: CurrencyCode,
  rateToBaseScaled: number
): number {
  if (currency === BASE_CURRENCY) {
    return amountMinor;
  }

  return Math.round(minorToMajor(amountMinor, currency) * rateToBaseScaled / RATE_SCALE * 100);
}

export function convertFromBaseMinor(
  baseAmountMinor: number,
  currency: CurrencyCode,
  rateToBaseScaled: number
): number | null {
  if (currency === BASE_CURRENCY) return baseAmountMinor;
  if (rateToBaseScaled <= 0) return null;

  const baseMajor = baseAmountMinor / 100;
  const targetMajor = baseMajor / (rateToBaseScaled / RATE_SCALE);
  return Math.round(targetMajor * 10 ** CURRENCIES[currency].digits);
}

export function formatOriginalAmount(amountMinor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: CURRENCIES[currency].digits,
    maximumFractionDigits: CURRENCIES[currency].digits
  }).format(minorToMajor(amountMinor, currency));
}

export function formatBaseMinor(amountMinor: number, compact = false): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: BASE_CURRENCY,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2
  }).format(amountMinor / 100);
}

export function formatRate(rateToBaseScaled: number, digits = 4): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits
  }).format(rateToBaseScaled / RATE_SCALE);
}

export function amountInputValue(amountMinor: number, currency: CurrencyCode): string {
  return minorToMajor(amountMinor, currency).toFixed(CURRENCIES[currency].digits);
}

export function rateInputValue(rateToBaseScaled: number): string {
  return String(Number((rateToBaseScaled / RATE_SCALE).toFixed(6)));
}
