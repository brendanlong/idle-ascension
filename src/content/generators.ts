export interface GeneratorDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  baseQps: number;
  /** Names of the technique upgrades unlocked at each ownership milestone. */
  upgradeNames: readonly [string, string, string, string, string];
}

export const GENERATOR_COST_GROWTH = 1.15;

export const GENERATORS: readonly GeneratorDef[] = [
  {
    id: 'cushion',
    name: 'Meditation Cushion',
    icon: '🧘',
    description: 'A worn straw cushion. Sit, breathe, and let qi seep in.',
    baseCost: 15,
    baseQps: 0.1,
    upgradeNames: [
      'Lotus Posture',
      'Cold Jade Cushion',
      'Thousand-Year Bodhi Mat',
      'Breath of the Tortoise',
      'Sitting Through Kalpas',
    ],
  },
  {
    id: 'herb',
    name: 'Spirit Herb Patch',
    icon: '🌿',
    description: 'Spirit grass that drinks moonlight and exhales qi.',
    baseCost: 100,
    baseQps: 1,
    upgradeNames: [
      'Spirit Soil',
      'Moonlight Irrigation',
      'Thousand-Year Ginseng',
      'Herb-Nurturing Formation',
      'Garden of the Queen Mother',
    ],
  },
  {
    id: 'array',
    name: 'Qi-Gathering Array',
    icon: '☯️',
    description: 'Carved flags and spirit stones that pull qi from the land.',
    baseCost: 1_100,
    baseQps: 8,
    upgradeNames: [
      'Gathering Sigils',
      'Five-Element Flags',
      'Nine Palaces Layout',
      'Grand Heaven-Earth Array',
      'Array Embracing the Stars',
    ],
  },
  {
    id: 'furnace',
    name: 'Pill Furnace',
    icon: '⚗️',
    description: 'Refines herbs into pills. Occasionally explodes. Mostly worth it.',
    baseCost: 12_000,
    baseQps: 47,
    upgradeNames: [
      'Pill Recipes',
      'Earth Fire Vent',
      'Pill Tribulation',
      'Nine-Revolution Refining',
      'Eight Trigrams Furnace',
    ],
  },
  {
    id: 'disciple',
    name: 'Outer Sect Disciple',
    icon: '👥',
    description: 'Hopeful juniors who tithe qi for your "guidance."',
    baseCost: 130_000,
    baseQps: 260,
    upgradeNames: [
      'Sect Entrance Exam',
      'Contribution Points',
      'Inner Sect Promotion',
      'Grand Sect Tournament',
      'Ten Thousand Disciples Bow',
    ],
  },
  {
    id: 'beast',
    name: 'Tamed Spirit Beast',
    icon: '🦊',
    description: 'A nine-tailed fox kit. It hunts qi and brings it home.',
    baseCost: 1_400_000,
    baseQps: 1_400,
    upgradeNames: [
      'Beast-Taming Collar',
      'Blood Contract',
      'Bloodline Awakening',
      'Beast Tide',
      'Qilin Descendant',
    ],
  },
  {
    id: 'vein',
    name: 'Spirit Vein',
    icon: '⛰️',
    description: 'A river of crystallized qi running beneath a mountain.',
    baseCost: 20_000_000,
    baseQps: 7_800,
    upgradeNames: [
      'Mining Rights',
      'Vein Nourishment',
      'Merging Veins',
      'Dragon Vein',
      'Heart of the Continent',
    ],
  },
  {
    id: 'secretRealm',
    name: 'Secret Realm',
    icon: '🌀',
    description: 'A pocket world sealed since antiquity. Now it is yours.',
    baseCost: 330_000_000,
    baseQps: 44_000,
    upgradeNames: [
      'Realm Key',
      'Map of Hidden Paths',
      'Seal-Breaking Talisman',
      'Folded Space',
      'A Realm of Your Own',
    ],
  },
  {
    id: 'inheritance',
    name: 'Ancient Inheritance',
    icon: '📜',
    description: 'The legacy of a fallen immortal, waiting for a worthy heir.',
    baseCost: 5_100_000_000,
    baseQps: 260_000,
    upgradeNames: [
      'Trial of Worthiness',
      "Old Master's Remnant Soul",
      'Inheritance Crystal',
      'Bloodline Inheritance',
      'Heir of the Ancients',
    ],
  },
  {
    id: 'dao',
    name: 'Fragment of the Heavenly Dao',
    icon: '✨',
    description: 'A shard of the law that governs heaven and earth.',
    baseCost: 75_000_000_000,
    baseQps: 1_600_000,
    upgradeNames: [
      'Glimpse of the Dao',
      'Dao Comprehension',
      'Dao Heart',
      'Dao Domain',
      'One With the Dao',
    ],
  },
];

export const GENERATORS_BY_ID: ReadonlyMap<string, GeneratorDef> = new Map(
  GENERATORS.map((g) => [g.id, g]),
);

export function generatorName(id: string): string {
  return GENERATORS_BY_ID.get(id)?.name ?? id;
}
