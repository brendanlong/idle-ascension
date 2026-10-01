import type { Condition } from '../engine/conditions';
import type { Effect } from '../engine/effects';
import { GENERATORS } from './generators';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  unlock: Condition;
  effects: readonly Effect[];
}

/**
 * Counts where most resources still make up a good share of income, so each
 * ×2 matters when it unlocks. Costs are roughly 10-40 times the price of the
 * resource at that count.
 */
const GENERATOR_MILESTONES = [
  { count: 1, costMult: 10 },
  { count: 5, costMult: 50 },
  { count: 10, costMult: 150 },
  { count: 20, costMult: 700 },
  { count: 35, costMult: 5_000 },
];

const generatorUpgrades: UpgradeDef[] = GENERATORS.flatMap((gen) =>
  GENERATOR_MILESTONES.map((m, i) => ({
    id: `${gen.id}-${i + 1}`,
    name: gen.upgradeNames[i],
    description: `Refine your ${gen.name} technique.`,
    cost: gen.baseCost * m.costMult,
    unlock: { type: 'generator', id: gen.id, count: m.count },
    effects: [{ type: 'generatorMult', generator: gen.id, value: 2 }],
  })),
);

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
    cost: 20_000_000,
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
    cost: 2e24,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'mult', stat: 'moteSpawnMult', value: 1.25 }],
  },
  {
    id: 'palm-7',
    name: 'Finger That Ends Worlds',
    description: 'Somewhere, a small world you never visited quietly becomes qi for you.',
    cost: 2e30,
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
    cost: 400_000,
    unlock: { type: 'realm', realm: 'foundation' },
    effects: [{ type: 'mult', stat: 'moteSpawnMult', value: 1.5 }],
  },
  {
    id: 'sense-3',
    name: 'Divine Sense',
    description: 'Your awareness blankets the mountain. Motes drift to you even while you rest.',
    cost: 5e10,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'add', stat: 'moteAutoCollect', value: 0.1 }],
  },
  {
    id: 'sense-4',
    name: 'Eye of Heaven',
    description: 'You see every mote of qi between here and the edge of the world.',
    cost: 5e24,
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
    cost: 7_777,
    unlock: { type: 'realm', realm: 'qiCondensation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.01 }],
  },
  {
    id: 'scripture-1',
    name: 'Heaven and Earth Harmony Scripture',
    description: 'Breathe with the world, and the world breathes with you.',
    cost: 3_000_000,
    unlock: { type: 'realm', realm: 'foundation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'scripture-2',
    name: 'Nine Yang Divine Art',
    description: 'Your body burns with inexhaustible yang energy.',
    cost: 1e9,
    unlock: { type: 'realm', realm: 'coreFormation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'scripture-3',
    name: 'Nine Yin True Scripture',
    description: 'The cold counterpart to Nine Yang. Together, they balance.',
    cost: 5e11,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'scripture-4',
    name: 'Scripture of Severed Emotion',
    description: 'Love, hate, grief. Burn them all as fuel.',
    cost: 5e14,
    unlock: { type: 'realm', realm: 'spiritSevering' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'scripture-5',
    name: 'The Wordless Sutra',
    description: 'It has no words. You understand it completely.',
    cost: 5e23,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 3 }],
  },
  {
    id: 'scripture-6',
    name: 'Canon of the Nine Heavens',
    description: 'Written by the first immortal, for the last.',
    cost: 3e28,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 3 }],
  },
  {
    id: 'scripture-7',
    name: 'Record of the Heavenly Dao',
    description: 'Not a book about the Dao. The Dao, written down.',
    cost: 5e31,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 4 }],
  },
];

const soulUpgrades: UpgradeDef[] = [
  {
    id: 'soul-1',
    name: 'Soul Nourishing Wood',
    description: 'Your Nascent Soul grows quicker at its practice, and cultivates beside you.',
    cost: 1e12,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'soul-2',
    name: 'Soul Splitting Art',
    description: 'Why have one Nascent Soul when you could have several?',
    cost: 1e15,
    unlock: { type: 'realm', realm: 'spiritSevering' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'soul-3',
    name: 'Ten Thousand Avatars',
    description: 'Your avatars cultivate in ten thousand places at once.',
    cost: 5e25,
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

export const UPGRADES_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(
  UPGRADES.map((u) => [u.id, u]),
);
