import { REALMS_BY_ID, firstStageOfRealm } from '../../content/realms';
import { MAX_TREASURE_LEVEL, RARITIES, TREASURES } from '../../content/treasures';
import { describeEffects } from '../../engine/effects';
import { treasureEffects } from '../../engine/stats';
import { game } from '../game';

export function TreasuresTab() {
  const { state } = game;
  const found = TREASURES.filter((t) => state.treasures[t.id]);
  // Only tease treasures you could find now; owned ones always show.
  const shown = TREASURES.filter(
    (t) => state.treasures[t.id] || state.stage >= firstStageOfRealm(t.minRealm),
  );
  const moreLater = shown.length < TREASURES.length;

  return (
    <div class="tab-body">
      <p class="muted small">
        Treasures are found through fortuitous encounters: watch the qi field for mysterious
        strangers, hidden caves, and old beggars. Finding one you already own refines it, up to
        level {MAX_TREASURE_LEVEL}. Found {found.length}.
      </p>
      <ul class="card-list">
        {shown.map((t) => {
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
                  Can be found in {REALMS_BY_ID.get(t.minRealm)?.name ?? t.minRealm} and beyond
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
      {moreLater && <p class="muted small">More treasures may await in higher realms…</p>}
    </div>
  );
}
