import { useState } from 'preact/hooks';
import { REGRESSION_STORY } from '../../content/lore';
import { PERKS, perkCost } from '../../content/perks';
import { describeEffects } from '../../engine/effects';
import { perkEffects } from '../../engine/stats';
import {
  availableMemories,
  buyPerk,
  describeSpecialPerk,
  memoriesForStage,
  pendingMemories,
  perkStatus,
  regress,
  regressionBlocker,
} from '../../engine/prestige';
import { composeStory } from '../../engine/text';
import { game } from '../game';

export function RegressionTab({ onRegressed }: { onRegressed: (story: string[]) => void }) {
  const [confirming, setConfirming] = useState(false);
  const { state, stats } = game;
  const pending = pendingMemories(state);
  const blocker = regressionBlocker(state);
  const nextStageMemories = memoriesForStage(state.stage + 1);
  // Insights that build on ones not yet learned stay hidden until they can be learned.
  const shown = PERKS.filter(
    (p) => perkStatus(state, p.id) !== 'locked' || (state.prestige.perks[p.id] ?? 0) > 0,
  );
  const hidden = PERKS.length - shown.length;

  const doRegress = () => {
    setConfirming(false);
    const gained = pendingMemories(game.state);
    const next = regress(game.state);
    if (!next) return;
    game.replaceState(next);
    onRegressed([
      ...composeStory(REGRESSION_STORY, Math.random),
      `You carry ${game.fmt(gained)} new Memories back with you.`,
    ]);
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
        techniques, cores and treasures (except what Soul-Bound Treasures keeps).
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
        {shown.map((p) => {
          const level = state.prestige.perks[p.id] ?? 0;
          const status = perkStatus(state, p.id);
          return (
            <li key={p.id} class={`card perk ${status}`}>
              <div class="card-head">
                <strong>{p.name}</strong>
                <span class="muted">
                  {Number.isFinite(p.maxLevel) ? `${level}/${p.maxLevel}` : `Level ${level}`}
                </span>
              </div>
              <p class="flavor">{p.description}</p>
              {p.effects.length > 0 && level > 0 && (
                <p class="effect">Now: {describeEffects(perkEffects(p, level))}</p>
              )}
              {p.effects.length > 0 && status !== 'maxed' && (
                <p class="muted small">
                  {level > 0 ? 'Next level' : 'First level'}:{' '}
                  {describeEffects(perkEffects(p, level + 1))}
                </p>
              )}
              {p.special && level > 0 && <p class="effect">Now: {describeSpecialPerk(p, level)}</p>}
              {p.special && status !== 'maxed' && (
                <p class="muted small">
                  {level > 0 ? 'Next level' : 'First level'}: {describeSpecialPerk(p, level + 1)}
                </p>
              )}
              {status !== 'maxed' && (
                <button
                  class="primary"
                  disabled={status !== 'available'}
                  onClick={() => game.act((s) => buyPerk(s, p.id))}
                >
                  Learn ({game.fmt(perkCost(p, level))} Memories)
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <p class="muted small">
          {hidden === 1
            ? '1 more insight will reveal itself as your understanding deepens…'
            : `${hidden} more insights will reveal themselves as your understanding deepens…`}
        </p>
      )}
    </div>
  );
}
