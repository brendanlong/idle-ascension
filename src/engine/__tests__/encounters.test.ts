import { describe, expect, it } from 'vitest';
import { MAX_TREASURE_LEVEL, TREASURES } from '../../content/treasures';
import { onLog, type LogEntry } from '../events';
import { claimEncounter, rewardOdds } from '../encounters';
import { ENCOUNTERS_BY_ID } from '../../content/encounters';
import { firstStageOfRealm } from '../../content/realms';
import { computeStats } from '../stats';
import { fillTemplate } from '../text';
import { newGame, seqRng } from './helpers';

function claim(state: ReturnType<typeof newGame>, id: string, rng: () => number): LogEntry[] {
  const logs: LogEntry[] = [];
  const off = onLog((e) => logs.push(e));
  state.encounter.active = { id, x: 0.5, y: 0.5, remaining: 5 };
  claimEncounter(state, computeStats(state), rng);
  off();
  return logs;
}

describe('encounters', () => {
  it('reuses one pick per placeholder within a message', () => {
    const vars = {};
    const rng = seqRng(0, 0.5, 0.9);
    const a = fillTemplate('{surname} {sect}', vars, rng);
    const b = fillTemplate('{surname}!', vars, rng);
    expect(b).toBe(`${a.split(' ')[0]}!`);
  });

  it('falls back to other rewards once every treasure is fully refined', () => {
    const state = newGame({ stage: firstStageOfRealm('godhood') });
    for (const t of TREASURES) state.treasures[t.id] = MAX_TREASURE_LEVEL;
    // 0.99 would pick treasure (the heaviest, last entry) if it were still available.
    const logs = claim(state, 'beggar', seqRng(0.99));
    expect(logs.some((l) => l.tone === 'epic')).toBe(false);
    expect(state.buffs.length + state.qi).toBeGreaterThan(0);
    expect(rewardOdds(ENCOUNTERS_BY_ID.get('beggar')!, false).map((o) => o.kind)).not.toContain(
      'treasure',
    );
  });

  it('can grant a treasure, naming it in the story', () => {
    const state = newGame({ stage: firstStageOfRealm('qiCondensation') });
    // Beggar weights are windfall 25 / buff 30 / treasure 45, so rolling 0.99 picks treasure.
    const logs = claim(state, 'beggar', seqRng(0.99));
    const owned = Object.keys(state.treasures);
    expect(owned).toHaveLength(1);
    const name = TREASURES.find((t) => t.id === owned[0])!.name;
    expect(logs[0].text).toContain(name);
    expect(logs[0].text).not.toMatch(/\{\w+\}/);
  });

  it('can grant a timed buff', () => {
    const state = newGame({ stage: firstStageOfRealm('coreFormation') });
    // Omen: windfall 15 / buff 80 / treasure 5, then heavensFavor 3 / epiphany 1.
    claim(state, 'omen', seqRng(0.5));
    expect(state.buffs.map((b) => b.id)).toContain('heavensFavor');
  });

  it('can grant qi', () => {
    const state = newGame();
    claim(state, 'youngMaster', seqRng(0.1));
    expect(state.qi).toBeGreaterThan(0);
    expect(state.stats.encountersClaimed).toBe(1);
  });
});
