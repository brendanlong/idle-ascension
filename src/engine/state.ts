import type { ElementId } from '../content/cores';
import { GENERATORS } from '../content/generators';

export const SAVE_VERSION = 3;

export interface CoreState {
  element: ElementId;
  grade: number;
}

export interface ActiveBuff {
  id: string;
  remaining: number;
}

export interface ActiveEncounter {
  id: string;
  /** Position within the qi field, 0-1. */
  x: number;
  y: number;
  remaining: number;
}

export interface Bolt {
  id: number;
  x: number;
  y: number;
  remaining: number;
  duration: number;
}

export interface TribulationState {
  targetStage: number;
  boltsToSpawn: number;
  totalBolts: number;
  spawnTimer: number;
  interval: number;
  bolts: Bolt[];
  hits: number;
  allowedHits: number;
  nextBoltId: number;
}

export type NumberFormat = 'short' | 'myriad' | 'scientific';

export interface GameState {
  saveVersion: number;
  qi: number;
  qiEarnedThisLoop: number;
  qiEarnedTotal: number;
  stage: number;
  generators: Record<string, number>;
  upgrades: Record<string, true>;
  cores: CoreState[];
  /** Treasure id → level (1 when first found). */
  treasures: Record<string, number>;
  buffs: ActiveBuff[];
  encounter: { nextIn: number; active: ActiveEncounter | null };
  tribulation: TribulationState | null;
  prestige: {
    /** Total Memories ever earned. Spent Memories still count toward the qi bonus. */
    memories: number;
    perks: Record<string, number>;
    loops: number;
  };
  stats: {
    totalClicks: number;
    loopClicks: number;
    motesAbsorbed: number;
    playTime: number;
    loopTime: number;
    encountersClaimed: number;
    tribulationsSurvived: number;
    tribulationsFailed: number;
    bestStage: number;
  };
  flags: {
    introSeen: boolean;
    ascended: boolean;
    victorySeen: boolean;
  };
  settings: {
    numberFormat: NumberFormat;
  };
  /** Wall-clock ms of the last tick, used for offline progress. */
  lastTick: number;
}

export function emptyGenerators(): Record<string, number> {
  return Object.fromEntries(GENERATORS.map((g) => [g.id, 0]));
}

export function createInitialState(now = Date.now()): GameState {
  return {
    saveVersion: SAVE_VERSION,
    qi: 0,
    qiEarnedThisLoop: 0,
    qiEarnedTotal: 0,
    stage: 0,
    generators: emptyGenerators(),
    upgrades: {},
    cores: [],
    treasures: {},
    buffs: [],
    encounter: { nextIn: 45, active: null },
    tribulation: null,
    prestige: { memories: 0, perks: {}, loops: 0 },
    stats: {
      totalClicks: 0,
      loopClicks: 0,
      motesAbsorbed: 0,
      playTime: 0,
      loopTime: 0,
      encountersClaimed: 0,
      tribulationsSurvived: 0,
      tribulationsFailed: 0,
      bestStage: 0,
    },
    flags: { introSeen: false, ascended: false, victorySeen: false },
    settings: { numberFormat: 'short' },
    lastTick: now,
  };
}
