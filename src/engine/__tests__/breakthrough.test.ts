import { describe, expect, it } from 'vitest';
import { REALMS, STAGES, firstStageOfRealm } from '../../content/realms';
import {
  attemptBreakthrough,
  breakthroughBlocker,
  currentTribulationTrial,
  recordTribulationTrial,
  tribulationPassScore,
  tribulationSpeed,
} from '../breakthrough';
import { computeStats } from '../stats';
import { newGame, seqRng } from './helpers';

describe('breakthroughs', () => {
  it('advances a minor stage by paying its cost', () => {
    const state = newGame({ qi: 100 });
    expect(attemptBreakthrough(state, computeStats(state).mods)).toBe('advanced');
    expect(state.stage).toBe(1);
    expect(state.qi).toBe(100 - STAGES[1].cost);
  });

  it('requires a pill furnace for Foundation Establishment', () => {
    const state = newGame({ qi: 1e12, stage: firstStageOfRealm('foundation') - 1 });
    expect(breakthroughBlocker(state)).toMatch(/Pill Furnace/);
    state.generators.furnace = 1;
    expect(breakthroughBlocker(state)).toBeNull();
  });

  function startTribulation(realm = 'coreFormation') {
    const target = firstStageOfRealm(realm);
    const state = newGame({ qi: STAGES[target].cost, stage: target - 1 });
    state.generators.furnace = 1;
    const mods = computeStats(state).mods;
    expect(attemptBreakthrough(state, mods, seqRng(0.3, 0.7))).toBe('tribulation');
    expect(state.qi).toBe(0);
    return { state, mods, target };
  }

  it('builds a tribulation of distinct elemental trials with the realm pass mark', () => {
    const { state } = startTribulation('immortalAscension');
    const t = state.tribulation!;
    expect(t.trials).toHaveLength(3);
    expect(new Set(t.trials).size).toBe(3);
    expect(t.passScore).toBe(0.7);
    expect(currentTribulationTrial(state)).toBe(t.trials[0]);
  });

  it('passes when the average trial score meets the pass mark', () => {
    const { state, target } = startTribulation('spiritSevering');
    recordTribulationTrial(state, 0.9);
    expect(state.tribulation?.scores).toEqual([0.9]);
    recordTribulationTrial(state, 0.4); // average 0.65 vs pass mark 0.6
    expect(state.tribulation).toBeNull();
    expect(state.stage).toBe(target);
    expect(state.stats.tribulationsSurvived).toBe(1);
  });

  it('fails, refunds most of the cost and injures you below the pass mark', () => {
    const { state, target } = startTribulation();
    recordTribulationTrial(state, 0.3);
    expect(state.stage).toBe(target - 1);
    expect(state.qi).toBeCloseTo(STAGES[target].cost * 0.7);
    expect(state.buffs.map((b) => b.id)).toContain('injured');
  });

  it('lowers the pass mark with leniency and slows trials, within limits', () => {
    const def = REALMS.find((r) => r.id === 'coreFormation')!.tribulation!;
    const mods = computeStats(newGame()).mods;
    expect(tribulationPassScore(def, mods)).toBe(0.5);
    mods.tribulationLeniency = 0.15;
    expect(tribulationPassScore(def, mods)).toBeCloseTo(0.35);
    mods.tribulationLeniency = 5;
    expect(tribulationPassScore(def, mods)).toBe(0.25);
    mods.tribulationSlowMult = 1.25;
    expect(tribulationSpeed(mods)).toBeCloseTo(0.8);
    mods.tribulationSlowMult = 10;
    expect(tribulationSpeed(mods)).toBe(0.5);
  });
});
