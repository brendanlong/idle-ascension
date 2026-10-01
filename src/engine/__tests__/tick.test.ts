import { GENERATORS_BY_ID } from '../../content/generators';
import { describe, expect, it } from 'vitest';
import { STAGES, firstStageOfRealm } from '../../content/realms';
import { attemptBreakthrough } from '../breakthrough';
import { computeStats } from '../stats';
import { advanceClock } from '../tick';
import { newGame, seqRng } from './helpers';

const herbQps = () => GENERATORS_BY_ID.get('herb')!.baseQps;

describe('time', () => {
  it('produces qi live for short gaps', () => {
    const state = newGame();
    state.generators.herb = 10;
    expect(advanceClock(state, 2_000, seqRng(0.5))).toBeNull();
    expect(state.qi).toBeCloseTo(2 * 10 * herbQps());
  });

  it('applies capped, reduced-efficiency offline progress for long gaps', () => {
    const state = newGame();
    state.generators.herb = 10;
    state.buffs.push({ id: 'epiphany', remaining: 50 });
    const report = advanceClock(state, 24 * 3600 * 1000, seqRng(0.5))!;
    expect(report.cappedSeconds).toBe(4 * 3600);
    // 10 herbs × 4h × 50% efficiency, ignoring the expired Epiphany buff.
    expect(report.qi).toBeCloseTo(10 * herbQps() * 4 * 3600 * 0.5);
    expect(state.buffs).toEqual([]);
  });

  function midTribulation() {
    const target = firstStageOfRealm('coreFormation');
    const state = newGame({ qi: STAGES[target].cost, stage: target - 1 });
    attemptBreakthrough(state, computeStats(state).mods);
    return { state, target };
  }

  it('keeps a paused tribulation through seclusion, still granting offline qi', () => {
    const { state, target } = midTribulation();
    state.generators.herb = 10;
    const report = advanceClock(state, 3600_000, seqRng(0.5), { pauseTribulation: true })!;
    expect(report.qi).toBeGreaterThan(0);
    expect(state.tribulation?.targetStage).toBe(target);
    expect(state.tribulation?.scores).toEqual([]);
  });

  it('fails a tribulation abandoned by going offline', () => {
    const { state, target } = midTribulation();
    advanceClock(state, 3600_000, seqRng(0.5));
    expect(state.tribulation).toBeNull();
    expect(state.stage).toBe(target - 1);
    expect(state.stats.tribulationsFailed).toBe(1);
  });
});
