import type { Effect } from '../engine/effects';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RarityDef {
  name: string;
  color: string;
  /** Relative chance of this treasure being chosen when an encounter gives one. */
  weight: number;
}

export const RARITIES: Readonly<Record<Rarity, RarityDef>> = {
  common: { name: 'Common', color: '#c9bfae', weight: 10 },
  uncommon: { name: 'Uncommon', color: '#6fcfa8', weight: 5 },
  rare: { name: 'Rare', color: '#7fa8ff', weight: 2 },
  legendary: { name: 'Legendary', color: '#f0a64b', weight: 0.6 },
};

/** Finding a treasure you already own refines it, up to this level. */
export const MAX_TREASURE_LEVEL = 5;
/**
 * Owned treasures are this much less likely to be picked than unfound ones
 * of the same rarity, so the collection fills out before upgrades dominate.
 */
export const OWNED_TREASURE_WEIGHT_FACTOR = 0.4;

export interface TreasureDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: Rarity;
  /** Minimum realm (by id) before this treasure can be found. */
  minRealm: string;
  /** Effects at level 1; see scaleEffect() for how they grow with level. */
  effects: readonly Effect[];
  /** Effects that stay the same at every level (for stats with natural caps). */
  fixedEffects?: readonly Effect[];
}

export const TREASURES: readonly TreasureDef[] = [
  // --- Qi Condensation ---
  {
    id: 'jadeSlip',
    name: 'Cracked Jade Slip',
    icon: '🀄',
    description: 'A palm technique half-erased by time. The remaining half is plenty.',
    rarity: 'common',
    minRealm: 'qiCondensation',
    effects: [{ type: 'mult', stat: 'clickMult', value: 3 }],
  },
  {
    id: 'pendant',
    name: 'Qi-Drawing Pendant',
    icon: '📿',
    description: 'Wandering qi finds its way to you.',
    rarity: 'common',
    minRealm: 'qiCondensation',
    effects: [
      { type: 'mult', stat: 'moteSpawnMult', value: 1.25 },
      { type: 'mult', stat: 'moteValueMult', value: 1.5 },
    ],
  },
  {
    id: 'bottle',
    name: 'Mysterious Green Bottle',
    icon: '🍶',
    description: 'It gathers a single drop of heavenly dew each night. Your herbs adore it.',
    rarity: 'uncommon',
    minRealm: 'qiCondensation',
    effects: [{ type: 'generatorMult', generator: 'herb', value: 5 }],
  },
  // --- Foundation Establishment ---
  {
    id: 'robe',
    name: 'Thunder-Warding Robe',
    icon: '🥋',
    description: 'Woven from the hair of a lightning-struck ox. Smells faintly of ozone.',
    rarity: 'common',
    minRealm: 'foundation',
    effects: [
      { type: 'add', stat: 'tribulationLeniency', value: 0.05 },
      { type: 'mult', stat: 'tribulationSlowMult', value: 1.1 },
    ],
  },
  {
    id: 'mouse',
    name: 'Treasure-Sniffing Mouse',
    icon: '🐭',
    description: 'It squeaks whenever opportunity is near. It squeaks a lot.',
    rarity: 'uncommon',
    minRealm: 'foundation',
    effects: [{ type: 'mult', stat: 'encounterRateMult', value: 1.5 }],
  },
  {
    id: 'pill',
    name: 'Nine-Revolution Golden Pill',
    icon: '💊',
    description: 'Swallow it and your core will form as if polished by heaven.',
    rarity: 'uncommon',
    minRealm: 'foundation',
    effects: [{ type: 'mult', stat: 'coreCostMult', value: 0.5 }],
  },
  {
    id: 'ring',
    name: 'Ring of the Old Master',
    icon: '💍',
    description:
      'An ancient soul dwells within. He is rude, lazy, and knows ten thousand techniques.',
    rarity: 'rare',
    minRealm: 'foundation',
    effects: [
      { type: 'mult', stat: 'globalMult', value: 1.5 },
      { type: 'add', stat: 'clickQpsFraction', value: 0.01 },
    ],
  },
  // --- Core Formation ---
  {
    id: 'sword',
    name: "Shard of an Immortal's Sword",
    icon: '🗡️',
    description: 'Even broken, it hums with killing intent that cows the heavens.',
    rarity: 'rare',
    minRealm: 'coreFormation',
    fixedEffects: [{ type: 'mult', stat: 'tribulationSlowMult', value: 1.25 }],
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  // --- Nascent Soul ---
  {
    id: 'cauldron',
    name: 'Cauldron of the Yellow Emperor',
    icon: '🏺',
    description: 'Pills refined in it come out with cloud patterns. Very prestigious.',
    rarity: 'uncommon',
    minRealm: 'nascentSoul',
    effects: [{ type: 'generatorMult', generator: 'furnace', value: 10 }],
  },
  // --- Spirit Severing ---
  {
    id: 'bell',
    name: 'Soul-Calming Bell',
    icon: '🔔',
    description: 'One chime and your heart grows still, even under a sky full of lightning.',
    rarity: 'common',
    minRealm: 'spiritSevering',
    effects: [{ type: 'mult', stat: 'tribulationSlowMult', value: 1.2 }],
  },
  {
    id: 'gourd',
    name: 'Heaven-Swallowing Gourd',
    icon: '🫙',
    description: 'Uncork it beside a spirit vein and watch the vein disappear.',
    rarity: 'uncommon',
    minRealm: 'spiritSevering',
    effects: [{ type: 'generatorMult', generator: 'vein', value: 8 }],
  },
  {
    id: 'mirror',
    name: 'Mirror of Samsara',
    icon: '🪞',
    description: 'It shows your past lives. There are more of them than you remembered.',
    rarity: 'rare',
    minRealm: 'spiritSevering',
    effects: [{ type: 'add', stat: 'memoryBonus', value: 0.01 }],
  },
  // --- Dao Seeking ---
  {
    id: 'fan',
    name: 'Plantain-Leaf Fan',
    icon: '🪭',
    description: 'One wave stirs a gale of qi. Two waves, and the mountain moves.',
    rarity: 'common',
    minRealm: 'daoSeeking',
    effects: [
      { type: 'mult', stat: 'moteSpawnMult', value: 1.25 },
      { type: 'mult', stat: 'moteValueMult', value: 1.5 },
    ],
  },
  {
    id: 'whisk',
    name: "Immortal's Horsetail Whisk",
    icon: '🪶',
    description: 'Every flick carries a trace of everything you cultivate.',
    rarity: 'uncommon',
    minRealm: 'daoSeeking',
    effects: [{ type: 'add', stat: 'clickQpsFraction', value: 0.02 }],
  },
  {
    id: 'lamp',
    name: 'Lamp of the Eternal Dao',
    icon: '🪔',
    description: 'Its flame has burned since before the first sunrise.',
    rarity: 'uncommon',
    minRealm: 'daoSeeking',
    effects: [{ type: 'generatorMult', generator: 'dao', value: 10 }],
  },
  {
    id: 'seal',
    name: 'Nine Dragon Seal',
    icon: '🐉',
    description: 'Nine dragons coil around its handle. Emperors went to war over lesser seals.',
    rarity: 'rare',
    minRealm: 'daoSeeking',
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  // --- Immortal Ascension ---
  {
    id: 'chart',
    name: 'Star Chart of the Nine Heavens',
    icon: '🗺️',
    description: 'Every secret realm and hidden cave, marked in starlight.',
    rarity: 'common',
    minRealm: 'immortalAscension',
    effects: [{ type: 'mult', stat: 'encounterRateMult', value: 1.3 }],
  },
  {
    id: 'featherRobe',
    name: 'Feathered Robe of an Immortal',
    icon: '🪽',
    description: 'Wearing it, you cultivate even in your sleep. Especially in your sleep.',
    rarity: 'uncommon',
    minRealm: 'immortalAscension',
    fixedEffects: [{ type: 'add', stat: 'offlineEfficiency', value: 0.15 }],
    effects: [{ type: 'add', stat: 'offlineCapHours', value: 4 }],
  },
  {
    id: 'peach',
    name: 'Peach of Immortality',
    icon: '🍑',
    description: "From the Queen Mother's own orchard. It ripens once every three thousand years.",
    rarity: 'rare',
    minRealm: 'immortalAscension',
    effects: [{ type: 'add', stat: 'autoClicksPerSecond', value: 5 }],
  },
  {
    id: 'chaosStone',
    name: 'Primordial Chaos Stone',
    icon: '🌑',
    description: 'A pebble left over from before heaven and earth were separated.',
    rarity: 'legendary',
    minRealm: 'immortalAscension',
    effects: [
      { type: 'mult', stat: 'globalMult', value: 3 },
      { type: 'mult', stat: 'coreCostMult', value: 0.5 },
    ],
  },
];

export const TREASURES_BY_ID: ReadonlyMap<string, TreasureDef> = new Map(
  TREASURES.map((t) => [t.id, t]),
);
