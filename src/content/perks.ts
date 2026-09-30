import type { Effect } from '../engine/effects';

/** Permanent upgrades bought with Memories; they survive regression. */
export interface PerkDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  requires?: readonly string[];
  /** Applied once per level. */
  effects: readonly Effect[];
  /** Non-effect behaviour, handled in engine/prestige.ts. */
  special?: 'keepTreasures' | 'startingResources';
}

export const PERKS: readonly PerkDef[] = [
  {
    id: 'meridians',
    name: 'Remembered Meridian Paths',
    description: 'You know exactly which meridians to open, and in what order.',
    maxLevel: 5,
    baseCost: 1,
    costGrowth: 3,
    effects: [{ type: 'mult', stat: 'clickMult', value: 2 }],
  },
  {
    id: 'stash',
    name: 'Buried Stash',
    description:
      'You remember where a dead man buried his savings. Start each loop with resources.',
    maxLevel: 3,
    baseCost: 2,
    costGrowth: 4,
    effects: [],
    special: 'startingResources',
  },
  {
    id: 'foresight',
    name: 'Foresight of Fortune',
    description: 'You know which cliffs to fall off.',
    maxLevel: 4,
    baseCost: 3,
    costGrowth: 3,
    requires: ['meridians'],
    effects: [{ type: 'mult', stat: 'encounterRateMult', value: 1.25 }],
  },
  {
    id: 'lightning',
    name: 'Memory of Lightning',
    description: 'You have died to these tribulations before. You know where the bolts will fall.',
    maxLevel: 3,
    baseCost: 5,
    costGrowth: 4,
    effects: [
      { type: 'add', stat: 'tribulationAllowedHits', value: 1 },
      { type: 'mult', stat: 'tribulationBoltTimeMult', value: 1.15 },
    ],
  },
  {
    id: 'bargain',
    name: 'Knowing the True Price',
    description: 'Merchants cannot fool someone who has already lived this day.',
    maxLevel: 5,
    baseCost: 4,
    costGrowth: 2.5,
    requires: ['stash'],
    effects: [{ type: 'mult', stat: 'generatorCostMult', value: 0.95 }],
  },
  {
    id: 'insight',
    name: 'Karmic Insight',
    description: 'Each Memory weighs more heavily on the scales of fate.',
    maxLevel: 5,
    baseCost: 10,
    costGrowth: 3,
    requires: ['foresight'],
    effects: [{ type: 'add', stat: 'memoryBonus', value: 0.01 }],
  },
  {
    id: 'patience',
    name: "Old Monster's Patience",
    description: 'You have waited lifetimes. A few more hours is nothing.',
    maxLevel: 3,
    baseCost: 5,
    costGrowth: 3,
    effects: [
      { type: 'add', stat: 'offlineCapHours', value: 4 },
      { type: 'add', stat: 'offlineEfficiency', value: 0.1 },
    ],
  },
  {
    id: 'daoHeart',
    name: 'Unshaken Dao Heart',
    description: 'Your cultivation base recovers swiftly after each return.',
    maxLevel: 3,
    baseCost: 15,
    costGrowth: 4,
    requires: ['bargain'],
    effects: [{ type: 'add', stat: 'startingStage', value: 3 }],
  },
  {
    id: 'soulbound',
    name: 'Soul-Bound Treasures',
    description: 'Your treasures follow your soul back through time.',
    maxLevel: 1,
    baseCost: 40,
    costGrowth: 1,
    requires: ['foresight'],
    effects: [],
    special: 'keepTreasures',
  },
  {
    id: 'echoCore',
    name: 'Echo of a Past Core',
    description:
      'A phantom of a core you once formed. +1 core slot, available from Core Formation.',
    maxLevel: 1,
    baseCost: 75,
    costGrowth: 1,
    requires: ['lightning'],
    effects: [{ type: 'add', stat: 'coreSlots', value: 1 }],
  },
];

export const PERKS_BY_ID: ReadonlyMap<string, PerkDef> = new Map(PERKS.map((p) => [p.id, p]));

export function perkCost(perk: PerkDef, currentLevel: number): number {
  return Math.ceil(perk.baseCost * perk.costGrowth ** currentLevel);
}

/** Generators granted at the start of each loop by the Buried Stash perk, per level (cumulative). */
export const STASH_GENERATORS: readonly Record<string, number>[] = [
  { cushion: 10, herb: 5 },
  { array: 10, furnace: 1 },
  { furnace: 10, disciple: 5 },
];
