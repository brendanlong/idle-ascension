import { describe, expect, it } from 'vitest';
import { shouldLoadAnalytics } from './analytics';

describe('analytics', () => {
  it('only counts visits on the production site', () => {
    expect(shouldLoadAnalytics('idle-ascension.brendanlong.com')).toBe(true);
    for (const host of [
      'localhost',
      '127.0.0.1',
      'brendanlong.github.io',
      'clawed.tail8de88a.ts.net',
    ]) {
      expect(shouldLoadAnalytics(host)).toBe(false);
    }
  });
});
