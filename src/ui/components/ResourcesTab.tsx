import { useState } from 'preact/hooks';
import { GENERATORS } from '../../content/generators';
import {
  buyGenerator,
  generatorCost,
  isGeneratorVisible,
  maxAffordable,
} from '../../engine/economy';
import { game } from '../game';

const BUY_AMOUNTS = [1, 10, 100, 'max'] as const;
type BuyAmount = (typeof BUY_AMOUNTS)[number];

export function ResourcesTab() {
  const [amount, setAmount] = useState<BuyAmount>(1);
  const { state, stats } = game;
  const visible = GENERATORS.filter((_, i) => isGeneratorVisible(state, i));
  const hiddenCount = GENERATORS.length - visible.length;

  return (
    <div class="tab-body">
      <div class="buy-amounts" role="group" aria-label="Buy amount">
        {BUY_AMOUNTS.map((a) => (
          <button key={a} class={amount === a ? 'selected' : ''} onClick={() => setAmount(a)}>
            {a === 'max' ? 'Max' : `×${a}`}
          </button>
        ))}
      </div>
      <ul class="shop-list">
        {visible.map((g) => {
          const owned = state.generators[g.id] ?? 0;
          const count =
            amount === 'max' ? Math.max(1, maxAffordable(state, stats.mods, g.id)) : amount;
          const cost = generatorCost(state, stats.mods, g.id, count);
          const unit = stats.generatorUnitQps[g.id];
          return (
            <li key={g.id}>
              <button
                class="shop-item"
                disabled={state.qi < cost}
                onClick={() => game.act((s, st) => buyGenerator(s, st.mods, g.id, count))}
                title={g.description}
              >
                <span class="shop-icon">{g.icon}</span>
                <span class="shop-main">
                  <span class="shop-name">
                    {g.name} {count > 1 && <span class="muted">×{count}</span>}
                  </span>
                  <span class="shop-desc">
                    {game.fmt(unit)}/s each
                    {owned > 0 && ` · ${game.fmt(unit * owned)}/s total`}
                  </span>
                  <span class="shop-cost">{game.fmt(cost)} qi</span>
                </span>
                <span class="shop-owned">{owned}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <p class="muted small">{hiddenCount} more cultivation resources remain undiscovered…</p>
      )}
    </div>
  );
}
