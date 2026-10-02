import type { Condition } from '../engine/conditions';
import type { Effect } from '../engine/effects';
import { progressMultipliers, type RealmLayout } from './progress';

export interface TribulationDef {
  name: string;
  /** How many elemental trials (random elements) make up the tribulation. */
  trials: number;
  /** Average trial score needed to pass, before leniency. */
  passScore: number;
}

export interface RealmDef {
  id: string;
  name: string;
  color: string;
  description: string;
  stageNames: readonly string[];
  /** Qi cost of breaking through into each stage (see priceStages). */
  stageCosts: readonly number[];
  /** Multiplier to all qi gain granted by each stage reached in this realm. */
  stageMultiplier: number;
  tribulation?: TribulationDef;
  requirement?: Condition;
  /** Applied once while at or beyond this realm. */
  effects?: readonly Effect[];
  /** Highest core grade (index into CORE_GRADES) refinable in this realm. */
  coreGradeCap?: number;
  /** Descriptions of unlocks that aren't Effects (for display). */
  unlocks?: readonly string[];
}

const LAYERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'].map(
  (n) => `${n} Layer`,
);
const PHASES = ['Early', 'Middle', 'Late', 'Peak'];

/**
 * Breakthrough costs before cores and Memories (see PRICING in
 * content/progress.ts), Mortal (free) first. Built by
 * scripts/balance/build_costs.py: priced so the reference player, with
 * resources and techniques alone, takes the target time for each stage.
 */
export const BASE_STAGE_COSTS: number[] = [
  0, 54, 82, 150, 400, 1_200, 3_700, 16_000, 57_000, 240_000, 1_000_000, 5_500_000, 2.1e7, 8.7e7,
  3.1e8, 1.2e9, 4.2e9, 2.4e10, 1.9e11, 1.8e12, 1.8e13, 1.9e14, 1.5e15, 9.2e15, 4e16, 1.4e17, 4.3e17,
  1.3e18, 4.3e18, 1.4e19, 4.4e19, 1.4e20, 4.4e20, 1.3e21, 4.5e21,
];

const REALM_DEFS: readonly Omit<RealmDef, 'stageCosts'>[] = [
  {
    id: 'mortal',
    name: 'Mortal',
    color: '#8a8175',
    description: 'Blocked meridians. The clan elders call you trash.',
    stageNames: [''],
    stageMultiplier: 1,
  },
  {
    id: 'qiCondensation',
    name: 'Qi Condensation',
    color: '#b9c7d6',
    description: 'You draw qi into your body and compress it, layer by layer.',
    stageNames: LAYERS,
    stageMultiplier: 1.2,
  },
  {
    id: 'foundation',
    name: 'Foundation Establishment',
    color: '#7fc4a4',
    description: 'Your qi turns liquid, laying the foundation of your Dao.',
    stageNames: PHASES,
    stageMultiplier: 1.5,
    requirement: {
      type: 'generator',
      id: 'furnace',
      count: 1,
      label: 'Requires a Foundation Establishment Pill (own a Pill Furnace)',
    },
    unlocks: ['Fortuitous encounters grow richer'],
  },
  {
    id: 'coreFormation',
    name: 'Core Formation',
    color: '#e0b64a',
    description: 'Your liquid qi condenses into a solid core within your dantian.',
    stageNames: PHASES,
    stageMultiplier: 1.6,
    tribulation: { name: 'Minor Thunder Tribulation', trials: 1, passScore: 0.5 },
    effects: [{ type: 'add', stat: 'coreSlots', value: 1 }],
    coreGradeCap: 2,
    unlocks: ['Regression becomes possible'],
  },
  {
    id: 'nascentSoul',
    name: 'Nascent Soul',
    color: '#d7738a',
    description: 'Your core cracks open and a tiny soul is born, cultivating beside you.',
    stageNames: PHASES,
    stageMultiplier: 1.7,
    tribulation: { name: 'Crimson Thunder Tribulation', trials: 1, passScore: 0.55 },
    effects: [
      { type: 'add', stat: 'moteAutoCollect', value: 0.05 },
      { type: 'add', stat: 'coreSlots', value: 1 },
    ],
    coreGradeCap: 3,
    unlocks: ['Your Nascent Soul gathers qi motes for you'],
  },
  {
    id: 'spiritSevering',
    name: 'Spirit Severing',
    color: '#9a7fd1',
    description: 'You cut away mortal attachments. Your emotions grow distant.',
    stageNames: PHASES,
    stageMultiplier: 1.8,
    tribulation: { name: 'Heart Demon Tribulation', trials: 2, passScore: 0.6 },
    effects: [{ type: 'add', stat: 'coreSlots', value: 1 }],
    coreGradeCap: 4,
  },
  {
    id: 'daoSeeking',
    name: 'Dao Seeking',
    color: '#5aa6d6',
    description: 'You begin to perceive the laws of heaven and earth directly.',
    stageNames: PHASES,
    stageMultiplier: 2,
    tribulation: { name: 'Nine Heavens Thunder Tribulation', trials: 2, passScore: 0.65 },
    effects: [{ type: 'add', stat: 'coreSlots', value: 1 }],
    coreGradeCap: 5,
  },
  {
    id: 'immortalAscension',
    name: 'Immortal Ascension',
    color: '#f2e6c4',
    description: 'Mortal flesh falls away. You stand at the threshold of the heavens.',
    stageNames: PHASES,
    stageMultiplier: 2.2,
    tribulation: { name: 'Immortal Severing Tribulation', trials: 3, passScore: 0.7 },
    coreGradeCap: 6,
  },
  {
    id: 'godhood',
    name: 'Godhood',
    color: '#ffd76a',
    description: 'The heavens themselves bow. You have ascended.',
    stageNames: [''],
    stageMultiplier: 3,
    tribulation: { name: 'Nine-Nine Heavenly Tribulation', trials: 3, passScore: 0.75 },
    coreGradeCap: 7,
  },
];

