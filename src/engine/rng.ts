export type Rng = () => number;

export const defaultRng: Rng = Math.random;

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function weightedPick<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  if (!(total > 0)) throw new Error('weightedPick needs at least one positive weight');
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}
