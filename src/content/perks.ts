import type { Effect } from '../engine/effects';
import { MAX_TREASURE_LEVEL } from './treasures';

/** Permanent upgrades bought with Memories; they survive regression. */
export interface PerkDef {
  id: string;
  name: string;
  description: string;
  /** Infinity for perks that can be bought forever (at ever-growing cost). */
  maxLevel: number;
  /**
   * The first level costs this share of the Memories from regressing at the
   * start of firstRealm; each later level costs PERK_LEVEL_GROWTH times more
   * (see perkCost in engine/prestige.ts).
   */
  share: number;
  firstRealm: string;
  requires?: readonly string[];
  /** Can't be learned (and stays hidden) until you've reached this realm. */
  minRealm?: string;
  /** Level-1 effects; `scaling` decides how they grow. */
  effects: readonly Effect[];
  /**
   * compound (default): multipliers multiply each level (×2, ×4, ×8).
   * diminishing: logarithmic (see diminishingEffect), for effects that would
   * break the game if they kept growing at a flat rate.
   */
  scaling?: 'compound' | 'diminishing';
  /** Non-effect behaviour, handled in engine/prestige.ts. */
  special?: 'keepTreasures' | 'startingResources';
}

/** Generators granted at the start of each loop by the Buried Stash perk, per level (cumulative). */
export const STASH_GENERATORS: readonly Record<string, number>[] = [
  { cushion: 10, herb: 5 },
  { array: 10, furnace: 1 },
  { furnace: 10, disciple: 5 },
  { disciple: 10, beast: 5 },
  { beast: 10, vein: 3 },
  { vein: 10, secretRealm: 3 },
];

export const PERKS: readonly PerkDef[] = [
  {
    id: 'meridians',
    name: 'Remembered Meridian Paths',
    description: 'You know exactly which meridians to open, and in what order.',
    maxLevel: Infinity,
    share: 0.35,
    firstRealm: 'coreFormation',
    scaling: 'diminishing',
    effects: [{ type: 'mult', stat: 'moteBaseMult', value: 2 }],
  },
  {
    id: 'stash',
    name: 'Buried Stash',
    description: 'You remember where a dead man buried his savings.',
    maxLevel: STASH_GENERATORS.length,
    share: 0.5,
    firstRealm: 'coreFormation',
    effects: [],
    special: 'startingResources',
  },
  {
    id: 'foresight',
    name: 'Foresight of Fortune',
    description: 'You know which cliffs to fall off.',
    maxLevel: Infinity,
    share: 0.5,
    firstRealm: 'coreFormation',
    requires: ['meridians'],
    scaling: 'diminishing',
    effects: [{ type: 'mult', stat: 'encounterRateMult', value: 1.5 }],
  },
  {
    id: 'lightning',
    name: 'Memory of Lightning',
    description: 'You have died to these tribulations before. You know what the heavens will test.',
    maxLevel: Infinity,
    share: 0.5,
    firstRealm: 'coreFormation',
    scaling: 'diminishing',
    effects: [
      { type: 'add', stat: 'tribulationLeniency', value: 0.05 },
      { type: 'mult', stat: 'tribulationSlowMult', value: 1.2 },
    ],
  },
  {
    id: 'bargain',
    name: 'Knowing the True Price',
    description: 'Merchants cannot fool someone who has already lived this day.',
    maxLevel: Infinity,
    share: 0.4,
    firstRealm: 'nascentSoul',
    requires: ['stash'],
    effects: [{ type: 'mult', stat: 'generatorCostMult', value: 0.95 }],
  },
  {
    id: 'insight',
    name: 'Karmic Insight',
    description: 'Each Memory weighs more heavily on the scales of fate.',
    maxLevel: Infinity,
    share: 0.6,
    firstRealm: 'nascentSoul',
    requires: ['foresight'],
    effects: [{ type: 'add', stat: 'memoryPower', value: 0.05 }],
  },
  {
    id: 'patience',
    name: "Old Monster's Patience",
    description: 'You have waited lifetimes. A few more hours is nothing.',
    maxLevel: Infinity,
    share: 0.35,
    firstRealm: 'coreFormation',
    scaling: 'diminishing',
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
    share: 0.5,
    firstRealm: 'nascentSoul',
    requires: ['bargain'],
    effects: [{ type: 'add', stat: 'startingStage', value: 3 }],
  },
  {
    id: 'soulbound',
    name: 'Soul-Bound Treasures',
    description:
      'Your treasures follow your soul back through time. Each level lets them keep one more level of refinement.',
    maxLevel: MAX_TREASURE_LEVEL,
    share: 0.7,
    firstRealm: 'spiritSevering',
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
    share: 0.8,
    firstRealm: 'spiritSevering',
    requires: ['lightning'],
    minRealm: 'spiritSevering',
    effects: [{ type: 'add', stat: 'coreSlots', value: 1 }],
  },
];

export const PERKS_BY_ID: ReadonlyMap<string, PerkDef> = new Map(PERKS.map((p) => [p.id, p]));

/** Save files can't push uncapped perks past this (the cost is already astronomical). */
export const PERK_LEVEL_LIMIT = 200;
