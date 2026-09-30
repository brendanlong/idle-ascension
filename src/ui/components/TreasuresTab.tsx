import { REALMS_BY_ID } from '../../content/realms';
import { MAX_TREASURE_LEVEL, RARITIES, TREASURES } from '../../content/treasures';
import { describeEffects } from '../../engine/effects';
import { treasureEffects } from '../../engine/stats';
import { game } from '../game';

export function TreasuresTab() {
  const { state } = game;
  const found = TREASURES.filter((t) => state.treasures[t.id]);

  return (
    <div class="tab-body">
      <p class="muted small">
        Treasures are found through fortuitous encounters: watch the qi field for mysterious
        strangers, hidden caves, and old beggars. Finding one you already own refines it, up to
        level {MAX_TREASURE_LEVEL}. Found {found.length} / {TREASURES.length}.
      </p>
      <ul class="card-list">
        {TREASURES.map((t) => {
          const rarity = RARITIES[t.rarity];
          const level = state.treasures[t.id] ?? 0;
          if (level === 0) {
            return (
              <li key={t.id} class="card treasure unknown" style={{ '--rarity': rarity.color }}>
                <div class="card-head">
                  <strong>???</strong>
                  <span class="rarity">{rarity.name}</span>
                </div>
                <span class="muted small">
                  Found from {REALMS_BY_ID.get(t.minRealm)?.name ?? t.minRealm} onward
                </span>
              </li>
            );
          }
          return (
            <li key={t.id} class="card treasure" style={{ '--rarity': rarity.color }}>
              <div class="card-head">
                <strong>
                  {t.icon} {t.name}
                </strong>
                <span class="rarity">
                  {rarity.name} · Lv {level}
                  {level === MAX_TREASURE_LEVEL && ' (max)'}
                </span>
              </div>
              <p class="flavor">{t.description}</p>
              <p class="effect">{describeEffects(treasureEffects(t, level))}</p>
              {level < MAX_TREASURE_LEVEL && (
                <p class="muted small">
                  Next level: {describeEffects(treasureEffects(t, level + 1))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
