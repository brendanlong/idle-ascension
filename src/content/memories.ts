/**
 * How regression pays (see "Regression" in docs/balance-spec.md). Memories
 * grow `growthPerStage` times per stage deeper you regress from, and qi gain
 * grows logarithmically with them: (1 + weight × Memories) ^ memoryPower,
 * so each doubling of your Memories multiplies qi by about 2 ^ memoryPower.
 * Regressing again from the same stage only doubles them (barely worth it),
 * while regressing a few stages deeper is worth growthPerStage ^ memoryPower
 * per stage.
 */
export const MEMORIES = {
  /** From regressing at the first stage where it's allowed (Core Formation). */
  first: 10,
  growthPerStage: 3,
  /** How much each Memory adds to qi gain, before the power. */
  weight: 25,
  /** The base memoryPower: each doubling of your Memories multiplies qi by about 2 ^ power. */
  power: 0.2,
};
