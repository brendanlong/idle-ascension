import { UPGRADES } from '../../content/upgrades';
import { describeEffects } from '../../engine/effects';
import {
  affordableUpgrades,
  availableUpgrades,
  buyAllUpgrades,
  buyUpgrade,
} from '../../engine/economy';
import { upgradeEffects } from '../../engine/stats';
import { game } from '../game';

export function TechniquesTab() {
  const { state } = game;
  const available = availableUpgrades(state);
  const affordable = affordableUpgrades(state);
  const affordableCost = affordable.reduce((sum, u) => sum + u.cost, 0);
  const mastered = UPGRADES.filter((u) => state.upgrades[u.id]);

  return (
    <div class="tab-body">
      {available.length === 0 ? (
        <p class="muted">No techniques available yet. Keep cultivating.</p>
      ) : (
        <button
          class="primary buy-all"
          disabled={affordable.length === 0}
          onClick={() => game.act((s) => buyAllUpgrades(s))}
        >
          Buy all
          {affordable.length > 0 && ` (${affordable.length} for ${game.fmt(affordableCost)} qi)`}
        </button>
      )}
      <ul class="card-list">
        {available.map((u) => (
          <li key={u.id} class="card">
            <div class="card-head">
              <strong>{u.name}</strong>
              <span class="cost">{game.fmt(u.cost)} qi</span>
            </div>
            <p class="flavor">{u.description}</p>
            <p class="effect">{describeEffects(upgradeEffects(state, u))}</p>
            <button
              class="primary"
              disabled={state.qi < u.cost}
              onClick={() => game.act((s) => buyUpgrade(s, u.id))}
            >
              Master
            </button>
          </li>
        ))}
      </ul>
      {mastered.length > 0 && (
        <details class="mastered">
          <summary>Mastered techniques ({mastered.length})</summary>
          <ul>
            {mastered.map((u) => (
              <li key={u.id}>
                <strong>{u.name}</strong>{' '}
                <span class="muted">{describeEffects(upgradeEffects(state, u))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
