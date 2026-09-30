/**
 * Fortuitous encounters. Claiming one picks a reward kind from the encounter's
 * weighted table, then builds its log text from a random intro plus a random
 * outcome line for that reward. Text can use {placeholders} from NAME_TABLES
 * (see names.ts). Treasure lines use {treasure}, which includes its article:
 * "the Ring of the Old Master" for a first find, "another Ring of the Old
 * Master" when refining one you own. Don't write "the {treasure}".
 *
 * Across all encounters, one-time qi windfalls should be the most common
 * reward, then timed buffs, then permanent treasures (content.test.ts checks
 * this).
 */

export interface WindfallReward {
  weight: number;
  /** Seconds of qi/s granted, rolled uniformly in this range... */
  qpsSeconds: readonly [number, number];
  /** ...but capped at this fraction of banked qi, so it can't be farmed by saving up. */
  bankFraction: number;
  texts: readonly string[];
}

export interface BuffOption {
  buff: string;
  weight: number;
  texts: readonly string[];
}

export interface EncounterRewards {
  windfall?: WindfallReward;
  buff?: { weight: number; options: readonly BuffOption[] };
  treasure?: { weight: number; texts: readonly string[] };
}

export type RewardKind = keyof EncounterRewards;

export interface EncounterDef {
  id: string;
  name: string;
  icon: string;
  /** How often this encounter appears relative to others. */
  weight: number;
  minRealm?: string;
  intros: readonly string[];
  rewards: EncounterRewards;
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
    intros: [
      'You slip on a mossy ledge and tumble into a hidden cave.',
      'Behind a waterfall near {place}, you find the sealed abode of a forgotten cultivator.',
      'A wounded {beast} flees into a crack in the mountain. You follow.',
      'An old map in a secondhand book leads you to a cave nobody else has noticed.',
    ],
    rewards: {
      windfall: {
        weight: 55,
        qpsSeconds: [600, 1500],
        bankFraction: 0.15,
        texts: [
          'Inside, a skeleton still clutches a pouch of spirit stones. It will not be needing them.',
          'The walls are veined with raw spirit crystal. You absorb every last drop.',
          'A spirit spring bubbles in the dark. You drink until you can drink no more.',
        ],
      },
      buff: {
        weight: 15,
        options: [
          {
            buff: 'epiphany',
            weight: 2,
            texts: [
              'Sword marks cover the walls. As you trace them with your eyes, something clicks.',
              'Carved into the wall: a single character. You stare at it until you understand.',
            ],
          },
          {
            buff: 'qiTide',
            weight: 1,
            texts: ['A gathering array still hums beneath the dust. Qi floods toward you.'],
          },
        ],
      },
      treasure: {
        weight: 30,
        texts: [
          'On a stone altar rests {treasure}. It seems to have been waiting for you.',
          'A skeleton clutches its last will: "To whoever finds this: take {treasure}."',
          'Deeper in, behind a collapsed wall, you find {treasure}.',
        ],
      },
    },
  },
  {
    id: 'youngMaster',
    name: 'Arrogant Young Master',
    icon: '🤨',
    weight: 9,
    intros: [
      '"Do you know who my {relative} is?" demands Young Master {surname} of the {sect}.',
      'Young Master {surname} of the {sect} blocks the road. "Kneel, trash."',
      '"You dare look at me?" Young Master {surname} sneers. His {relative} is a {elderTitle}, apparently.',
      'Young Master {surname} wants your seat at the teahouse. He brought six bodyguards.',
    ],
    rewards: {
      windfall: {
        weight: 80,
        qpsSeconds: [300, 900],
        bankFraction: 0.1,
        texts: [
          'One slap later, he is embedded in a wall. His storage ring is surprisingly full.',
          'Before he can say another word, you strike. The crowd gasps. His storage ring is yours.',
          'His bodyguards flee first. He flees second, leaving his spirit stones third.',
          'You defeat him with one finger. He pays "compensation" to avoid a second.',
        ],
      },
      buff: {
        weight: 12,
        options: [
          {
            buff: 'meridianSurge',
            weight: 1,
            texts: [
              'The fight gets your blood up. Your meridians sing.',
              'Slapping him was so satisfying that your palms are still tingling with power.',
            ],
          },
        ],
      },
      treasure: {
        weight: 8,
        texts: [
          'In his haste to flee he drops {treasure}. Finders keepers.',
          'His {relative} arrives, sees what happened, and hands you {treasure} as an apology.',
        ],
      },
    },
  },
  {
    id: 'herb',
    name: 'Wild Spirit Herb',
    icon: '🌱',
    weight: 8,
    intros: [
      'Following a faint fragrance, you find a spirit herb growing from a crack in the rocks.',
      'A wild {beast} is guarding a spirit herb in a clearing. You wait for it to nap, then pluck the herb.',
      'You find a spirit flower that blooms only once every hundred years. Today is the day.',
    ],
    rewards: {
      windfall: {
        weight: 70,
        qpsSeconds: [300, 900],
        bankFraction: 0.1,
        texts: [
          'You eat the herb raw. Probably not how alchemists would do it, but it works.',
          'A hundred-year spirit herb! You refine it on the spot.',
        ],
      },
      buff: {
        weight: 25,
        options: [
          {
            buff: 'qiTide',
            weight: 1,
            texts: ['The herb releases a cloud of pollen. Qi motes swirl thickly around you.'],
          },
          {
            buff: 'epiphany',
            weight: 1,
            texts: ['As you chew the bitter herb, your mind turns uncannily clear.'],
          },
        ],
      },
      treasure: {
        weight: 5,
        texts: ['Digging up the herb, you find {treasure} beneath its roots.'],
      },
    },
  },
  {
    id: 'epiphany',
    name: 'Falling Leaf',
    icon: '🍂',
    weight: 7,
    intros: [
      'A leaf falls.',
      'Rain dimples the surface of the lake.',
      'You watch an old woman sweep the same courtyard, over and over.',
      'A spider rebuilds its web after the wind tears it.',
    ],
    rewards: {
      windfall: {
        weight: 15,
        qpsSeconds: [200, 600],
        bankFraction: 0.08,
        texts: ['Your qi settles and condenses, a little denser than before.'],
      },
      buff: {
        weight: 80,
        options: [
          {
            buff: 'epiphany',
            weight: 3,
            texts: [
              'You watch for three days and understand something profound.',
              'In that moment, you see the shape of the Dao.',
            ],
          },
          {
            buff: 'qiTide',
            weight: 1,
            texts: ['You finally understand how qi flows. It begins to flow toward you.'],
          },
        ],
      },
      treasure: {
        weight: 5,
        texts: ['When you come out of your trance, you find {treasure} lying in your lap. Odd.'],
      },
    },
  },
  {
    id: 'beggar',
    name: 'Mysterious Old Beggar',
    icon: '🧓',
    weight: 5,
    intros: [
      'You share your last steamed bun with a filthy old beggar.',
      'An old beggar trips you, then cackles.',
      'A drunk old man in rags insists you look like his long-lost disciple.',
    ],
    rewards: {
      windfall: {
        weight: 25,
        qpsSeconds: [400, 1000],
        bankFraction: 0.12,
        texts: [
          'He presses a pouch into your hands. It is heavier than it looks.',
          'He taps your forehead. Blocked meridians burst open, spilling qi.',
        ],
      },
      buff: {
        weight: 30,
        options: [
          {
            buff: 'meridianSurge',
            weight: 2,
            texts: [
              'He slaps you across the back. Every meridian in your body lights up.',
              'He teaches you one palm strike, then vanishes. Your hands are burning.',
            ],
          },
          {
            buff: 'epiphany',
            weight: 1,
            texts: ['He mutters a single line of scripture. It echoes in your head for hours.'],
          },
        ],
      },
      treasure: {
        weight: 45,
        texts: [
          'He presses {treasure} on you. "Worthless junk," he says, winking.',
          'When you look back, he is gone. Where he sat lies {treasure}.',
          '"Took you long enough," he grumbles, and hands you {treasure}.',
        ],
      },
    },
  },
  {
    id: 'tournament',
    name: 'Sect Tournament',
    icon: '🏯',
    weight: 5,
    minRealm: 'foundation',
    intros: [
      'The {sect} is holding its grand tournament. Nobody expects much from you.',
      'The {sect} opens its tournament to outsiders. You sign up on a whim.',
    ],
    rewards: {
      windfall: {
        weight: 60,
        qpsSeconds: [600, 1200],
        bankFraction: 0.15,
        texts: [
          'You win every match without drawing your sword. The prize pool is yours.',
          'You make a {elderTitle} stand up from their seat. The prize is generous.',
        ],
      },
      buff: {
        weight: 30,
        options: [
          {
            buff: 'meridianSurge',
            weight: 1,
            texts: ['Fighting a genius of the {sect} pushes you past your limits.'],
          },
          {
            buff: 'epiphany',
            weight: 1,
            texts: ["Watching the final match, you see the flaw in your opponent's technique."],
          },
        ],
      },
      treasure: {
        weight: 10,
        texts: ['First prize: {treasure}. The runner-up weeps openly.'],
      },
    },
  },
  {
    id: 'auction',
    name: 'Auction House',
    icon: '🏮',
    weight: 3,
    minRealm: 'foundation',
    intros: [
      'The grand auction in the capital is underway.',
      'A shady underground auction is selling "items of uncertain provenance."',
    ],
    rewards: {
      windfall: {
        weight: 40,
        qpsSeconds: [900, 1800],
        bankFraction: 0.2,
        texts: [
          'Young Master {surname} outbids everyone out of spite, for junk you consigned. You laugh all the way home.',
          'You sell a pill you refined last week. Three sects start a bidding war.',
        ],
      },
      buff: {
        weight: 10,
        options: [
          {
            buff: 'heavensFavor',
            weight: 1,
            texts: ['You buy a lucky charm for one spirit stone. It turns out to actually work.'],
          },
        ],
      },
      treasure: {
        weight: 50,
        texts: [
          'Everyone ignores a dusty lot. You bid one spirit stone. It turns out to be {treasure}.',
          'In a past life, you saw {treasure} sell for a fortune. The auctioneer has no idea.',
        ],
      },
    },
  },
  {
    id: 'omen',
    name: 'Auspicious Omen',
    icon: '🌈',
    weight: 2,
    minRealm: 'coreFormation',
    intros: [
      'Purple clouds gather over your cave.',
      'A rainbow arcs over {place} and ends exactly where you are sitting.',
      'Cranes circle your home nine times, then fly west.',
    ],
    rewards: {
      windfall: {
        weight: 15,
        qpsSeconds: [900, 1800],
        bankFraction: 0.2,
        texts: ['Heavenly qi pours down like rain.'],
      },
      buff: {
        weight: 80,
        options: [
          {
            buff: 'heavensFavor',
            weight: 3,
            texts: [
              'Heaven itself seems to smile on you.',
              'The world feels briefly, perfectly aligned.',
            ],
          },
          {
            buff: 'epiphany',
            weight: 1,
            texts: ['In the omen, you glimpse the workings of heaven.'],
          },
        ],
      },
      treasure: {
        weight: 5,
        texts: ['Where the omen fades, {treasure} rises from the earth.'],
      },
    },
  },
];

export const ENCOUNTERS_BY_ID: ReadonlyMap<string, EncounterDef> = new Map(
  ENCOUNTERS.map((e) => [e.id, e]),
);
