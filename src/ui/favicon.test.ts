import { describe, expect, it } from 'vitest';
import { REALMS, firstStageOfRealm } from '../content/realms';
import { createInitialState } from '../engine/state';
import { faviconForState } from './favicon';

describe('favicon', () => {
  it("uses the current realm's colour", () => {
    const state = createInitialState(0);
    state.stage = firstStageOfRealm('nascentSoul');
    expect(faviconForState(state)).toContain(REALMS.find((r) => r.id === 'nascentSoul')!.color);
  });

  it('adds one dot per core, coloured by element and rimmed by grade', () => {
    const state = createInitialState(0);
    state.stage = firstStageOfRealm('coreFormation');
    const before = faviconForState(state).match(/<circle/g)!.length;
    state.cores = [
      { element: 'fire', grade: 0 },
      { element: 'water', grade: 4 },
    ];
    const svg = faviconForState(state);
    expect(svg.match(/<circle/g)!.length).toBe(before + 2);
    expect(svg).toContain('fill="#e0603a" stroke="#6b5a45"'); // fire, Mud
    expect(svg).toContain('fill="#4f8fd6" stroke="#f0c24b"'); // water, Gold
  });
});
