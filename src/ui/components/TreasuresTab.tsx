import { generatorName } from '../../content/generators';
import { TREASURES } from '../../content/treasures';
import { describeEffect } from '../../engine/effects';
import { game } from '../game';

export function TreasuresTab() {
  const { state } = game;
  const found = TREASURES.filter((t) => state.treasures[t.id]);

  return (
    <div class="tab-body">
      <p class="muted small">
        Treasures are found through fortuitous encounters — watch the qi field for mysterious
        strangers, hidden caves, and old beggars. Found {found.length} / {TREASURES.length}.
      </p>
      <ul class="card-list">
        {TREASURES.map((t) =>
          state.treasures[t.id] ? (
            <li key={t.id} class="card treasure">
              <div class="card-head">
                <strong>
                  {t.icon} {t.name}
                </strong>
              </div>
              <p class="flavor">{t.description}</p>
              <p class="effect">
                {t.effects.map((e) => describeEffect(e, generatorName)).join(', ')}
              </p>
            </li>
          ) : (
            <li key={t.id} class="card treasure unknown">
              <strong>??? </strong>
              <span class="muted small">An undiscovered treasure</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
