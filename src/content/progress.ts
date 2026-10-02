import { CORE_GRADES, CORE_SLOT_REALMS, GENERATING_CYCLE_BONUS } from './cores';
import { MEMORIES } from './memories';

/**
 * How prices follow progress (see "Breakthrough costs are built in layers" in
 * docs/balance-spec.md): base costs come from resources and techniques alone,
 * and every breakthrough and resource price is multiplied by what the
 * reference player's cores and Memories multiply income by at that stage. So
 * resources feel the same whatever cores and Memories add, and a player who
 * skips either falls steadily behind.
 */

/** The realms in order, with how many stages each has (Mortal's one stage is stage 0). */
export interface RealmLayout {
  id: string;
  stages: number;
}

/** Switch off to price everything as if there were no cores or Memories (for building base costs). */
export const PRICING = { layered: true };

function firstStage(layout: readonly RealmLayout[], realmIndex: number): number {
  return layout.slice(0, realmIndex).reduce((n, r) => n + r.stages, 0);
}

function realmIndex(layout: readonly RealmLayout[], id: string): number {
  return layout.findIndex((r) => r.id === id);
}

/** A point on the stage axis that far (0 to 1) through a realm. */
function inRealm(layout: readonly RealmLayout[], index: number, fraction: number): number {
  const i = Math.min(index, layout.length - 1);
  return firstStage(layout, i) + fraction * layout[i].stages;
}

/**
 * Where on the stage axis each core purchase is scheduled, so the cores spread
 * through the game: each realm's new core forms a third of the way through
 * its realm, and every core gains a grade per realm after that. In a realm,
 * the newest core's refine comes two thirds of the way through, and the older
 * cores' refines are spread over the rest of the realm after the new core.
 */
export function coreSchedule(layout: readonly RealmLayout[]) {
  const slotRealm = (core: number) =>
    realmIndex(layout, CORE_SLOT_REALMS[Math.min(core, CORE_SLOT_REALMS.length - 1)]);
  return {
    form: (core: number) => inRealm(layout, slotRealm(core), 1 / 3),
    refine: (core: number, grade: number) => {
      const realm = slotRealm(core) + grade - 1;
      // Cores already formed by this realm, newest first: the newest refines first.
      const cores = CORE_SLOT_REALMS.filter((id) => realmIndex(layout, id) <= realm).length;
      const newest = Math.min(cores, CORE_SLOT_REALMS.length) - 1;
      const order = core >= newest ? 1 : core + 2;
      return inRealm(layout, realm, 1 / 3 + ((2 / 3) * order) / (cores + 1));
    },
  };
}

/** Memories from regressing at a stage: exponential in how deep you got (see MEMORIES). */
export function memoriesAt(layout: readonly RealmLayout[], stage: number): number {
  const first = firstStage(layout, realmIndex(layout, 'coreFormation'));
  if (stage < first) return 0;
  const last = firstStage(layout, layout.length) - 1;
  return Math.floor(MEMORIES.first * MEMORIES.growthPerStage ** (Math.min(stage, last) - first));
}

/** Linear between the knots (sorted by stage), flat before the first and after the last. */
function slide(knots: readonly { stage: number; log: number }[], k: number): number {
  if (k <= knots[0].stage) return knots[0].log;
  const i = knots.findIndex((p) => p.stage >= k);
  if (i < 0) return knots[knots.length - 1].log;
  const [a, b] = [knots[i - 1], knots[i]];
  if (b.stage === a.stage) return b.log;
  return a.log + ((b.log - a.log) * (k - a.stage)) / (b.stage - a.stage);
}

/** The realm the reference player first regresses in (on entering it), then once per realm. */
const FIRST_REGRESSION_REALM = 'nascentSoul';

/**
 * What the reference player's cores and Memories multiply income by at each
 * stage (1 for every stage when PRICING.layered is off).
 * - Cores: every scheduled core purchase doubles qi gain, plus the small
 *   generating cycle bonus once there are two or more; slid smoothly between
 *   purchases, since players buy them a little before or after schedule.
 * - Memories: it regresses on entering each realm from FIRST_REGRESSION_REALM
 *   on; the bonus slides smoothly between those regressions.
 */
export function progressMultipliers(layout: readonly RealmLayout[]): number[] {
  const stages = firstStage(layout, layout.length);
  if (!PRICING.layered) return Array(stages).fill(1);

  const schedule = coreSchedule(layout);
  const events: number[] = [];
  const formed: number[] = [];
  CORE_SLOT_REALMS.forEach((_, core) => {
    formed.push(schedule.form(core));
    events.push(schedule.form(core));
    for (let grade = 1; grade < CORE_GRADES.length; grade++)
      events.push(schedule.refine(core, grade));
  });
  const coresFrom = firstStage(layout, realmIndex(layout, CORE_SLOT_REALMS[0]));
  // How many of the scheduled purchases are done by stage k, sliding between them.
  const smoothCount = (positions: number[], k: number) =>
    slide(
      [
        { stage: coresFrom, log: 0 },
        ...[...positions].sort((a, b) => a - b).map((p, i) => ({ stage: p, log: i + 1 })),
      ],
      k,
    );
  const coreLog = (k: number) => {
    const cores = smoothCount(formed, k);
    // Cores form in an order that links each new one to the cycle, closing it with the last.
    const pairs = cores >= CORE_SLOT_REALMS.length ? cores : Math.max(0, cores - 1);
    return smoothCount(events, k) * Math.log(2) + Math.log(1 + GENERATING_CYCLE_BONUS * pairs);
  };

  // Memory bonus right after each scheduled regression, as (stage, log of the bonus).
  const knots = [{ stage: firstStage(layout, realmIndex(layout, 'coreFormation')), log: 0 }];
  let memories = 0;
  for (let r = realmIndex(layout, FIRST_REGRESSION_REALM); r < layout.length - 1; r++) {
    const entry = firstStage(layout, r);
    memories += memoriesAt(layout, entry);
    knots.push({ stage: entry, log: MEMORIES.power * Math.log(1 + MEMORIES.weight * memories) });
  }
  const memoryLog = (k: number) => slide(knots, k);

  return Array.from({ length: stages }, (_, k) => Math.exp(coreLog(k) + memoryLog(k)));
}
