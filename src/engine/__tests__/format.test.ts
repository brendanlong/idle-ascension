import { describe, expect, it } from 'vitest';
import { formatNumber } from '../format';

describe('formatNumber', () => {
  it('formats small and large numbers', () => {
    expect(formatNumber(5.25)).toBe('5.3');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1_500_000)).toBe('1.5M');
    expect(formatNumber(1e50)).toBe('1.00e50');
    expect(formatNumber(1_500_000, 'scientific')).toBe('1.50e6');
  });

  it('supports Chinese myriad units', () => {
    expect(formatNumber(1_500_000, 'myriad')).toBe('150万');
    expect(formatNumber(2.3e9, 'myriad')).toBe('23亿');
  });
});
