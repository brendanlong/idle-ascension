export type EncounterOutcome =
  /** Gain min(bank × bankFraction, qi/s × qpsSeconds) qi. */
  | { type: 'windfall'; bankFraction: number; qpsSeconds: number }
  | { type: 'buff'; buff: string }
  /** Grant a random unfound treasure, or fall back if none are available. */
  | { type: 'treasure'; fallback: EncounterOutcome };

export interface EncounterDef {
  id: string;
  name: string;
  icon: string;
  weight: number;
  minRealm?: string;
  /** One is chosen at random and shown in the log. */
  flavor: readonly string[];
  outcome: EncounterOutcome;
}

export const ENCOUNTER_LIFETIME = 13;
export const ENCOUNTER_INTERVAL_MIN = 60;
export const ENCOUNTER_INTERVAL_MAX = 150;

export const ENCOUNTERS: readonly EncounterDef[] = [
  {
    id: 'cave',
    name: 'Hidden Cave Dwelling',
    icon: '🕳️',
    weight: 10,
    flavor: [
      'You fall off a cliff and land in a hidden cave. Inside: a skeleton, and its spirit stones.',
      'Behind a waterfall you find the abandoned abode of some forgotten cultivator.',
    ],
    outcome: { type: 'windfall', bankFraction: 0.15, qpsSeconds: 900 },
  },
  {
    id: 'youngMaster',
    name: 'Arrogant Young Master',
    icon: '🤨',
    weight: 8,
    flavor: [
      '"Do you know who my father is?" You slap him. The crowd gasps. His storage ring is yours.',
      '"You dare look at me, trash?" One palm later, he is embedded in a wall. You take his ring.',
      '"My grandfather is an Elder of the—" You don\'t let him finish. His ring is surprisingly full.',
    ],
    outcome: { type: 'windfall', bankFraction: 0.1, qpsSeconds: 600 },
  },
  {
    id: 'epiphany',
    name: 'Falling Leaf',
    icon: '🍂',
    weight: 7,
    flavor: [
      'A leaf falls. You watch it for three days and understand something profound.',
      'The rain on the lake shows you the shape of the Dao.',
    ],
    outcome: { type: 'buff', buff: 'epiphany' },
  },
  {
    id: 'beggar',
    name: 'Mysterious Old Beggar',
    icon: '🧓',
    weight: 5,
    flavor: [
      'You share your last bun with a filthy old beggar. He laughs and presses something into your hands.',
      'An old beggar trips you, then insists you take this "worthless junk" as an apology.',
    ],
    outcome: { type: 'treasure', fallback: { type: 'buff', buff: 'meridianSurge' } },
  },
  {
    id: 'auction',
    name: 'Auction House',
    icon: '🏮',
    weight: 3,
    minRealm: 'foundation',
    flavor: ['Everyone ignores the rusty lot. You bid one spirit stone. The auctioneer weeps.'],
    outcome: {
      type: 'treasure',
      fallback: { type: 'windfall', bankFraction: 0.2, qpsSeconds: 1200 },
    },
  },
  {
    id: 'omen',
    name: 'Auspicious Omen',
    icon: '🌈',
    weight: 2,
    minRealm: 'coreFormation',
    flavor: ['Purple clouds gather over your cave. Heaven itself seems to smile on you.'],
    outcome: { type: 'buff', buff: 'heavensFavor' },
  },
];

export const ENCOUNTERS_BY_ID: ReadonlyMap<string, EncounterDef> = new Map(
  ENCOUNTERS.map((e) => [e.id, e]),
);
