/**
 * How Memories reset the climb (see "The sawtooth" in docs/balance-spec.md):
 * each stage deeper you regress from yields `growthPerStage` times as many,
 * matching how much longer each stage takes past your reach, so regressing
 * knocks stage times back down to the floor and the climb starts again.
 */
export const MEMORIES = {
  /** From regressing at the first stage where it's allowed (Core Formation). */
  first: 10,
  growthPerStage: 1.25,
  /** How much each Memory adds to qi gain, before memoryPower. */
  weight: 1.67,
};
