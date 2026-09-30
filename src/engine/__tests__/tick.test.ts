import { describe, expect, it } from 'vitest';
import { advanceClock } from '../tick';
import { newGame, seqRng } from './helpers';

describe('time', () => {
  it('produces qi live for short gaps', () => {
    const state = newGame();
    state.generators.herb = 10;
    expect(advanceClock(state, 2_000, seqRng(0.5))).toBeNull();
    expect(state.qi).toBeCloseTo(20);
  });

  it('applies capped, reduced-efficiency offline progress for long gaps', () => {
    const state = newGame();
    state.generators.herb = 10;
    state.buffs.push({ id: 'epiphany', remaining: 50 });
    const report = advanceClock(state, 24 * 3600 * 1000, seqRng(0.5))!;
    expect(report.cappedSeconds).toBe(4 * 3600);
    // 10 qi/s × 4h × 50% efficiency, ignoring the expired Epiphany buff.
    expect(report.qi).toBeCloseTo(10 * 4 * 3600 * 0.5);
    expect(state.buffs).toEqual([]);
  });
});
