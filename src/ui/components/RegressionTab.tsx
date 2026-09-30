import { useState } from 'preact/hooks';
import { PERKS, PERKS_BY_ID, perkCost } from '../../content/perks';
import { describeEffect } from '../../engine/effects';
import {
  availableMemories,
  buyPerk,
  memoriesForStage,
  pendingMemories,
  perkStatus,
  regress,
  regressionBlocker,
} from '../../engine/prestige';
import { game } from '../game';

export function RegressionTab({ onRegressed }: { onRegressed: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { state, stats } = game;
  const pending = pendingMemories(state);
  const blocker = regressionBlocker(state);
  const nextStageMemories = memoriesForStage(state.stage + 1);

  const doRegress = () => {
    setConfirming(false);
    const next = regress(game.state);
    if (!next) return;
    game.replaceState(next);
    onRegressed();
  };

  return (
    <div class="tab-body">
      <p class="flavor">
        The jade pendant at your throat pulses with a strange warmth. When you die, it will send you
        back — to the woodshed, at sixteen, with nothing but your memories.
      </p>
      <dl class="stat-list">
        <dt>Memories</dt>
        <dd>
          {game.fmt(state.prestige.memories)} (×{game.fmt(stats.memoryMult)} all qi)
        </dd>
        <dt>Unspent</dt>
        <dd>{game.fmt(availableMemories(state))}</dd>
        <dt>Loops</dt>
        <dd>{state.prestige.loops}</dd>
        <dt>Regress now for</dt>
        <dd>
          <strong>+{game.fmt(pending)}</strong> Memories
          {nextStageMemories > pending && (
            <span class="muted small"> (next stage: +{game.fmt(nextStageMemories)})</span>
          )}
        </dd>
      </dl>
      <p class="muted small">
        Each Memory permanently grants +{Math.round(stats.mods.memoryBonus * 100)}% qi gain, even
        after you spend it on insights below. Regressing resets your realm, qi, resources,
        techniques, cores and treasures.
      </p>

      {!confirming ? (
        <button
          class="primary danger"
          disabled={blocker !== null}
          onClick={() => setConfirming(true)}
        >
          Court death and return
        </button>
      ) : (
        <div class="confirm">
          <p>Are you sure? Everything but your Memories and insights will be lost.</p>
          <button class="primary danger" onClick={doRegress}>
            Yes, return
          </button>{' '}
          <button onClick={() => setConfirming(false)}>Not yet</button>
        </div>
      )}
      {blocker && <div class="blocker">{blocker}</div>}

      <h3>Insights of a Regressor</h3>
      <ul class="card-list">
        {PERKS.map((p) => {
          const level = state.prestige.perks[p.id] ?? 0;
          const status = perkStatus(state, p.id);
          return (
            <li key={p.id} class={`card perk ${status}`}>
              <div class="card-head">
                <strong>{p.name}</strong>
                <span class="muted">
                  {level}/{p.maxLevel}
                </span>
              </div>
              <p class="flavor">{p.description}</p>
              {p.effects.length > 0 && (
                <p class="effect">
                  Per level: {p.effects.map((e) => describeEffect(e)).join(', ')}
                </p>
              )}
              {status === 'locked' && (
                <p class="blocker">
                  Requires {p.requires!.map((r) => PERKS_BY_ID.get(r)!.name).join(', ')}
                </p>
              )}
              {status !== 'maxed' && status !== 'locked' && (
                <button
                  class="primary"
                  disabled={status !== 'available'}
                  onClick={() => game.act((s) => buyPerk(s, p.id))}
                >
                  Learn ({perkCost(p, level)} Memories)
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
