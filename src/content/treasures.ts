import type { Effect } from '../engine/effects';

export interface TreasureDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Minimum realm (by id) before this treasure can be found. */
  minRealm: string;
  effects: readonly Effect[];
}

export const TREASURES: readonly TreasureDef[] = [
  {
    id: 'jadeSlip',
    name: 'Cracked Jade Slip',
    icon: '🀄',
    description: 'A palm technique half-erased by time. The remaining half is plenty.',
    minRealm: 'qiCondensation',
    effects: [{ type: 'mult', stat: 'clickMult', value: 3 }],
  },
  {
    id: 'pendant',
    name: 'Qi-Drawing Pendant',
    icon: '📿',
    description: 'Wandering qi finds its way to you.',
    minRealm: 'qiCondensation',
    effects: [
      { type: 'mult', stat: 'moteSpawnMult', value: 1.5 },
      { type: 'mult', stat: 'moteValueMult', value: 2 },
    ],
  },
  {
    id: 'bottle',
    name: 'Mysterious Green Bottle',
    icon: '🍶',
    description: 'It gathers a single drop of heavenly dew each night. Your herbs adore it.',
    minRealm: 'qiCondensation',
    effects: [{ type: 'generatorMult', generator: 'herb', value: 5 }],
  },
  {
    id: 'mouse',
    name: 'Treasure-Sniffing Mouse',
    icon: '🐭',
    description: 'It squeaks whenever opportunity is near. It squeaks a lot.',
    minRealm: 'foundation',
    effects: [{ type: 'mult', stat: 'encounterRateMult', value: 1.5 }],
  },
  {
    id: 'robe',
    name: 'Thunder-Warding Robe',
    icon: '🥋',
    description: 'Woven from the hair of a lightning-struck ox. Smells faintly of ozone.',
    minRealm: 'foundation',
    effects: [{ type: 'add', stat: 'tribulationAllowedHits', value: 1 }],
  },
  {
    id: 'ring',
    name: 'Ring of the Old Master',
    icon: '💍',
    description:
      'An ancient soul dwells within. He is rude, lazy, and knows ten thousand techniques.',
    minRealm: 'foundation',
    effects: [
      { type: 'mult', stat: 'globalMult', value: 1.5 },
      { type: 'add', stat: 'clickQpsFraction', value: 0.01 },
    ],
  },
  {
    id: 'pill',
    name: 'Nine-Revolution Golden Pill',
    icon: '💊',
    description: 'Swallow it and your core will form as if polished by heaven.',
    minRealm: 'foundation',
    effects: [{ type: 'mult', stat: 'coreCostMult', value: 0.5 }],
  },
  {
    id: 'sword',
    name: "Shard of an Immortal's Sword",
    icon: '🗡️',
    description: 'Even broken, it hums with killing intent that cows the heavens.',
    minRealm: 'coreFormation',
    effects: [
      { type: 'mult', stat: 'globalMult', value: 2 },
      { type: 'mult', stat: 'tribulationBoltTimeMult', value: 1.25 },
    ],
  },
  {
    id: 'cauldron',
    name: 'Cauldron of the Yellow Emperor',
    icon: '🏺',
    description: 'Pills refined in it come out with cloud patterns. Very prestigious.',
    minRealm: 'nascentSoul',
    effects: [{ type: 'generatorMult', generator: 'furnace', value: 10 }],
  },
];

export const TREASURES_BY_ID: ReadonlyMap<string, TreasureDef> = new Map(
  TREASURES.map((t) => [t.id, t]),
);
