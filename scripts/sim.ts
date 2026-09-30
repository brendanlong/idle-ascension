/**
 * Headless balance simulation: a greedy bot plays the game and reports how
 * long each milestone takes. Run with `npm run sim -- [clicksPerSecond] [hours] [stallMinutes]`.
 */
import { ELEMENTS, type ElementId } from '../src/content/cores';
import { GENERATORS } from '../src/content/generators';
import { PERKS } from '../src/content/perks';
import { REALMS, STAGES, stageName } from '../src/content/realms';
import { attemptBreakthrough, autoDisperse, nextStage } from '../src/engine/breakthrough';
import {
  canFormCore,
  canRefineCore,
  coreFormCost,
  coreRefineCost,
  formCore,
  refineCore,
} from '../src/engine/cores';
import {
  absorbMotes,
  availableUpgrades,
  buyGenerator,
  buyUpgrade,
  click,
  generatorCost,
  isGeneratorVisible,
} from '../src/engine/economy';
import { claimEncounter } from '../src/engine/encounters';
import { formatDuration, formatNumber } from '../src/engine/format';
import {
  buyPerk,
  pendingMemories,
  perkStatus,
  regress,
  regressionBlocker,
} from '../src/engine/prestige';
import { createInitialState, type GameState } from '../src/engine/state';
import { computeStats } from '../src/engine/stats';
import { tick } from '../src/engine/tick';

const clicksPerSecond = Number(process.argv[2] ?? 3);
const maxHours = Number(process.argv[3] ?? 48);
const MOTE_CATCH_RATE = 0.4;
const STALL_SECONDS = Number(process.argv[4] ?? 45) * 60;
const CORE_ORDER: ElementId[] = ['wood', 'fire', 'water', 'earth', 'metal'];

let seed = 12345;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

let state: GameState = createInitialState(0);
state.flags.introSeen = true;
let time = 0;
let lastProgress = 0;
const reachedRealm = new Set<number>();

function spend(): void {
  let bought = true;
  while (bought) {
    bought = false;
    let stats = computeStats(state);
    const next = nextStage(state);
    if (next && state.qi >= next.cost) {
      const result = attemptBreakthrough(state, stats.mods);
      if (result !== 'blocked') {
        autoDisperse(state);
        for (let i = 0; i < 40 && state.tribulation; i++) {
          tick(state, 0.5, rng);
          autoDisperse(state);
        }
        lastProgress = time;
        bought = true;
        continue;
      }
    }
    for (const u of availableUpgrades(state)) {
      if (u.cost <= state.qi && buyUpgrade(state, u.id)) bought = true;
    }
    stats = computeStats(state);
    for (const element of CORE_ORDER) {
      if (
        canFormCore(state, stats.mods, element) &&
        state.qi >= coreFormCost(stats.mods, state.cores.length)
      ) {
        formCore(state, stats.mods, element);
        bought = true;
      }
    }
    state.cores.forEach((_, i) => {
      if (canRefineCore(state, i) && state.qi >= coreRefineCost(state, stats.mods, i) * 2) {
        refineCore(state, stats.mods, i);
        bought = true;
      }
    });
    // Save up for a breakthrough if it's within a few minutes of income.
    const reserve = next && next.cost < stats.qps * 180 ? next.cost : 0;
    stats = computeStats(state);
    let best: { id: string; ratio: number; cost: number } | null = null;
    GENERATORS.forEach((g, i) => {
      if (!isGeneratorVisible(state, i)) return;
      const cost = generatorCost(state, stats.mods, g.id);
      const ratio = stats.generatorUnitQps[g.id] / cost;
      if (!best || ratio > best.ratio) best = { id: g.id, ratio, cost };
    });
    const b = best as { id: string; cost: number } | null;
    if (b && state.qi - b.cost >= reserve && buyGenerator(state, stats.mods, b.id)) bought = true;
  }
}

function report(label: string): void {
  const stats = computeStats(state);
  console.log(
    `${formatDuration(time).padStart(8)}  loop ${state.prestige.loops}  ${label.padEnd(44)} qi/s ${formatNumber(stats.qps).padStart(9)}  mem ${state.prestige.memories}`,
  );
}

while (time < maxHours * 3600) {
  const stats = computeStats(state);
  for (let i = 0; i < clicksPerSecond; i++) click(state, stats);
  absorbMotes(state, stats, stats.moteSpawnPerSecond * MOTE_CATCH_RATE);
  if (state.encounter.active) claimEncounter(state, stats, rng);
  tick(state, 1, rng);
  time++;
  spend();

  const realmIndex = STAGES[state.stage].realmIndex;
  if (!reachedRealm.has(realmIndex + state.prestige.loops * 100)) {
    reachedRealm.add(realmIndex + state.prestige.loops * 100);
    report(`reached ${stageName(state.stage)}`);
  }
  if (state.flags.ascended) {
    report('ASCENDED');
    break;
  }

  const pending = pendingMemories(state);
  const stalled = time - lastProgress > STALL_SECONDS;
  if (!regressionBlocker(state) && (stalled || pending >= Math.max(3, state.prestige.memories))) {
    report(`regress (+${pending} memories${stalled ? ', stalled' : ''})`);
    state = regress(state, 0)!;
    lastProgress = time;
    let boughtPerk = true;
    while (boughtPerk) {
      boughtPerk = false;
      for (const p of PERKS)
        if (perkStatus(state, p.id) === 'available')
          boughtPerk = buyPerk(state, p.id) || boughtPerk;
    }
  }
}

console.log(
  `\nFinal: ${stageName(state.stage)} after ${formatDuration(time)}, ${state.prestige.loops} regressions`,
);
console.log(`Realms: ${REALMS.length}, stages: ${STAGES.length}, elements: ${ELEMENTS.length}`);
