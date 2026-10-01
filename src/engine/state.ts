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

export interface TrialOffer {
  element: ElementId;
  x: number;
  y: number;
  remaining: number;
}

export interface TribulationState {
  targetStage: number;
  /** Elements of the trials to face, in order. */
  trials: ElementId[];
  /** Scores (0-1) of the trials finished so far. */
  scores: number[];
  passScore: number;
  /** Trial game speed (below 1 is slower). */
  speed: number;
  /** True while the current trial is being played, so a reload mid-trial can't retry it. */
  started: boolean;
}

export type NumberFormat = 'short' | 'myriad' | 'scientific';

/**
 * Accessibility help for the real-time trials: `easier` slows them and
 * lowers pass marks; `skip` resolves them without playing.
 */
export type TrialAssist = 'off' | 'easier' | 'skip';

export interface GameState {
  saveVersion: number;
  qi: number;
  qiEarnedThisLoop: number;
  qiEarnedTotal: number;
  stage: number;
  generators: Record<string, number>;
  upgrades: Record<string, true>;
  /** Resource id → the multiplier its revival technique was sized to when learned. */
  revivals: Record<string, number>;
  cores: CoreState[];
  /** Treasure id → level (1 when first found). */
  treasures: Record<string, number>;
  buffs: ActiveBuff[];
  encounter: { nextIn: number; active: ActiveEncounter | null };
  /** `active` is an optional trial being played right now. */
  trial: { nextIn: number; offer: TrialOffer | null; active: ElementId | null };
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
    trialsCompleted: number;
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
    trialAssist: TrialAssist;
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
    revivals: {},
    cores: [],
    treasures: {},
    buffs: [],
    encounter: { nextIn: 45, active: null },
    trial: { nextIn: 90, offer: null, active: null },
    tribulation: null,
    prestige: { memories: 0, perks: {}, loops: 0 },
    stats: {
      totalClicks: 0,
      loopClicks: 0,
      motesAbsorbed: 0,
      playTime: 0,
      loopTime: 0,
      encountersClaimed: 0,
      trialsCompleted: 0,
      tribulationsSurvived: 0,
      tribulationsFailed: 0,
      bestStage: 0,
    },
    flags: { introSeen: false, ascended: false, victorySeen: false },
    settings: { numberFormat: 'short', trialAssist: 'off' },
    lastTick: now,
  };
}
