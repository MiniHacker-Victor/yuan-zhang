import { describe, expect, it } from 'vitest';
import {
  convertToBaseMinor,
  convertFromBaseMinor,
  formatOriginalAmount,
  parseAmountToMinor,
  parseRateToScaled,
  RATE_SCALE
} from './money';

describe('money helpers', () => {
  it('parses currencies with two decimal places', () => {
    expect(parseAmountToMinor('123.45', 'GBP')).toBe(12345);
    expect(parseAmountToMinor('1,234.5', 'USD')).toBe(123450);
  });

  it('parses zero-decimal currencies without inventing subunits', () => {
    expect(parseAmountToMinor('1200', 'JPY')).toBe(1200);
    expect(parseAmountToMinor('100.9', 'JPY')).toBe(100);
  });

  it('rejects zero, malformed and unsafe values', () => {
    expect(parseAmountToMinor('0', 'CNY')).toBeNull();
    expect(parseAmountToMinor('-10', 'CNY')).toBeNull();
    expect(parseAmountToMinor('1.2.3', 'USD')).toBeNull();
    expect(parseAmountToMinor('999999999999999999', 'CNY')).toBeNull();
  });

  it('converts foreign amounts with the supplied historical rate', () => {
    expect(convertToBaseMinor(10000, 'CNY', Math.round(0.1 * RATE_SCALE))).toBe(1000);
    expect(convertToBaseMinor(1000, 'JPY', Math.round(0.005 * RATE_SCALE))).toBe(500);
    expect(convertToBaseMinor(12345, 'GBP', RATE_SCALE)).toBe(12345);
  });

  it('converts the GBP base total into each supported display currency', () => {
    expect(convertFromBaseMinor(1000, 'CNY', Math.round(0.1 * RATE_SCALE))).toBe(10000);
    expect(convertFromBaseMinor(1000, 'USD', Math.round(0.8 * RATE_SCALE))).toBe(1250);
    expect(convertFromBaseMinor(1000, 'GBP', RATE_SCALE)).toBe(1000);
  });

  it('validates and scales exchange rates', () => {
    expect(parseRateToScaled('9.2345')).toBe(923_450_000);
    expect(parseRateToScaled('0')).toBeNull();
    expect(parseRateToScaled('abc')).toBeNull();
  });

  it('formats JPY without decimal places', () => {
    expect(formatOriginalAmount(1200, 'JPY')).toContain('1,200');
    expect(formatOriginalAmount(1200, 'JPY')).not.toContain('.00');
  });
});
