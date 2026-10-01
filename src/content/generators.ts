import { STAGES } from './realms';

export interface GeneratorDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Set by priceResources, except for the first tier's. */
  baseCost: number;
  baseQps: number;
  /** Realm (by id) required before it can be bought. */
  minRealm?: string;
  /** Name of the technique unlocked once you own a few of this resource. */
  upgradeName: string;
  /**
   * A late technique that makes this resource briefly the best again, unlocked
   * once you own a few of the resource two tiers newer (see revivalMult).
   */
  revival?: { name: string };
}

export const GENERATOR_COST_GROWTH = 1.15;

/**
 * Resources form a ladder over the breakthrough curve, so there's a new one
 * every few stages all game (see "Content follows the curve" in
 * docs/balance-spec.md). Tier n (from 0) arrives around stage
 * `stagesPerTier` x n, costing `costShare` of that stage's breakthrough, and
 * makes `efficiencyStep` times as much qi/s per qi as the tier before. The
 * first tier is priced by hand. Fit with scripts/balance/tune_curve.py.
 */
export const RESOURCE_LADDER = { stagesPerTier: 2, costShare: 0.1, efficiencyStep: 0.5 };

export const GENERATORS: readonly GeneratorDef[] = (
  [
    {
      id: 'cushion',
      name: 'Meditation Cushion',
      icon: '🧘',
      description: 'A worn straw cushion. Sit, breathe, and let qi seep in.',
      baseCost: 15,
      baseQps: 0.1,
      upgradeName: 'Lotus Posture',
      revival: { name: 'Sitting Through Kalpas' },
    },
    {
      id: 'herb',
      name: 'Spirit Herb Patch',
      icon: '🌿',
      description: 'Spirit grass that drinks moonlight and exhales qi.',
      upgradeName: 'Spirit Soil',
      revival: { name: 'Garden of the Queen Mother' },
    },
    {
      id: 'array',
      name: 'Qi-Gathering Array',
      icon: '☯️',
      description: 'Carved flags and spirit stones that pull qi from the land.',
      upgradeName: 'Gathering Sigils',
      revival: { name: 'Array Embracing the Stars' },
    },
    {
      id: 'furnace',
      name: 'Pill Furnace',
      icon: '⚗️',
      description: 'Refines herbs into pills. Occasionally explodes. Mostly worth it.',
      upgradeName: 'Pill Recipes',
      revival: { name: 'Eight Trigrams Furnace' },
    },
    {
      id: 'disciple',
      name: 'Outer Sect Disciple',
      icon: '👥',
      description: 'Hopeful juniors who tithe qi for your "guidance."',
      upgradeName: 'Sect Entrance Exam',
      revival: { name: 'Ten Thousand Disciples Bow' },
    },
    {
      id: 'beast',
      name: 'Tamed Spirit Beast',
      icon: '🦊',
      description: 'A nine-tailed fox kit. It hunts qi and brings it home.',
      upgradeName: 'Beast-Taming Collar',
      revival: { name: 'Qilin Descendant' },
    },
    {
      id: 'vein',
      name: 'Spirit Vein',
      icon: '⛰️',
      description: 'A river of crystallized qi running beneath a mountain.',
      upgradeName: 'Mining Rights',
      revival: { name: 'Heart of the Continent' },
    },
    {
      id: 'secretRealm',
      name: 'Secret Realm',
      icon: '🌀',
      description: 'A pocket world sealed since antiquity. Now it is yours.',
      upgradeName: 'Realm Key',
      revival: { name: 'A Realm of Your Own' },
    },
    {
      id: 'inheritance',
      name: 'Ancient Inheritance',
      icon: '📜',
      description: 'The legacy of a fallen immortal, waiting for a worthy heir.',
      upgradeName: 'Trial of Worthiness',
      revival: { name: 'Heir of the Ancients' },
    },
    {
      id: 'dao',
      name: 'Fragment of the Heavenly Dao',
      icon: '✨',
      description: 'A shard of the law that governs heaven and earth.',
      upgradeName: 'Glimpse of the Dao',
      revival: { name: 'One With the Dao' },
    },
    {
      id: 'sect',
      name: 'Founded Sect',
      icon: '🏯',
      description: 'A mountain, a gate, and a thousand disciples who call you Patriarch.',
      minRealm: 'nascentSoul',
      upgradeName: 'Sect Charter',
      revival: { name: 'The Sect That Rules the Continent' },
    },
    {
      id: 'dragon',
      name: 'Bound True Dragon',
      icon: '🐉',
      description: 'A true dragon, bound by oath. It exhales qi and inhales mountains.',
      minRealm: 'spiritSevering',
      upgradeName: 'Dragon Pearl',
      revival: { name: 'Ancestor of Dragons' },
    },
    {
      id: 'smallWorld',
      name: 'Inner Small World',
      icon: '🌍',
      description: 'A world inside your body, with its own sun, rivers and spirit veins.',
      minRealm: 'spiritSevering',
      upgradeName: 'World Seed',
      revival: { name: 'A World That Cultivates' },
    },
    {
      id: 'starRiver',
      name: 'Star River',
      icon: '🌌',
      description: 'You pluck stars from the sky and drink their light.',
      minRealm: 'daoSeeking',
      upgradeName: 'Star Map',
      revival: { name: 'Master of the Firmament' },
    },
    {
      id: 'faith',
      name: 'Incense of Ten Thousand Worlds',
      icon: '🛕',
      description: 'Mortals in countless worlds burn incense to you. Their faith becomes qi.',
      minRealm: 'daoSeeking',
      upgradeName: 'Wayside Shrines',
      revival: { name: 'Worshipped Across Eternity' },
    },
    {
      id: 'court',
      name: 'Seat in the Heavenly Court',
      icon: '🏛️',
      description: 'A throne among the immortals, and a share of heaven itself.',
      minRealm: 'immortalAscension',
      upgradeName: 'Jade Tablet of Office',
    },
    {
      id: 'primordial',
      name: 'Shard of Primordial Chaos',
      icon: '🌑',
      description: 'A fragment of the nothing that came before heaven and earth.',
      minRealm: 'immortalAscension',
      upgradeName: 'Touching the Void',
    },
  ] as Omit<GeneratorDef, 'baseCost' | 'baseQps'>[]
).map((g) => ({ baseCost: 0, baseQps: 0, ...g }) as GeneratorDef);

/** Prices every resource after the first from the breakthrough costs (call again if they change). */
export function priceResources(): void {
  const [first, ...rest] = GENERATORS as GeneratorDef[];
  let efficiency = first.baseQps / first.baseCost;
  rest.forEach((g, i) => {
    const stage = Math.min(RESOURCE_LADDER.stagesPerTier * (i + 1), STAGES.length - 1);
    efficiency *= RESOURCE_LADDER.efficiencyStep;
    g.baseCost = RESOURCE_LADDER.costShare * STAGES[stage].cost;
    g.baseQps = g.baseCost * efficiency;
  });
}
priceResources();

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
