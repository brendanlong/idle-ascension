import { describe, expect, it } from 'vitest';
import { BUFFS_BY_ID } from '../../content/buffs';
import { ENCOUNTERS, type EncounterOutcome } from '../../content/encounters';
import { GENERATORS, GENERATORS_BY_ID } from '../../content/generators';
import { PERKS, PERKS_BY_ID } from '../../content/perks';
import { REALMS, REALMS_BY_ID, STAGES } from '../../content/realms';
import { TREASURES } from '../../content/treasures';
import { UPGRADES } from '../../content/upgrades';
import type { Effect } from '../effects';

function expectUniqueIds(items: readonly { id: string }[]) {
  const ids = items.map((i) => i.id);
  expect(new Set(ids).size).toBe(ids.length);
}

function expectValidEffects(effects: readonly Effect[]) {
  for (const e of effects) {
    if (e.type === 'generatorMult') expect(GENERATORS_BY_ID.has(e.generator)).toBe(true);
  }
}

describe('content integrity', () => {
  it('has unique ids', () => {
    for (const list of [GENERATORS, UPGRADES, REALMS, TREASURES, PERKS, ENCOUNTERS]) {
      expectUniqueIds(list);
    }
  });

  it('references only real generators, realms, perks and buffs', () => {
    for (const u of UPGRADES) expectValidEffects(u.effects);
    for (const t of TREASURES) {
      expectValidEffects(t.effects);
      expect(REALMS_BY_ID.has(t.minRealm)).toBe(true);
    }
    for (const p of PERKS) for (const r of p.requires ?? []) expect(PERKS_BY_ID.has(r)).toBe(true);

    const checkOutcome = (o: EncounterOutcome): void => {
      if (o.type === 'buff') expect(BUFFS_BY_ID.has(o.buff)).toBe(true);
      if (o.type === 'treasure') checkOutcome(o.fallback);
    };
    for (const e of ENCOUNTERS) {
      checkOutcome(e.outcome);
      if (e.minRealm) expect(REALMS_BY_ID.has(e.minRealm)).toBe(true);
    }
  });

  it('has strictly increasing breakthrough costs', () => {
    for (let i = 2; i < STAGES.length; i++) {
      expect(STAGES[i].cost).toBeGreaterThan(STAGES[i - 1].cost);
    }
  });
});
