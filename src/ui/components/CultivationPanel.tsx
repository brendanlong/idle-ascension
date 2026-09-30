import { BUFFS_BY_ID } from '../../content/buffs';
import { CORE_GRADES } from '../../content/cores';
import { generatorName } from '../../content/generators';
import { REALMS, STAGES, stageName, type RealmDef } from '../../content/realms';
import { attemptBreakthrough, breakthroughBlocker, nextStage } from '../../engine/breakthrough';
import { describeEffect } from '../../engine/effects';
import { formatDuration } from '../../engine/format';
import { game } from '../game';

function realmUnlocks(realm: RealmDef): string[] {
  return [
    ...(realm.effects ?? []).map((e) => describeEffect(e)),
    ...(realm.coreGradeCap !== undefined
      ? [`Refine cores up to ${CORE_GRADES[realm.coreGradeCap].name}`]
      : []),
    ...(realm.unlocks ?? []),
  ];
}

function BreakthroughBox() {
  const { state, stats } = game;
  const next = nextStage(state);
  if (!next) {
    return <p class="muted">You stand at the peak of all cultivation.</p>;
  }
  const nextRealm = REALMS[next.realmIndex];
  const blocker = breakthroughBlocker(state);
  const progress = Math.min(1, state.qi / next.cost);
  const tribulation = next.isMajor ? nextRealm.tribulation : undefined;
  const unlocks = next.isMajor ? realmUnlocks(nextRealm) : [];
  const eta = stats.qps > 0 && state.qi < next.cost ? (next.cost - state.qi) / stats.qps : 0;

  return (
    <div class="breakthrough">
      <div class="label">
        Next: <strong style={{ color: nextRealm.color }}>{stageName(next.index)}</strong>
      </div>
      <div class="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
        <div
          class="bar-fill"
          style={{ width: `${progress * 100}%`, background: nextRealm.color }}
        />
        <span class="bar-text">
          {game.fmt(state.qi)} / {game.fmt(next.cost)}
        </span>
      </div>
      {eta > 0 && eta < 86400 * 30 && (
        <div class="muted small">≈ {formatDuration(eta)} at current rate</div>
      )}
      <button
        class={`primary${tribulation ? ' danger' : ''}`}
        disabled={blocker !== null}
        onClick={() => game.act((s, st) => attemptBreakthrough(s, st.mods))}
      >
        {tribulation ? `⚡ Face the ${tribulation.name}` : 'Break Through'}
      </button>
      {blocker && blocker !== 'Not enough qi.' && <div class="blocker">{blocker}</div>}
      {tribulation && (
        <div class="muted small">
          {tribulation.bolts} bolts will fall. Click each before it strikes. You can endure{' '}
          {stats.mods.tribulationAllowedHits}.
        </div>
      )}
      {unlocks.length > 0 && (
        <ul class="unlocks">
          {unlocks.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CultivationPanel() {
  const { state, stats } = game;
  const stage = STAGES[state.stage];
  const realm = REALMS[stage.realmIndex];

  return (
    <section class="panel cultivation">
      <h2 style={{ color: realm.color }}>{realm.name}</h2>
      {realm.stageNames[stage.stageInRealm] && (
        <div class="stage">{realm.stageNames[stage.stageInRealm]}</div>
      )}
      <p class="realm-desc">{realm.description}</p>

      <BreakthroughBox />

      <h3>Cultivation</h3>
      <dl class="stat-list">
        <dt>Realm bonus</dt>
        <dd>×{game.fmt(stats.realmMult)}</dd>
        {state.prestige.memories > 0 && (
          <>
            <dt>Memories</dt>
            <dd>×{game.fmt(stats.memoryMult)}</dd>
          </>
        )}
        {stats.cycleMult > 1 && (
          <>
            <dt>Generating cycle</dt>
            <dd>×{game.fmt(stats.cycleMult)}</dd>
          </>
        )}
        <dt>Per click</dt>
        <dd>{game.fmt(stats.clickPower)}</dd>
        <dt>Per qi mote</dt>
        <dd>{game.fmt(stats.moteValue)}</dd>
        {stats.autoClickQps > 0 && (
          <>
            <dt>Nascent Soul</dt>
            <dd>{game.fmt(stats.autoClickQps)}/s</dd>
          </>
        )}
      </dl>

      {state.buffs.length > 0 && (
        <>
          <h3>Conditions</h3>
          <ul class="buffs">
            {state.buffs.map((b) => {
              const def = BUFFS_BY_ID.get(b.id)!;
              return (
                <li key={b.id} class={def.harmful ? 'harmful' : 'helpful'}>
                  {def.name} <span class="muted">{Math.ceil(b.remaining)}s</span>
                  <div class="buff-effects">
                    {def.effects.map((e) => describeEffect(e, generatorName)).join(', ')}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
