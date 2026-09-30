import { generatorName } from '../../content/generators';
import { UPGRADES } from '../../content/upgrades';
import { describeEffect } from '../../engine/effects';
import { availableUpgrades, buyUpgrade } from '../../engine/economy';
import { game } from '../game';

export function TechniquesTab() {
  const { state } = game;
  const available = availableUpgrades(state);
  const mastered = UPGRADES.filter((u) => state.upgrades[u.id]);

  return (
    <div class="tab-body">
      {available.length === 0 && (
        <p class="muted">No techniques available yet. Keep cultivating.</p>
      )}
      <ul class="card-list">
        {available.map((u) => (
          <li key={u.id} class="card">
            <div class="card-head">
              <strong>{u.name}</strong>
              <span class="cost">{game.fmt(u.cost)} qi</span>
            </div>
            <p class="flavor">{u.description}</p>
            <p class="effect">
              {u.effects.map((e) => describeEffect(e, generatorName)).join(', ')}
            </p>
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
                <span class="muted">
                  {u.effects.map((e) => describeEffect(e, generatorName)).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
