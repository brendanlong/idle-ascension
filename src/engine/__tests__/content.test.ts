import { describe, expect, it } from 'vitest';
import { BUFFS_BY_ID } from '../../content/buffs';
import { ENCOUNTERS } from '../../content/encounters';
import { NAME_TABLES } from '../../content/names';
import { GENERATORS, GENERATORS_BY_ID } from '../../content/generators';
import { PERKS, PERKS_BY_ID } from '../../content/perks';
import { REALMS, REALMS_BY_ID, STAGES } from '../../content/realms';
import { TREASURES } from '../../content/treasures';
import { UPGRADES } from '../../content/upgrades';
import type { Effect } from '../effects';
import { placeholders } from '../text';

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

    for (const e of ENCOUNTERS) {
      for (const o of e.rewards.buff?.options ?? []) expect(BUFFS_BY_ID.has(o.buff)).toBe(true);
      if (e.minRealm) expect(REALMS_BY_ID.has(e.minRealm)).toBe(true);
    }
  });

  it('gives every encounter a fallback for when all treasures are found', () => {
    for (const e of ENCOUNTERS) expect(e.rewards.windfall ?? e.rewards.buff).toBeDefined();
  });

  it('only uses encounter placeholders that exist', () => {
    const check = (texts: readonly string[], extra: string[] = []) => {
      for (const t of texts) {
        for (const key of placeholders(t)) {
          expect(key in NAME_TABLES || extra.includes(key), `{${key}} in "${t}"`).toBe(true);
        }
      }
    };
    for (const e of ENCOUNTERS) {
      check(e.intros);
      check(e.rewards.windfall?.texts ?? []);
      for (const o of e.rewards.buff?.options ?? []) check(o.texts);
      check(e.rewards.treasure?.texts ?? [], ['treasure']);
    }
  });

  it('makes windfalls the most common encounter reward, then buffs, then treasures', () => {
    // Expected share of each reward kind across all encounters, as in the late game.
    const share = { windfall: 0, buff: 0, treasure: 0 };
    for (const e of ENCOUNTERS) {
      const kinds = (['windfall', 'buff', 'treasure'] as const).filter((k) => e.rewards[k]);
      const total = kinds.reduce((sum, k) => sum + e.rewards[k]!.weight, 0);
      for (const k of kinds) share[k] += (e.weight * e.rewards[k]!.weight) / total;
    }
    expect(share.windfall).toBeGreaterThan(share.buff);
    expect(share.buff).toBeGreaterThan(share.treasure);
  });

  it('has strictly increasing breakthrough costs', () => {
    for (let i = 2; i < STAGES.length; i++) {
      expect(STAGES[i].cost).toBeGreaterThan(STAGES[i - 1].cost);
    }
  });
});
