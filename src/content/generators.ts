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
  upgradeNames: readonly [string, string];
  /** Prices of those techniques, if not the default multiples of baseCost. */
  upgradeCosts?: readonly [number, number];
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
    upgradeNames: ['Lotus Posture', 'Sitting Through Kalpas'],
    upgradeCosts: [1e9, 1.1e13],
  },
  {
    id: 'herb',
    name: 'Spirit Herb Patch',
    icon: '🌿',
    description: 'Spirit grass that drinks moonlight and exhales qi.',
    baseCost: 100,
    baseQps: 1,
    upgradeNames: ['Spirit Soil', 'Garden of the Queen Mother'],
    upgradeCosts: [6.6e16, 2.5e17],
  },
  {
    id: 'array',
    name: 'Qi-Gathering Array',
    icon: '☯️',
    description: 'Carved flags and spirit stones that pull qi from the land.',
    baseCost: 1_100,
    baseQps: 8,
    upgradeNames: ['Gathering Sigils', 'Array Embracing the Stars'],
    upgradeCosts: [3.6e17, 1.1e18],
  },
  {
    id: 'furnace',
    name: 'Pill Furnace',
    icon: '⚗️',
    description: 'Refines herbs into pills. Occasionally explodes. Mostly worth it.',
    baseCost: 12_000,
    baseQps: 47,
    upgradeNames: ['Pill Recipes', 'Eight Trigrams Furnace'],
    upgradeCosts: [1.6e18, 6.9e18],
  },
  {
    id: 'disciple',
    name: 'Outer Sect Disciple',
    icon: '👥',
    description: 'Hopeful juniors who tithe qi for your "guidance."',
    baseCost: 130_000,
    baseQps: 260,
    upgradeNames: ['Sect Entrance Exam', 'Ten Thousand Disciples Bow'],
    upgradeCosts: [2.2e19, 4.9e19],
  },
  {
    id: 'beast',
    name: 'Tamed Spirit Beast',
    icon: '🦊',
    description: 'A nine-tailed fox kit. It hunts qi and brings it home.',
    baseCost: 1_400_000,
    baseQps: 1_400,
    upgradeNames: ['Beast-Taming Collar', 'Qilin Descendant'],
    upgradeCosts: [1.5e20, 1.2e20],
  },
  {
    id: 'vein',
    name: 'Spirit Vein',
    icon: '⛰️',
    description: 'A river of crystallized qi running beneath a mountain.',
    baseCost: 2e7,
    baseQps: 7_800,
    upgradeNames: ['Mining Rights', 'Heart of the Continent'],
    upgradeCosts: [8.5e19, 2.3e21],
  },
  {
    id: 'secretRealm',
    name: 'Secret Realm',
    icon: '🌀',
    description: 'A pocket world sealed since antiquity. Now it is yours.',
    baseCost: 3.3e8,
    baseQps: 44_000,
    upgradeNames: ['Realm Key', 'A Realm of Your Own'],
    upgradeCosts: [3.2e21, 3.5e21],
  },
  {
    id: 'inheritance',
    name: 'Ancient Inheritance',
    icon: '📜',
    description: 'The legacy of a fallen immortal, waiting for a worthy heir.',
    baseCost: 5.1e9,
    baseQps: 260_000,
    upgradeNames: ['Trial of Worthiness', 'Heir of the Ancients'],
    upgradeCosts: [4.4e15, 4.2e22],
  },
  {
    id: 'dao',
    name: 'Fragment of the Heavenly Dao',
    icon: '✨',
    description: 'A shard of the law that governs heaven and earth.',
    baseCost: 7.5e10,
    baseQps: 1_600_000,
    upgradeNames: ['Glimpse of the Dao', 'One With the Dao'],
    upgradeCosts: [1.2e19, 4.4e22],
  },
  {
    id: 'sect',
    name: 'Founded Sect',
    icon: '🏯',
    description: 'A mountain, a gate, and a thousand disciples who call you Patriarch.',
    minRealm: 'spiritSevering',
    baseCost: 5.9e22,
    baseQps: 3.6e9,
    upgradeNames: ['Sect Charter', 'The Sect That Rules the Continent'],
    upgradeCosts: [5.3e19, 3.1e19],
  },
  {
    id: 'dragon',
    name: 'Bound True Dragon',
    icon: '🐉',
    description: 'A true dragon, bound by oath. It exhales qi and inhales mountains.',
    minRealm: 'spiritSevering',
    baseCost: 1.6e23,
    baseQps: 3.4e9,
    upgradeNames: ['Dragon Pearl', 'Ancestor of Dragons'],
    upgradeCosts: [1.3e21, 5.5e20],
  },
  {
    id: 'smallWorld',
    name: 'Inner Small World',
    icon: '🌍',
    description: 'A world inside your body, with its own sun, rivers and spirit veins.',
    minRealm: 'daoSeeking',
    baseCost: 1.2e23,
    baseQps: 3.9e9,
    upgradeNames: ['World Seed', 'A World That Cultivates'],
    upgradeCosts: [1e24, 4e25],
  },
  {
    id: 'starRiver',
    name: 'Star River',
    icon: '🌌',
    description: 'You pluck stars from the sky and drink their light.',
    minRealm: 'daoSeeking',
    baseCost: 4.2e22,
    baseQps: 5.5e9,
    upgradeNames: ['Star Map', 'Master of the Firmament'],
    upgradeCosts: [4e24, 1.6e26],
  },
  {
    id: 'faith',
    name: 'Incense of Ten Thousand Worlds',
    icon: '🛕',
    description: 'Mortals in countless worlds burn incense to you. Their faith becomes qi.',
    minRealm: 'immortalAscension',
    baseCost: 5e26,
    baseQps: 3e10,
    upgradeNames: ['Wayside Shrines', 'Worshipped Across Eternity'],
    upgradeCosts: [2.5e28, 1e30],
  },
  {
    id: 'court',
    name: 'Seat in the Heavenly Court',
    icon: '🏛️',
    description: 'A throne among the immortals, and a share of heaven itself.',
    minRealm: 'immortalAscension',
    baseCost: 3e28,
    baseQps: 3e11,
    upgradeNames: ['Jade Tablet of Office', 'The Jade Emperor Consults You'],
    upgradeCosts: [1.5e30, 6e31],
  },
  {
    id: 'primordial',
    name: 'Shard of Primordial Chaos',
    icon: '🌑',
    description: 'A fragment of the nothing that came before heaven and earth.',
    minRealm: 'immortalAscension',
    baseCost: 2e30,
    baseQps: 8e12,
    upgradeNames: ['Touching the Void', 'Pangu Stirs'],
    upgradeCosts: [1e32, 4e33],
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
