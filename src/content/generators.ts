export interface GeneratorDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  baseQps: number;
  /** Realm (by id) required before it can be bought. */
  minRealm?: string;
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
  {
    id: 'sect',
    name: 'Founded Sect',
    icon: '🏯',
    description: 'A mountain, a gate, and a thousand disciples who call you Patriarch.',
    minRealm: 'spiritSevering',
    baseCost: 2e16,
    baseQps: 1e7,
    upgradeNames: [
      'Sect Charter',
      'Scripture Pavilion',
      'Protective Mountain Array',
      'Branch Sects',
      'The Sect That Rules the Continent',
    ],
  },
  {
    id: 'dragon',
    name: 'Bound True Dragon',
    icon: '🐉',
    description: 'A true dragon, bound by oath. It exhales qi and inhales mountains.',
    minRealm: 'spiritSevering',
    baseCost: 3e17,
    baseQps: 6.5e7,
    upgradeNames: [
      'Dragon Pearl',
      'Dragon Blood Pact',
      'Scales of Heaven',
      'Dragon Transformation',
      'Ancestor of Dragons',
    ],
  },
  {
    id: 'smallWorld',
    name: 'Inner Small World',
    icon: '🌍',
    description: 'A world inside your body, with its own sun, rivers and spirit veins.',
    minRealm: 'daoSeeking',
    baseCost: 2e22,
    baseQps: 1.7e9,
    upgradeNames: [
      'World Seed',
      'Heaven and Earth Separate',
      'Four Seasons Turn',
      'Mortals Are Born',
      'A World That Cultivates',
    ],
  },
  {
    id: 'starRiver',
    name: 'Star River',
    icon: '🌌',
    description: 'You pluck stars from the sky and drink their light.',
    minRealm: 'daoSeeking',
    baseCost: 8e22,
    baseQps: 2.9e9,
    upgradeNames: [
      'Star Map',
      'Constellation Array',
      'Swallowing the Sun',
      'River of Stars Reversed',
      'Master of the Firmament',
    ],
  },
  {
    id: 'faith',
    name: 'Incense of Ten Thousand Worlds',
    icon: '🛕',
    description: 'Mortals in countless worlds burn incense to you. Their faith becomes qi.',
    minRealm: 'immortalAscension',
    baseCost: 5e27,
    baseQps: 1.2e11,
    upgradeNames: [
      'Wayside Shrines',
      'Golden Statues',
      'Pilgrimage Routes',
      'State Religion',
      'Worshipped Across Eternity',
    ],
  },
  {
    id: 'court',
    name: 'Seat in the Heavenly Court',
    icon: '🏛️',
    description: 'A throne among the immortals, and a share of heaven itself.',
    minRealm: 'immortalAscension',
    baseCost: 3e29,
    baseQps: 3e12,
    upgradeNames: [
      'Jade Tablet of Office',
      'Celestial Bureaucracy',
      'Peach Banquet Invitation',
      'Minister of Heaven',
      'The Jade Emperor Consults You',
    ],
  },
  {
    id: 'primordial',
    name: 'Shard of Primordial Chaos',
    icon: '🌑',
    description: 'A fragment of the nothing that came before heaven and earth.',
    minRealm: 'immortalAscension',
    baseCost: 2e31,
    baseQps: 8e13,
    upgradeNames: [
      'Touching the Void',
      'Chaos Qi',
      'Before the First Dawn',
      'Unmaking and Remaking',
      'Pangu Stirs',
    ],
  },
];

export const GENERATORS_BY_ID: ReadonlyMap<string, GeneratorDef> = new Map(
  GENERATORS.map((g) => [g.id, g]),
);

export function generatorName(id: string): string {
  return GENERATORS_BY_ID.get(id)?.name ?? id;
}

/** "10 Meditation Cushions", "1 Pill Furnace", "3 Fragments of the Heavenly Dao". */
export function generatorCount(id: string, count: number): string {
  const name = generatorName(id);
  if (count === 1) return `1 ${name}`;
  const [head, ...rest] = name.split(' of ');
  const plural = /(ch|sh|s|x)$/.test(head) ? `${head}es` : `${head}s`;
  return `${count} ${[plural, ...rest].join(' of ')}`;
}
