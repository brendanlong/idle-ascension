/**
 * The bottom layer on its own: resources at their base prices, with no
 * techniques, cores, Memories, treasures or breakthroughs, and a constant
 * gathering trickle to get started. A buyer takes whichever resource pays for
 * itself soonest, counting the wait to afford it. Against the spec's stage
 * schedule (the ramp), it reports how income grows each stage, when each tier
 * arrives, what gets bought, and the longest wait between purchases.
 *
 * Usage: npx tsx scripts/balance/resources_only.ts
 */
import { readFileSync } from 'node:fs';
import { GENERATORS, RESOURCE_LADDER, priceResources } from '../../src/content/generators';
import { PRICING } from '../../src/content/progress';
import { generatorCost } from '../../src/engine/economy';
import { activeQps, computeModifiers, computeStats } from '../../src/engine/stats';
import { createInitialState } from '../../src/engine/state';

const SPEC = JSON.parse(readFileSync(new URL('./spec.json', import.meta.url), 'utf8'));
const STAGES = 35;

PRICING.layered = false;
priceResources();
/** RO_PAYBACK=q RO_RATIO=r: try a ladder where tier n costs r^n x the start and pays for itself in q x its stage's target time. */
if (process.env.RO_PAYBACK) {
  const q = Number(process.env.RO_PAYBACK);
  const r = Number(process.env.RO_RATIO ?? RESOURCE_LADDER.costRatio);
  GENERATORS.forEach((g, i) => {
    const tier = i + 1;
    (g as { baseCost: number }).baseCost = RESOURCE_LADDER.start.cost * r ** tier;
    (g as { baseQps: number }).baseQps =
      g.baseCost / (q * ramp(Math.min(RESOURCE_LADDER.stagesPerTier * tier, STAGES - 1)));
  });
}

function ramp(k: number): number {
  const { first, last, flatUntil } = SPEC.ramp;
  if (k <= flatUntil) return first;
  return first + ((last - first) * (k - flatUntil)) / (STAGES - 1 - flatUntil);
}
/** When each stage is meant to be reached. */
const schedule = [0];
for (let k = 1; k < STAGES; k++) schedule.push(schedule[k - 1] + ramp(k));

const state = createInitialState(0);
const mods = computeModifiers(state, false);
const gathering = activeQps(computeStats(state, false));
const ids = GENERATORS.map((g) => g.id);
const tierOf = new Map(ids.map((id, i) => [id, i + 1]));

const income = () => computeStats(state, false).qps + gathering;
const unitQps = (id: string) => computeStats(state, false).generatorUnitQps[id];

interface Purchase {
  t: number;
  id: string;
  /** Tiers below the newest owned (0 = the newest). */
  age: number;
}
const purchases: Purchase[] = [];
const arrivals: { id: string; t: number; payback: number; bestOlder: number }[] = [];
const incomeAtStage: number[] = [];
let newest = 0;

for (let t = 0; t <= schedule[STAGES - 1]; t++) {
  while (incomeAtStage.length < STAGES && schedule[incomeAtStage.length] <= t)
    incomeAtStage.push(income());
  for (;;) {
    const now = income();
    const options = ids.map((id) => {
      const cost = generatorCost(state, mods, id);
      const payback = cost / unitQps(id);
      return { id, cost, payback, score: Math.max(0, cost - state.qi) / now + payback };
    });
    const best = options.reduce((a, b) => (b.score < a.score ? b : a));
    if (best.cost > state.qi) break;
    const tier = tierOf.get(best.id)!;
    if (tier > newest) {
      const older = options.filter((o) => tierOf.get(o.id)! < tier && state.generators[o.id]);
      arrivals.push({
        id: best.id,
        t,
        payback: best.payback,
        bestOlder: Math.min(...older.map((o) => o.payback)),
      });
      newest = tier;
    }
    state.qi -= best.cost;
    state.generators[best.id] = (state.generators[best.id] ?? 0) + 1;
    purchases.push({ t, id: best.id, age: newest - tier });
  }
  state.qi += income();
}

const stageAt = (t: number) => schedule.findIndex((s) => s > t) - 1;
const fmt = (x: number) => (x < 1000 ? x.toPrecision(3) : x.toExponential(2));
const secs = (x: number) => (x < 90 ? `${Math.round(x)}s` : `${(x / 60).toFixed(1)}m`);

console.log(
  `Ladder: ${JSON.stringify(RESOURCE_LADDER)}; gathering ${fmt(gathering)} qi/s throughout\n`,
);
console.log(
  'stage  target   income   ×/stage  bought: newest  -1   -2  older   longest wait (share of stage)',
);
for (let k = 1; k < STAGES; k++) {
  const inStage = purchases.filter((p) => stageAt(p.t) === k - 1);
  const byAge = [0, 1, 2].map((a) => inStage.filter((p) => p.age === a).length);
  const older = inStage.filter((p) => p.age > 2).length;
  const times = [schedule[k - 1], ...inStage.map((p) => p.t), schedule[k]];
  const wait = Math.max(...times.slice(1).map((x, i) => x - times[i]));
  console.log(
    `${String(k).padStart(5)}  ${secs(ramp(k)).padStart(6)}  ${fmt(incomeAtStage[k]).padStart(8)}` +
      `  ${(incomeAtStage[k] / incomeAtStage[k - 1]).toFixed(2).padStart(7)}` +
      `  ${byAge.map((n, i) => String(n).padStart(i ? 4 : 14)).join('')}` +
      `${String(older).padStart(7)}   ${secs(wait).padStart(6)} (${(wait / ramp(k)).toFixed(2)})`,
  );
}

console.log(
  '\nNew resources: when first bought (target: stage',
  RESOURCE_LADDER.stagesPerTier,
  '× tier)',
);
for (const a of arrivals) {
  const tier = tierOf.get(a.id)!;
  console.log(
    `  ${a.id.padEnd(12)} tier ${String(tier).padStart(2)}  stage ${stageAt(a.t).toString().padStart(2)}` +
      ` (target ${RESOURCE_LADDER.stagesPerTier * tier})  payback ${secs(a.payback)}` +
      (Number.isFinite(a.bestOlder) ? ` vs best older ${secs(a.bestOlder)}` : ''),
  );
}
