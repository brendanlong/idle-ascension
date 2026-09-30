import { describe, expect, it } from 'vitest';
import { deserialize, exportSave, importSave, serialize } from '../save';
import { SAVE_VERSION } from '../state';
import { newGame } from './helpers';

describe('save/load', () => {
  it('round-trips state', () => {
    const state = newGame({ qi: 123, stage: 4 });
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

  it('rejects saves from the future', () => {
    const raw = { ...newGame(), saveVersion: SAVE_VERSION + 1 };
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/newer/);
  });

  it('exports and imports as an opaque string', () => {
    const state = newGame({ qi: 7 });
    expect(importSave(exportSave(state))).toEqual(state);
  });
});
