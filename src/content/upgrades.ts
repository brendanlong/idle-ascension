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
 * Two techniques per resource: one soon after you start buying it, one when
 * you own a good stack. Ids keep the old first and last milestones' numbers.
 */
const GENERATOR_MILESTONES = [
  { id: 1, count: 5, costMult: 50, mult: 3 },
  { id: 5, count: 25, costMult: 2_000, mult: 3 },
];

const generatorUpgrades: UpgradeDef[] = GENERATORS.flatMap((gen) =>
  GENERATOR_MILESTONES.map((m, i) => ({
    id: `${gen.id}-${m.id}`,
    name: gen.upgradeNames[i],
    description: `Refine your ${gen.name} technique.`,
    cost: gen.upgradeCosts?.[i] ?? gen.baseCost * m.costMult,
    unlock: { type: 'generator', id: gen.id, count: m.count },
    effects: [{ type: 'generatorMult', generator: gen.id, value: m.mult }],
  })),
);

/** Gathering techniques: your hands learn to pull qi motes out of the air. */
const palmUpgrades: UpgradeDef[] = [
  {
    id: 'palm-1',
    name: 'Iron Palm',
    description: 'Slap a wooden post ten thousand times. Qi sticks to your hardened palms.',
    cost: 99,
    unlock: { type: 'motes', count: 10 },
    effects: [{ type: 'mult', stat: 'moteBaseMult', value: 2 }],
  },
  {
    id: 'palm-2',
    name: 'Cloud-Parting Palm',
    description: 'You part the clouds and gather what falls out. Well, small clouds.',
    cost: 1_000_000,
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
    cost: 6.5e9,
    unlock: { type: 'motes', count: 400 },
    effects: [{ type: 'mult', stat: 'moteValueMult', value: 1.25 }],
  },
  {
    id: 'palm-4',
    name: "Tathagata's Palm",
    description: 'A palm so vast no mote can escape it.',
    cost: 1.3e12,
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
    cost: 4_800,
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
    cost: 1.5e8,
    unlock: { type: 'realm', realm: 'foundation' },
    effects: [{ type: 'mult', stat: 'moteSpawnMult', value: 1.5 }],
  },
  {
    id: 'sense-3',
    name: 'Divine Sense',
    description: 'Your awareness blankets the mountain. Motes drift to you even while you rest.',
    cost: 1.5e13,
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
    cost: 8.1e7,
    unlock: { type: 'realm', realm: 'qiCondensation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.01 }],
  },
  {
    id: 'scripture-1',
    name: 'Heaven and Earth Harmony Scripture',
    description: 'Breathe with the world, and the world breathes with you.',
    cost: 3.8e9,
    unlock: { type: 'realm', realm: 'foundation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'scripture-2',
    name: 'Nine Yang Divine Art',
    description: 'Your body burns with inexhaustible yang energy.',
    cost: 9.9e10,
    unlock: { type: 'realm', realm: 'coreFormation' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'scripture-3',
    name: 'Nine Yin True Scripture',
    description: 'The cold counterpart to Nine Yang. Together, they balance.',
    cost: 2.9e14,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'scripture-4',
    name: 'Scripture of Severed Emotion',
    description: 'Love, hate, grief. Burn them all as fuel.',
    cost: 6.3e16,
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
    cost: 1.1e15,
    unlock: { type: 'realm', realm: 'nascentSoul' },
    effects: [{ type: 'mult', stat: 'globalMult', value: 1.5 }],
  },
  {
    id: 'soul-2',
    name: 'Soul Splitting Art',
    description: 'Why have one Nascent Soul when you could have several?',
    cost: 1.9e17,
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

/**
 * Late techniques that make an old resource worth buying again for a while:
 * the classic resources stay within a few times of the best deal, so ×10
 * puts one on top until its rising price catches up.
 */
const revivalUpgrades: UpgradeDef[] = [
  {
    id: 'revive-herb',
    name: 'Severed-Spirit Herbs',
    description: 'Herbs grown in soil you have cut free of the mortal world. They remember you.',
    cost: 1e17,
    unlock: { type: 'realm', realm: 'spiritSevering' },
    effects: [{ type: 'generatorMult', generator: 'herb', value: 10 }],
  },
  {
    id: 'revive-array',
    name: 'Array of Severed Bonds',
    description: 'You redraw your first gathering array with a hand that no longer trembles.',
    cost: 1e19,
    unlock: { type: 'realm', realm: 'spiritSevering' },
    effects: [{ type: 'generatorMult', generator: 'array', value: 10 }],
  },
  {
    id: 'revive-furnace',
    name: 'Furnace of the Dao',
    description: 'You understand at last what the furnace was trying to tell you.',
    cost: 1e23,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'generatorMult', generator: 'furnace', value: 10 }],
  },
  {
    id: 'revive-disciple',
    name: 'Disciples Glimpse the Dao',
    description: 'Your outer disciples overhear one sentence of your meditation. It changes them.',
    cost: 1e25,
    unlock: { type: 'realm', realm: 'daoSeeking' },
    effects: [{ type: 'generatorMult', generator: 'disciple', value: 10 }],
  },
  {
    id: 'revive-beast',
    name: 'Beasts Ascend With You',
    description: 'Your old fox kit has grown nine tails and an opinion about the heavens.',
    cost: 1e29,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'generatorMult', generator: 'beast', value: 10 }],
  },
  {
    id: 'revive-vein',
    name: 'Veins of the Heavens',
    description: 'The spirit veins you mined as a youth run all the way up to heaven.',
    cost: 1e31,
    unlock: { type: 'realm', realm: 'immortalAscension' },
    effects: [{ type: 'generatorMult', generator: 'vein', value: 10 }],
  },
];

export const UPGRADES: readonly UpgradeDef[] = [
  ...revivalUpgrades,
  ...palmUpgrades,
  ...senseUpgrades,
  ...scriptureUpgrades,
  ...soulUpgrades,
  ...generatorUpgrades,
];

export const UPGRADES_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(
  UPGRADES.map((u) => [u.id, u]),
);
