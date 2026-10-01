import type { Condition } from '../engine/conditions';
import type { Effect } from '../engine/effects';
import { GENERATORS, GENERATORS_BY_ID } from './generators';
import { REALMS_BY_ID } from './realms';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /**
   * A revival of this resource: its multiplier is sized when learned (see
   * revivalMult in engine/stats.ts), so `effects` is empty.
   */
  revives?: string;
  /** For a realm's techniques: the stage of the realm whose breakthrough prices it. */
  realmStage?: number;
  /** For a resource's techniques: priced at `mult` times the resource's base cost. */
  resourcePrice?: { generator: string; mult: number };
  unlock: Condition;
  effects: readonly Effect[];
}

/** A cheap early technique for each resource, soon after you start buying it. */
const GENERATOR_MILESTONE = { count: 3, costMult: 15, mult: 2 };
/** Revival techniques unlock at this many of the resource two tiers newer. */
const REVIVAL_NEWER_COUNT = 10;
/** About five minutes of income when a revival unlocks, across the game. */
const REVIVAL_COST_MULT = 20_000;

/**
 * A realm's techniques each cost this share of a different breakthrough in
 * the realm, so they arrive one at a time as you climb it.
 */
const REALM_TECHNIQUE_SHARE = 0.5;

export function realmTechniqueCost(realm: string, stage: number): number {
  return REALMS_BY_ID.get(realm)!.stageCosts[stage] * REALM_TECHNIQUE_SHARE;
}

const generatorUpgrades: UpgradeDef[] = GENERATORS.flatMap((gen, i) => {
  const early: UpgradeDef = {
    id: `${gen.id}-1`,
    name: gen.upgradeName,
    description: `Refine your ${gen.name} technique.`,
    cost: gen.baseCost * GENERATOR_MILESTONE.costMult,
    resourcePrice: { generator: gen.id, mult: GENERATOR_MILESTONE.costMult },
    unlock: { type: 'generator', id: gen.id, count: GENERATOR_MILESTONE.count },
    effects: [{ type: 'generatorMult', generator: gen.id, value: GENERATOR_MILESTONE.mult }],
  };
  const newer = GENERATORS[i + 2];
  if (!gen.revival || !newer) return [early];
  const revival: UpgradeDef = {
    id: `${gen.id}-5`,
    name: gen.revival.name,
    description: `Old foundations, new understanding. Your ${gen.name} matters again.`,
    cost: gen.baseCost * REVIVAL_COST_MULT,
    resourcePrice: { generator: gen.id, mult: REVIVAL_COST_MULT },
    unlock: { type: 'generator', id: newer.id, count: REVIVAL_NEWER_COUNT },
    revives: gen.id,
    effects: [],
  };
  return [early, revival];
});

/** Gathering techniques: your hands learn to pull qi motes out of the air. */
const palmUpgrades: UpgradeDef[] = [
  {
    id: 'palm-1',
    name: 'Iron Palm',
    description: 'Slap a wooden post ten thousand times. Qi sticks to your hardened palms.',
    cost: 100,
    unlock: { type: 'motes', count: 10 },
    effects: [{ type: 'mult', stat: 'moteBaseMult', value: 2 }],
  },
  {
    id: 'palm-2',
    name: 'Cloud-Parting Palm',
    description: 'You part the clouds and gather what falls out. Well, small clouds.',
    cost: 5_000,
    unlock: { type: 'motes', count: 100 },
    effects: [
      { type: 'mult', stat: 'moteBaseMult', value: 2 },
      { type: 'mult', stat: 'moteValueMult', value: 1.25 },
    ],
  },
  {
    id: 'palm-3',
    name: 'Eighteen Dragon-Subduing Palms',
    description: 'Each mote you seize carries more of everything you cultivate.',
    cost: 500_000,
    unlock: { type: 'motes', count: 400 },
    effects: [{ type: 'mult', stat: 'moteValueMult', value: 1.25 }],
  },
  {
    id: 'palm-4',
    name: "Tathagata's Palm",
    description: 'A palm so vast no mote can escape it.',
    cost: 2e7,
    unlock: { type: 'motes', count: 1_500 },
    effects: [{ type: 'mult', stat: 'moteSpawnMult', value: 1.25 }],
  },
  {
    id: 'palm-5',
    name: 'Heaven-Shattering Finger',
    description: 'One finger. The sky cracks, and qi pours through.',
    cost: 5e10,
    unlock: { type: 'motes', count: 4_000 },
    effects: [{ type: 'mult', stat: 'moteValueMult', value: 1.25 }],
  },
  {
    id: 'palm-6',
    name: 'Palm That Covers the Sky',
    description: 'You raise your hand and the qi of the whole sky drifts toward it.',
    cost: realmTechniqueCost('daoSeeking', 3),
    realmStage: 3,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'mult', stat: 'moteSpawnMult', value: 1.25 }],
  },
  {
    id: 'palm-7',
    name: 'Finger That Ends Worlds',
    description: 'Somewhere, a small world you never visited quietly becomes qi for you.',
    cost: realmTechniqueCost('immortalAscension', 1),
    realmStage: 1,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'mult', stat: 'moteValueMult', value: 1.25 }],
  },
];

