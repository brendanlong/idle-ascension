import { describe, expect, it } from 'vitest';
import {
  CarveFormation,
  ChaseSpirit,
  FlameSeals,
  FlowingCurrent,
  RainOfBlades,
  type Point,
  type TrialGame,
} from './games';

const W = 700;
const H = 460;
const DT = 1 / 60;

function seeded(seed = 7): () => number {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Runs a game to completion, asking `play` where the pointer is each frame. */
function run(game: TrialGame, play: (t: number) => Point | null, onFrame?: () => void): number {
  for (let i = 0; i < 60 * 60 && !game.finished(); i++) {
    game.step(DT, play(game.elapsed));
    onFrame?.();
  }
  expect(game.finished()).toBe(true);
  return game.score();
}

describe('trial games', () => {
  it('Flame Seals: clicking every seal is perfect, ignoring them scores zero', () => {
    const good = new FlameSeals(W, H, seeded());
    expect(
      run(
        good,
        () => null,
        () => good.seal && good.click(good.seal),
      ),
    ).toBe(1);
    expect(run(new FlameSeals(W, H, seeded()), () => null)).toBe(0);
  });

  it('Flowing Current: sweeping through the stream catches enough for a perfect score', () => {
    const game = new FlowingCurrent(W, H, seeded());
    // Hover just ahead of the oldest orb still in the field.
    const score = run(game, () => {
      const next = game.orbs.find((o) => o.x > 0);
      return next ? { x: next.x + 10, y: next.y } : null;
    });
    expect(score).toBe(1);
    expect(run(new FlowingCurrent(W, H, seeded()), () => null)).toBe(0);
  });

  it('Chase the Spirit: following it is perfect, staying still is poor', () => {
    const game = new ChaseSpirit(W, H, seeded());
    expect(run(game, () => game.spirit)).toBe(1);
    expect(run(new ChaseSpirit(W, H, seeded()), () => ({ x: 0, y: 0 }))).toBeLessThan(0.2);
  });

  it('Carve the Formation: touching each point in order is perfect', () => {
    const game = new CarveFormation(W, H, seeded());
    expect(run(game, () => game.current)).toBe(1);
    expect(run(new CarveFormation(W, H, seeded()), () => null)).toBe(0);
  });

  it('Rain of Blades: drifting around the field dodges most blades; leaving the field fails', () => {
    const game = new RainOfBlades(W, H, seeded());
    const circling = run(game, (t) => ({
      x: W / 2 + Math.cos(t * 1.2) * 150,
      y: H / 2 + Math.sin(t * 1.2) * 150,
    }));
    expect(circling).toBeGreaterThanOrEqual(0.6);
    expect(run(new RainOfBlades(W, H, seeded()), () => ({ x: W / 2, y: H / 2 }))).toBeLessThan(0.5);
    expect(run(new RainOfBlades(W, H, seeded()), () => null)).toBe(0);
  });
});
