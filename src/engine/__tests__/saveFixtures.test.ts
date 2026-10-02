import { describe, expect, it } from 'vitest';
import { REMOVED_UPGRADES, deserialize } from '../save';
import { SAVE_VERSION } from '../state';

/**
 * Real saves from each released SAVE_VERSION. If one of these stops loading
 * with its progress intact, a change broke old saves: add a migration in
 * save.ts rather than editing the fixture. Techniques removed from the game
 * (REMOVED_UPGRADES) are the only progress a save may lose.
 */
const fixtureFiles = import.meta.glob<string>('./fixtures/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const fixtures = Object.keys(fixtureFiles).map((path) => path.replace('./fixtures/', ''));

describe('save fixtures', () => {
  it('has a fixture for the current save version', () => {
    expect(fixtures).toContain(`save-v${SAVE_VERSION}.json`);
  });

  for (const file of fixtures) {
    it(`loads ${file} without losing progress`, () => {
      const json = fixtureFiles[`./fixtures/${file}`];
      const original = JSON.parse(json);
      const loaded = deserialize(json);
      const count = (o: object) => Object.keys(o).length;

      expect(loaded.qi).toBe(original.qi);
      expect(loaded.qiEarnedTotal).toBe(original.qiEarnedTotal);
      expect(loaded.stage).toBe(original.stage);
      expect(loaded.stats.bestStage).toBe(original.stats.bestStage);
      expect(loaded.prestige.memories).toBe(original.prestige.memories);
      expect(loaded.prestige.loops).toBe(original.prestige.loops);
      expect(count(loaded.prestige.perks)).toBe(count(original.prestige.perks));
      const kept = Object.keys(original.upgrades).filter((id) => !REMOVED_UPGRADES.includes(id));
      expect(count(loaded.upgrades)).toBe(kept.length);
      expect(count(loaded.treasures)).toBe(count(original.treasures));
      expect(loaded.cores).toHaveLength(original.cores.length);
      const owned = (g: Record<string, number>) => Object.values(g).reduce((a, b) => a + b, 0);
      expect(owned(loaded.generators)).toBe(owned(original.generators));
      expect(loaded.settings.numberFormat).toBe(original.settings.numberFormat);
    });
  }
});