const senseUpgrades: UpgradeDef[] = [
  {
    id: 'sense-1',
    name: 'Spiritual Sense',
    description: 'You begin to notice the drifting motes of qi around you.',
    cost: 300,
    unlock: { type: 'realm', realm: 'qiCondensation' },
    effects: [
      { type: 'mult', stat: 'moteSpawnMult', value: 1.5 },
      { type: 'mult', stat: 'moteValueMult', value: 1.5 },
    ],
  },
  {
    id: 'sense-2',
    name: 'Qi Whirlpool',
    description: 'Qi spirals toward you like water into a drain.',
    cost: realmTechniqueCost('foundation', 2),
    realmStage: 2,
    unlock: { type: 'realm', realm: 'foundation' },
    effects: [{ type: 'mult', stat: 'moteSpawnMult', value: 1.5 }],
  },
  {
    id: 'sense-3',
    name: 'Divine Sense',
    description: 'Your awareness blankets the mountain. Motes drift to you even while you rest.',
    cost: realmTechniqueCost('nascentSoul', 1),
    realmStage: 1,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'add', stat: 'moteAutoCollect', value: 0.1 }],
  },
  {
    id: 'sense-4',
    name: 'Eye of Heaven',
    description: 'You see every mote of qi between here and the edge of the world.',
    cost: realmTechniqueCost('daoSeeking', 1),
    realmStage: 1,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'add', stat: 'moteAutoCollect', value: 0.1 }],
  },
];

const scriptureUpgrades: UpgradeDef[] = [
  {
    id: 'sunflower',
    name: 'Sunflower Manual',
    description:
      '"To practice this art, one must first—" You close the book. You will not be practicing this art.',
    cost: 7_800,
    unlock: { type: 'realm', realm: 'qiCondensation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.01 }],
  },
  {
    id: 'scripture-1',
    name: 'Heaven and Earth Harmony Scripture',
    description: 'Breathe with the world, and the world breathes with you.',
    cost: realmTechniqueCost('foundation', 0),
    realmStage: 0,
    unlock: { type: 'realm', realm: 'foundation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'scripture-2',
    name: 'Nine Yang Divine Art',
    description: 'Your body burns with inexhaustible yang energy.',
    cost: realmTechniqueCost('coreFormation', 1),
    realmStage: 1,
    unlock: { type: 'realm', realm: 'coreFormation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'scripture-3',
    name: 'Nine Yin True Scripture',
    description: 'The cold counterpart to Nine Yang. Together, they balance.',
    cost: realmTechniqueCost('nascentSoul', 0),
    realmStage: 0,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'scripture-4',
    name: 'Scripture of Severed Emotion',
    description: 'Love, hate, grief. Burn them all as fuel.',
    cost: realmTechniqueCost('spiritSevering', 0),
    realmStage: 0,
    unlock: { type: 'realm', realm: 'spiritSevering' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'scripture-5',
    name: 'The Wordless Sutra',
    description: 'It has no words. You understand it completely.',
    cost: realmTechniqueCost('daoSeeking', 0),
    realmStage: 0,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 3 }],
  },
  {
    id: 'scripture-6',
    name: 'Canon of the Nine Heavens',
    description: 'Written by the first immortal, for the last.',
    cost: realmTechniqueCost('immortalAscension', 0),
    realmStage: 0,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 3 }],
  },
  {
    id: 'scripture-7',
    name: 'Record of the Heavenly Dao',
    description: 'Not a book about the Dao. The Dao, written down.',
    cost: realmTechniqueCost('immortalAscension', 2),
    realmStage: 2,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 4 }],
  },
];

const soulUpgrades: UpgradeDef[] = [
  {
    id: 'soul-1',
    name: 'Soul Nourishing Wood',
    description: 'Your Nascent Soul grows quicker at its practice, and cultivates beside you.',
    cost: realmTechniqueCost('nascentSoul', 2),
    realmStage: 2,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'soul-2',
    name: 'Soul Splitting Art',
    description: 'Why have one Nascent Soul when you could have several?',
    cost: realmTechniqueCost('spiritSevering', 2),
    realmStage: 2,
    unlock: { type: 'realm', realm: 'spiritSevering' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'soul-3',
    name: 'Ten Thousand Avatars',
    description: 'Your avatars cultivate in ten thousand places at once.',
    cost: realmTechniqueCost('daoSeeking', 2),
    realmStage: 2,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2.5 }],
  },
];

export const UPGRADES: readonly UpgradeDef[] = [
  ...palmUpgrades,
  ...senseUpgrades,
  ...scriptureUpgrades,
  ...soulUpgrades,
  ...generatorUpgrades,
];

/** Re-prices techniques that follow a resource or a breakthrough, after those change. */
export function priceUpgrades(): void {
  for (const u of UPGRADES as UpgradeDef[]) {
    if (u.resourcePrice) {
      const { generator, mult } = u.resourcePrice;
      u.cost = GENERATORS_BY_ID.get(generator)!.baseCost * mult;
    } else if (u.unlock.type === 'realm' && u.realmStage !== undefined) {
      u.cost = realmTechniqueCost(u.unlock.realm, u.realmStage);
    }
  }
}

export const UPGRADES_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(
  UPGRADES.map((u) => [u.id, u]),
);
