import type { ElementId } from './cores';

/** Short mouse mini-games, one per element. The games themselves live in src/ui/trials/. */
export interface TrialDef {
  element: ElementId;
  name: string;
  icon: string;
  instructions: string;
  /** Buff granted for a score of at least BUFF_SCORE. */
  buff: string;
}

export const TRIALS: readonly TrialDef[] = [
  {
    element: 'fire',
    name: 'Flame Seals',
    icon: '🔥',
    instructions: 'Click each seal before it burns out.',
    buff: 'meridianSurge',
  },
  {
    element: 'water',
    name: 'Flowing Current',
    icon: '💧',
    instructions: 'Sweep your cursor through the flowing qi.',
    buff: 'qiTide',
  },
  {
    element: 'wood',
    name: 'Chase the Spirit',
    icon: '🌿',
    instructions: 'Keep your cursor close to the wandering spirit.',
    buff: 'epiphany',
  },
  {
    element: 'earth',
    name: 'Carve the Formation',
    icon: '⛰️',
    instructions: 'Trace the formation: touch each glowing point in order.',
    buff: 'heavensFavor',
  },
  {
    element: 'metal',
    name: 'Rain of Blades',
    icon: '⚔️',
    instructions: 'Dodge the flying blades. Stay inside the field!',
    buff: 'swordIntent',
  },
];

export const TRIALS_BY_ELEMENT: ReadonlyMap<ElementId, TrialDef> = new Map(
  TRIALS.map((t) => [t.element, t]),
);

export const TRIAL_MIN_REALM = 'foundation';
export const TRIAL_OFFER_LIFETIME = 20;
export const TRIAL_INTERVAL_MIN = 180;
export const TRIAL_INTERVAL_MAX = 360;

/** Rewards: qi/s × (BASE + PER_SCORE × score) seconds, ×AFFINITY with a core of the element. */
export const TRIAL_REWARD_BASE_SECONDS = 120;
export const TRIAL_REWARD_SECONDS_PER_SCORE = 600;
export const TRIAL_AFFINITY_MULT = 1.5;
export const TRIAL_BUFF_SCORE = 0.75;
export const TRIAL_TREASURE_SCORE = 0.95;
export const TRIAL_TREASURE_CHANCE = 0.25;
/** Score given to an optional trial when trial assistance is set to skip them. */
export const TRIAL_SKIP_SCORE = 0.5;
