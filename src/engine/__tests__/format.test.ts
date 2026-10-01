import { describe, expect, it } from 'vitest';
import { formatNumber } from '../format';

describe('formatNumber', () => {
  it('formats small and large numbers', () => {
    expect(formatNumber(5.25)).toBe('5.3');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(4.98)).toBe('5.0');
    expect(formatNumber(9.96)).toBe('10');
    expect(formatNumber(1_500_000)).toBe('1.50M');
    expect(formatNumber(12_345)).toBe('12.3K');
    expect(formatNumber(123_456)).toBe('123K');
    expect(formatNumber(999_999)).toBe('1.00M');
    expect(formatNumber(3e27)).toBe('3.00Oc');
    expect(formatNumber(3e28)).toBe('30.0Oc');
    expect(formatNumber(3e29)).toBe('300Oc');
    expect(formatNumber(1e50)).toBe('1.00e50');
    expect(formatNumber(1_500_000, 'scientific')).toBe('1.50e6');
  });

  it('supports Chinese myriad units', () => {
    expect(formatNumber(9_999, 'myriad')).toBe('9999');
    expect(formatNumber(15_000, 'myriad')).toBe('1.50万');
    expect(formatNumber(1_500_000, 'myriad')).toBe('150万');
    expect(formatNumber(12_345_678, 'myriad')).toBe('1230万');
    expect(formatNumber(2.3e9, 'myriad')).toBe('23.0亿');
    expect(formatNumber(99_960_000, 'myriad')).toBe('1.00亿');
  });
});
