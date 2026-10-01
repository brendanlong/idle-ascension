import { describe, expect, it } from 'vitest';
import { BUFFS_BY_ID } from '../../content/buffs';
import { CORE_GRADES } from '../../content/cores';
import { ENCOUNTERS } from '../../content/encounters';
import { REGRESSION_STORY } from '../../content/lore';
import { NAME_TABLES } from '../../content/names';
import { GENERATORS, GENERATORS_BY_ID } from '../../content/generators';
import { PERKS, PERKS_BY_ID } from '../../content/perks';
import { REALMS, REALMS_BY_ID, STAGES } from '../../content/realms';
import { TREASURES } from '../../content/treasures';
import { UPGRADES } from '../../content/upgrades';
import type { Effect } from '../effects';
import { refineStage } from '../cores';
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

function checkTemplates(texts: readonly string[], extra: string[] = []) {
  for (const t of texts) {
    // "a {beast}" breaks for vowel-initial entries ("a iron-backed tortoise").
    for (const [, key] of t.matchAll(/\ba \{(\w+)\}/gi)) {
      const vowelStart = (NAME_TABLES[key] ?? []).filter((w) => /^[aeiou]/i.test(w));
      expect(vowelStart, `"a {${key}}" in "${t}"`).toEqual([]);
    }
    for (const key of placeholders(t)) {
      expect(key in NAME_TABLES || extra.includes(key), `{${key}} in "${t}"`).toBe(true);
    }
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
    for (const g of GENERATORS) if (g.minRealm) expect(REALMS_BY_ID.has(g.minRealm)).toBe(true);
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

  it('gives every encounter text, positive weights, and a non-treasure reward', () => {
    for (const e of ENCOUNTERS) {
      const { windfall, buff, treasure } = e.rewards;
      expect(e.weight, e.id).toBeGreaterThan(0);
      expect(e.intros.length, e.id).toBeGreaterThan(0);
      // Treasures run out (and are gated by realm), so something else must always be possible.
      expect(windfall || buff, e.id).toBeTruthy();
      for (const reward of [windfall, buff, treasure]) {
        if (reward) expect(reward.weight, e.id).toBeGreaterThan(0);
      }
      if (windfall) expect(windfall.texts.length, e.id).toBeGreaterThan(0);
      if (treasure) expect(treasure.texts.length, e.id).toBeGreaterThan(0);
      if (buff) {
        expect(buff.options.length, e.id).toBeGreaterThan(0);
        for (const o of buff.options) {
          expect(o.weight, e.id).toBeGreaterThan(0);
          expect(o.texts.length, e.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it('only uses encounter placeholders that exist', () => {
    for (const e of ENCOUNTERS) {
      checkTemplates(e.intros);
      checkTemplates(e.rewards.windfall?.texts ?? []);
      for (const o of e.rewards.buff?.options ?? []) checkTemplates(o.texts);
      checkTemplates(e.rewards.treasure?.texts ?? [], ['treasure']);
      // {treasure} supplies its own article ("the X" or "another X").
      for (const t of e.rewards.treasure?.texts ?? []) expect(t).not.toMatch(/\bthe \{treasure\}/i);
    }
  });

  it('only uses valid placeholders in the regression story', () => {
    for (const part of REGRESSION_STORY) checkTemplates(part);
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

  it('has a breakthrough cost for every stage', () => {
    for (const realm of REALMS) expect(realm.stageCosts.length).toBe(realm.stageNames.length);
  });

  it('has strictly increasing breakthrough costs', () => {
    for (let i = 2; i < STAGES.length; i++) {
      expect(STAGES[i].cost).toBeGreaterThan(STAGES[i - 1].cost);
    }
  });

  it('makes each core grade cost more than the last', () => {
    for (let core = 0; core < 5; core++)
      for (let i = 2; i < CORE_GRADES.length; i++)
        expect(refineStage(core, i)).toBeGreaterThanOrEqual(refineStage(core, i - 1));
  });
});
