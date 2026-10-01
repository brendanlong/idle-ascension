export interface GeneratorDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  baseQps: number;
  /** Realm (by id) required before it can be bought. */
  minRealm?: string;
  /** Name of the technique unlocked once you own a few of this resource. */
  upgradeName: string;
  /**
   * A late technique that makes this resource briefly the best again, unlocked
   * once you own a few of the resource two tiers newer. `mult` is about 1.5 times
   * how far this resource's total trails the best one by then (measured with
   * SIM_REVIVAL=1 in scripts/sim.ts).
   */
  revival?: { name: string; mult: number };
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
    upgradeName: 'Lotus Posture',
    revival: { name: 'Sitting Through Kalpas', mult: 100 },
  },
  {
    id: 'herb',
    name: 'Spirit Herb Patch',
    icon: '🌿',
    description: 'Spirit grass that drinks moonlight and exhales qi.',
    baseCost: 100,
    baseQps: 1,
    upgradeName: 'Spirit Soil',
    revival: { name: 'Garden of the Queen Mother', mult: 40 },
  },
  {
    id: 'array',
    name: 'Qi-Gathering Array',
    icon: '☯️',
    description: 'Carved flags and spirit stones that pull qi from the land.',
    baseCost: 1_100,
    baseQps: 8,
    upgradeName: 'Gathering Sigils',
    revival: { name: 'Array Embracing the Stars', mult: 25 },
  },
  {
    id: 'furnace',
    name: 'Pill Furnace',
    icon: '⚗️',
    description: 'Refines herbs into pills. Occasionally explodes. Mostly worth it.',
    baseCost: 12_000,
    baseQps: 47,
    upgradeName: 'Pill Recipes',
    revival: { name: 'Eight Trigrams Furnace', mult: 25 },
  },
  {
    id: 'disciple',
    name: 'Outer Sect Disciple',
    icon: '👥',
    description: 'Hopeful juniors who tithe qi for your "guidance."',
    baseCost: 130_000,
    baseQps: 260,
    upgradeName: 'Sect Entrance Exam',
    revival: { name: 'Ten Thousand Disciples Bow', mult: 25 },
  },
  {
    id: 'beast',
    name: 'Tamed Spirit Beast',
    icon: '🦊',
    description: 'A nine-tailed fox kit. It hunts qi and brings it home.',
    baseCost: 1_400_000,
    baseQps: 1_400,
    upgradeName: 'Beast-Taming Collar',
    revival: { name: 'Qilin Descendant', mult: 25 },
  },
  {
    id: 'vein',
    name: 'Spirit Vein',
    icon: '⛰️',
    description: 'A river of crystallized qi running beneath a mountain.',
    baseCost: 2e7,
    baseQps: 7_800,
    upgradeName: 'Mining Rights',
    revival: { name: 'Heart of the Continent', mult: 25 },
  },
  {
    id: 'secretRealm',
    name: 'Secret Realm',
    icon: '🌀',
    description: 'A pocket world sealed since antiquity. Now it is yours.',
    baseCost: 3.3e8,
    baseQps: 44_000,
    upgradeName: 'Realm Key',
    revival: { name: 'A Realm of Your Own', mult: 25 },
  },
  {
    id: 'inheritance',
    name: 'Ancient Inheritance',
    icon: '📜',
    description: 'The legacy of a fallen immortal, waiting for a worthy heir.',
    baseCost: 5.1e9,
    baseQps: 260_000,
    upgradeName: 'Trial of Worthiness',
    revival: { name: 'Heir of the Ancients', mult: 25 },
  },
  {
    id: 'dao',
    name: 'Fragment of the Heavenly Dao',
    icon: '✨',
    description: 'A shard of the law that governs heaven and earth.',
    baseCost: 7.5e10,
    baseQps: 1_600_000,
    upgradeName: 'Glimpse of the Dao',
    revival: { name: 'One With the Dao', mult: 25 },
  },
  {
    id: 'sect',
    name: 'Founded Sect',
    icon: '🏯',
    description: 'A mountain, a gate, and a thousand disciples who call you Patriarch.',
    minRealm: 'spiritSevering',
    baseCost: 2.6e23,
    baseQps: 1.2e15,
    upgradeName: 'Sect Charter',
    revival: { name: 'The Sect That Rules the Continent', mult: 25 },
  },
  {
    id: 'dragon',
    name: 'Bound True Dragon',
    icon: '🐉',
    description: 'A true dragon, bound by oath. It exhales qi and inhales mountains.',
    minRealm: 'spiritSevering',
    baseCost: 1.6e23,
    baseQps: 1.2e15,
    upgradeName: 'Dragon Pearl',
    revival: { name: 'Ancestor of Dragons', mult: 25 },
  },
  {
    id: 'smallWorld',
    name: 'Inner Small World',
    icon: '🌍',
    description: 'A world inside your body, with its own sun, rivers and spirit veins.',
    minRealm: 'daoSeeking',
    baseCost: 3.3e23,
    baseQps: 1.4e15,
    upgradeName: 'World Seed',
    revival: { name: 'A World That Cultivates', mult: 25 },
  },
  {
    id: 'starRiver',
    name: 'Star River',
    icon: '🌌',
    description: 'You pluck stars from the sky and drink their light.',
    minRealm: 'daoSeeking',
    baseCost: 8.9e22,
    baseQps: 3.8e15,
    upgradeName: 'Star Map',
    revival: { name: 'Master of the Firmament', mult: 25 },
  },
  {
    id: 'faith',
    name: 'Incense of Ten Thousand Worlds',
    icon: '🛕',
    description: 'Mortals in countless worlds burn incense to you. Their faith becomes qi.',
    minRealm: 'immortalAscension',
    baseCost: 5e26,
    baseQps: 7.3e18,
    upgradeName: 'Wayside Shrines',
    revival: { name: 'Worshipped Across Eternity', mult: 25 },
  },
  {
    id: 'court',
    name: 'Seat in the Heavenly Court',
    icon: '🏛️',
    description: 'A throne among the immortals, and a share of heaven itself.',
    minRealm: 'immortalAscension',
    baseCost: 3e28,
    baseQps: 4.3e20,
    upgradeName: 'Jade Tablet of Office',
  },
  {
    id: 'primordial',
    name: 'Shard of Primordial Chaos',
    icon: '🌑',
    description: 'A fragment of the nothing that came before heaven and earth.',
    minRealm: 'immortalAscension',
    baseCost: 2e30,
    baseQps: 2.9e22,
    upgradeName: 'Touching the Void',
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
