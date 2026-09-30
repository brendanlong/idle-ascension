import { describe, expect, it } from 'vitest';
import { CORE_GRADES } from '../../content/cores';
import { MAX_TREASURE_LEVEL } from '../../content/treasures';
import { STAGES } from '../../content/realms';
import { deserialize, exportSave, importSave, serialize } from '../save';
import { SAVE_VERSION } from '../state';
import { newGame } from './helpers';

describe('save/load', () => {
  it('round-trips state', () => {
    const state = newGame({ qi: 123, stage: 4 });
    state.stats.bestStage = 4;
    state.cores.push({ element: 'fire', grade: 2 });
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it('fills in fields missing from older saves', () => {
    const state = newGame({ qi: 42 });
    const raw = JSON.parse(serialize(state));
    delete raw.generators.dao;
    delete raw.flags.victorySeen;
    delete raw.settings;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.qi).toBe(42);
    expect(loaded.generators.dao).toBe(0);
    expect(loaded.flags.victorySeen).toBe(false);
    expect(loaded.settings.numberFormat).toBe('short');
  });

  it('treats null and non-finite values as missing', () => {
    const raw = JSON.parse(serialize(newGame()));
    raw.prestige = null;
    raw.qi = null; // how JSON encodes Infinity/NaN
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.prestige.memories).toBe(0);
    expect(loaded.qi).toBe(0);
  });

  it('drops or clamps references to unknown content', () => {
    const raw = JSON.parse(serialize(newGame()));
    Object.assign(raw, {
      stage: 999,
      upgrades: { 'palm-1': true, removed: true },
      treasures: { ring: 99, pill: 0, gone: 2 },
      cores: [
        { element: 'fire', grade: 99 },
        { element: 'fire', grade: 1 },
        { element: 'lightning', grade: 0 },
      ],
      buffs: [
        { id: 'epiphany', remaining: 10 },
        { id: 'unknown', remaining: 10 },
      ],
      tribulation: { targetStage: 'x' },
    });
    raw.generators.removedGenerator = 5;
    raw.prestige.perks = { meridians: 99, removed: 1 };
    raw.encounter.active = { id: 'nope', x: 0.5, y: 0.5, remaining: 5 };
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.stage).toBe(STAGES.length - 1);
    expect(loaded.upgrades).toEqual({ 'palm-1': true });
    expect(loaded.treasures).toEqual({ ring: MAX_TREASURE_LEVEL });
    expect(loaded.cores).toEqual([{ element: 'fire', grade: CORE_GRADES.length - 1 }]);
    expect(loaded.buffs.map((b) => b.id)).toEqual(['epiphany']);
    expect(loaded.tribulation).toBeNull();
    expect(loaded.generators).not.toHaveProperty('removedGenerator');
    expect(loaded.prestige.perks).toEqual({ meridians: 5 });
    expect(loaded.encounter.active).toBeNull();
  });

  it('migrates v1 owned-treasure flags to levels', () => {
    const raw = JSON.parse(serialize(newGame()));
    raw.saveVersion = 1;
    raw.treasures = { ring: true, pendant: true };
    expect(deserialize(JSON.stringify(raw)).treasures).toEqual({ ring: 1, pendant: 1 });
  });

  it('rejects saves from the future', () => {
    const raw = { ...newGame(), saveVersion: SAVE_VERSION + 1 };
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/newer/);
  });

  it('exports and imports as an opaque string', () => {
    const state = newGame({ qi: 7 });
    expect(importSave(exportSave(state))).toEqual(state);
  });
});
