import { CORE_GRADES, CORE_SLOT_REALMS, GENERATING_CYCLE_BONUS } from './cores';
import { MEMORIES } from './memories';

/**
 * How prices follow progress (see "Breakthrough costs are built in layers" in
 * docs/balance-spec.md): base costs come from resources and techniques alone,
 * and every breakthrough and resource price is multiplied by what the
 * reference player's cores and Memories multiply income by at that stage. So
 * resources feel the same whatever cores and Memories add, and a player who
 * skips either falls steadily behind. Both are equations; the core schedule
 * follows from its equation.
 */

/** The realms in order, with how many stages each has (Mortal's one stage is stage 0). */
export interface RealmLayout {
  id: string;
  stages: number;
  coreGradeCap?: number;
}

/**
 * How long each stage should take the reference player: `first` seconds up
 * to stage `flatUntil`, then rising linearly to `last` at the final stage.
 * Everything else is priced to keep to it (see docs/balance-spec.md).
 */
export const STAGE_TIME = { first: 15, last: 600, flatUntil: 3 };

/** STAGE_TIME's target for stage k, in seconds. */
export function stageSeconds(layout: readonly RealmLayout[], k: number): number {
  const { first, last, flatUntil } = STAGE_TIME;
  const final = firstStage(layout, layout.length) - 1;
  if (k <= flatUntil) return first;
  return first + ((last - first) * (Math.min(k, final) - flatUntil)) / (final - flatUntil);
}

/** Switch off to price everything as if there were no cores or Memories (for building base costs). */
export const PRICING = { layered: true };

/**
 * The core equation: from stage `from` (a third of the way into Core
 * Formation), the core bonus doubles `perStage` times per stage, since every
 * core purchase doubles qi gain.
 */
export const CORE_CURVE = { from: 15 + 1 / 3, perStage: 0.85 };

/**
 * The regression equation: from the start of `firstRealm`, prices grow
 * `perStage` times per stage on top of everything else. MEMORIES is fit to it
 * (see fitMemories), not the other way round.
 */
export const REGRESSION_CURVE = { firstRealm: 'nascentSoul', perStage: 1.5, lag: 2 };

function firstStage(layout: readonly RealmLayout[], realmIndex: number): number {
  return layout.slice(0, realmIndex).reduce((n, r) => n + r.stages, 0);
}

function realmIndex(layout: readonly RealmLayout[], id: string): number {
  return layout.findIndex((r) => r.id === id);
}

/** The realm a point on the stage axis falls in. */
function realmAt(layout: readonly RealmLayout[], position: number): number {
  let end = 0;
  for (let r = 0; r < layout.length; r++) {
    end += layout[r].stages;
    if (position < end) return r;
  }
  return layout.length - 1;
}

export interface CoreEvent {
  position: number;
  core: number;
  /** The grade it's formed at (0) or refined to. */
  grade: number;
}

/**
 * Every core purchase, evenly spaced by CORE_CURVE: each forms a new core if
 * a slot is open, else refines the lowest-grade core below its realm's cap.
 * One that can't happen yet waits for the next realm.
 */
export function coreSchedule(layout: readonly RealmLayout[]): CoreEvent[] {
  const grades: number[] = [];
  const events: CoreEvent[] = [];
  const total = CORE_SLOT_REALMS.length * CORE_GRADES.length;
  let earliest = 0;
  for (let i = 0; events.length < total; i++) {
    let position = Math.max(earliest, CORE_CURVE.from + i / CORE_CURVE.perStage);
    for (;;) {
      const realm = realmAt(layout, position);
      const slots = CORE_SLOT_REALMS.filter((id) => realmIndex(layout, id) <= realm).length;
      const cap = Math.min(layout[realm].coreGradeCap ?? 0, CORE_GRADES.length - 1);
      if (grades.length < slots) {
        events.push({ position, core: grades.length, grade: 0 });
        grades.push(0);
        break;
      }
      const lowest = grades.reduce((best, g, c) => (g < grades[best] ? c : best), 0);
      if (grades.length && grades[lowest] < cap) {
        grades[lowest]++;
        events.push({ position, core: lowest, grade: grades[lowest] });
        break;
      }
      // Nothing can happen in this realm any more: wait for the next one.
      position = realm === layout.length - 1 ? position + 1 : firstStage(layout, realm + 1);
    }
    earliest = position;
  }
  return events;
}

/** Memories from regressing at a stage: exponential in how deep you got (see MEMORIES). */
export function memoriesAt(layout: readonly RealmLayout[], stage: number): number {
  const first = firstStage(layout, realmIndex(layout, 'coreFormation'));
  if (stage < first) return 0;
  const last = firstStage(layout, layout.length) - 1;
  return Math.floor(MEMORIES.first * MEMORIES.growthPerStage ** (Math.min(stage, last) - first));
}

/**
 * Sets the Memory bonus's power and weight so that regressing from stage r
 * multiplies qi gain by about REGRESSION_CURVE at r + lag: a player who
 * regresses about once per realm keeps up with prices, and one who never
 * does falls further behind every stage.
 */
export function fitMemories(layout: readonly RealmLayout[]): void {
  const { firstRealm, perStage, lag } = REGRESSION_CURVE;
  const growth = MEMORIES.growthPerStage;
  const first = firstStage(layout, realmIndex(layout, 'coreFormation'));
  const from = firstStage(layout, realmIndex(layout, firstRealm));
  MEMORIES.power = Math.log(perStage) / Math.log(growth);
  MEMORIES.weight = growth ** (first + lag - from) / MEMORIES.first;
}

/**
 * How many of the purchases at these positions are done by stage k, sliding
 * from one to the next (and into the first over the gap before it).
 */
function smoothCount(positions: readonly number[], gap: number, k: number): number {
  const i = positions.findIndex((p) => p > k);
  if (i < 0) return positions.length;
  const previous = i === 0 ? positions[0] - gap : positions[i - 1];
  return Math.max(0, i + (k - previous) / (positions[i] - previous));
}

/**
 * What the reference player's cores and Memories multiply income by at each
 * stage (1 for every stage when PRICING.layered is off).
 */
export function progressMultipliers(layout: readonly RealmLayout[]): number[] {
  const stages = firstStage(layout, layout.length);
  if (!PRICING.layered) return Array(stages).fill(1);

  const events = coreSchedule(layout);
  const gap = 1 / CORE_CURVE.perStage;
  const purchases = events.map((e) => e.position);
  const forms = events.filter((e) => e.grade === 0).map((e) => e.position);
  const coreLog = (k: number) => {
    const cores = smoothCount(forms, gap, k);
    // Cores form in an order that links each new one to the cycle, closing it with the last.
    const pairs = cores >= CORE_SLOT_REALMS.length ? cores : Math.max(0, cores - 1);
    return (
      smoothCount(purchases, gap, k) * Math.log(2) + Math.log(1 + GENERATING_CYCLE_BONUS * pairs)
    );
  };

  const from = firstStage(layout, realmIndex(layout, REGRESSION_CURVE.firstRealm));
  const memoryLog = (k: number) => Math.log(REGRESSION_CURVE.perStage) * Math.max(0, k - from);

  return Array.from({ length: stages }, (_, k) => Math.exp(coreLog(k) + memoryLog(k)));
}
