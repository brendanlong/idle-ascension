/**
 * The economy, built up one layer at a time without a bot (see "Breakthrough
 * costs are built in layers" in docs/balance-spec.md). A model player keeps
 * to the stage schedule (STAGE_TIME): over each stage's target time it puts
 * BREAKTHROUGH_SHARE of its income towards the breakthrough and spends the
 * rest on whichever resource pays for itself soonest (counting the wait to
 * afford it), plus a constant gathering trickle to get started. Each
 * breakthrough costs what was put towards it, so costs follow from the
 * layers by construction.
 *
 * Layers so far: resources (at base prices) and breakthroughs.
 *
 * It reports, per stage: the cost, income
 * growth, what got bought (by how many tiers older than the newest), and the
 * longest wait between purchases; and when each resource arrived.
 *
 * Usage: [MODEL_LADDER='{...}'] [MODEL_WRITE=1] npx tsx scripts/balance/model.ts
 * MODEL_LADDER tries changes to RESOURCE_LADDER; MODEL_WRITE=1 writes the
 * costs into BASE_STAGE_COSTS in src/content/realms.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GENERATORS, RESOURCE_LADDER, priceResources } from '../../src/content/generators';
import { PRICING, stageSeconds } from '../../src/content/progress';
import { BREAKTHROUGH_SHARE, STAGE_LAYOUT, STAGES as STAGE_DEFS } from '../../src/content/realms';
import { generatorCost } from '../../src/engine/economy';
import { activeQps, computeModifiers, computeStats } from '../../src/engine/stats';
import { createInitialState } from '../../src/engine/state';

const STAGES = STAGE_DEFS.length;

PRICING.layered = false;
Object.assign(RESOURCE_LADDER, JSON.parse(process.env.MODEL_LADDER ?? '{}'));
priceResources();

const target = (k: number) => stageSeconds(STAGE_LAYOUT, k);
/** When each stage is meant to be reached. */
const schedule = [0];
for (let k = 1; k < STAGES; k++) schedule.push(schedule[k - 1] + target(k));

const state = createInitialState(0);
const mods = computeModifiers(state, false);
const gathering = activeQps(computeStats(state, false));
const ids = GENERATORS.map((g) => g.id);
const tierOf = new Map(ids.map((id, i) => [id, i + 1]));

const income = () => computeStats(state, false).qps + gathering;
const unitQps = (id: string) => computeStats(state, false).generatorUnitQps[id];

interface Purchase {
  t: number;
  /** Tiers below the newest owned (0 = the newest). */
  age: number;
}
const purchases: Purchase[] = [];
const arrivals: { id: string; t: number; payback: number; bestOlder: number }[] = [];
const incomeAtStage: number[] = [income()];
const costs: number[] = [0];
let saved = 0;
let newest = 0;

for (let t = 0; costs.length < STAGES; t++) {
  while (costs.length < STAGES && t >= schedule[costs.length]) {
    costs.push(saved);
    saved = 0;
    incomeAtStage.push(income());
  }
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
    purchases.push({ t, age: newest - tier });
  }
  const earned = income();
  saved += BREAKTHROUGH_SHARE * earned;
  state.qi += (1 - BREAKTHROUGH_SHARE) * earned;
}

const stageAt = (t: number) => schedule.findIndex((s) => s > t) - 1;
const fmt = (x: number) => (x < 1000 ? x.toPrecision(3) : x.toExponential(2));
const secs = (x: number) => (x < 90 ? `${Math.round(x)}s` : `${(x / 60).toFixed(1)}m`);

console.log(
  `Ladder: ${JSON.stringify(RESOURCE_LADDER)}; gathering ${fmt(gathering)} qi/s; ` +
    `breakthroughs take ${BREAKTHROUGH_SHARE} of income\n`,
);
console.log(
  'stage  target      cost   income  ×/stage  bought: newest  -1  -2 older  longest wait',
);
for (let k = 1; k < STAGES; k++) {
  const inStage = purchases.filter((p) => stageAt(p.t) === k - 1);
  const byAge = [0, 1, 2].map((a) => inStage.filter((p) => p.age === a).length);
  const older = inStage.filter((p) => p.age > 2).length;
  const times = [schedule[k - 1], ...inStage.map((p) => p.t), schedule[k]];
  const wait = Math.max(...times.slice(1).map((x, i) => x - times[i]));
  console.log(
    `${String(k).padStart(5)}  ${secs(target(k)).padStart(6)}  ${fmt(costs[k]).padStart(8)}` +
      `  ${fmt(incomeAtStage[k]).padStart(8)}` +
      `  ${(incomeAtStage[k] / incomeAtStage[k - 1]).toFixed(2).padStart(7)}` +
      `  ${byAge.map((n, i) => String(n).padStart(i ? 3 : 14)).join('')}${String(older).padStart(6)}` +
      `  ${secs(wait).padStart(6)} (${(wait / target(k)).toFixed(2)} of the stage)`,
  );
}

console.log(
  `\nNew resources: when first bought (due at stage ${RESOURCE_LADDER.stagesPerTier} × tier)`,
);
for (const a of arrivals) {
  const tier = tierOf.get(a.id)!;
  console.log(
    `  ${a.id.padEnd(12)} tier ${String(tier).padStart(2)}  stage ${String(stageAt(a.t)).padStart(2)}` +
      ` (due ${RESOURCE_LADDER.stagesPerTier * tier})  pays for itself in ${secs(a.payback)}` +
      (Number.isFinite(a.bestOlder) ? `, best older ${secs(a.bestOlder)}` : ''),
  );
}
if (process.env.MODEL_WRITE) {
  const path = new URL('../../src/content/realms.ts', import.meta.url);
  const source = readFileSync(path, 'utf8');
  const written = source.replace(
    /(BASE_STAGE_COSTS: number\[\] = \[)[^\]]*(\])/,
    `$1${costs.map((c) => Number(c.toPrecision(3))).join(', ')}$2`,
  );
  if (written === source) throw new Error('BASE_STAGE_COSTS not found');
  writeFileSync(path, written);
  console.log('\nWritten to BASE_STAGE_COSTS in src/content/realms.ts');
}