export const STAGE_LAYOUT: readonly RealmLayout[] = REALM_DEFS.map((r) => ({
  id: r.id,
  stages: r.stageNames.length,
}));

export const REALMS: readonly RealmDef[] = REALM_DEFS.map((r) => ({ ...r, stageCosts: [] }));

export const REALMS_BY_ID: ReadonlyMap<string, RealmDef> = new Map(REALMS.map((r) => [r.id, r]));

export interface StageDef {
  index: number;
  realmIndex: number;
  stageInRealm: number;
  cost: number;
  /** True for the first stage of a realm: the "major" breakthrough. */
  isMajor: boolean;
}

/** Every stage of every realm, flattened in order. Index 0 is Mortal. */
export const STAGES: readonly StageDef[] = REALMS.flatMap((realm, realmIndex) =>
  realm.stageNames.map((_, stageInRealm) => ({
    realmIndex,
    stageInRealm,
    cost: 0,
    isMajor: stageInRealm === 0,
  })),
).map((s, index) => ({ ...s, index }));

export const FINAL_STAGE = STAGES.length - 1;

/** Sets every breakthrough cost from its base cost and progress (call again if either changes). */
export function priceStages(): void {
  const progress = progressMultipliers(STAGE_LAYOUT);
  for (const st of STAGES) {
    (st as { cost: number }).cost = BASE_STAGE_COSTS[st.index] * progress[st.index];
    (REALMS[st.realmIndex].stageCosts as number[])[st.stageInRealm] = st.cost;
  }
}
priceStages();

export function stageName(stage: number): string {
  const s = STAGES[stage];
  const realm = REALMS[s.realmIndex];
  const sub = realm.stageNames[s.stageInRealm];
  return sub ? `${realm.name} · ${sub}` : realm.name;
}

export function firstStageOfRealm(realmId: string): number {
  const realmIndex = REALMS.findIndex((r) => r.id === realmId);
  if (realmIndex < 0) throw new Error(`Unknown realm ${realmId}`);
  return STAGES.findIndex((s) => s.realmIndex === realmIndex);
}
