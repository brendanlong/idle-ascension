import { BUFFS_BY_ID } from '../../content/buffs';
import { CORE_GRADES } from '../../content/cores';
import { REALMS, STAGES, stageName, type RealmDef } from '../../content/realms';
import {
  attemptBreakthrough,
  breakthroughBlocker,
  isFamiliarStage,
  nextStage,
  tribulationPassScore,
} from '../../engine/breakthrough';
import { describeEffect, describeEffects } from '../../engine/effects';
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

export function BreakthroughBox() {
  const { state, stats } = game;
  const next = nextStage(state);
  if (!next) {
    return <p class="muted">You stand at the peak of all cultivation.</p>;
  }
  const nextRealm = REALMS[next.realmIndex];
  const blocker = breakthroughBlocker(state);
  const cost = next.cost;
  const familiar = isFamiliarStage(state, next.index);
  const progress = Math.min(1, state.qi / cost);
  const tribulation = next.isMajor && !familiar ? nextRealm.tribulation : undefined;
  const unlocks = next.isMajor ? realmUnlocks(nextRealm) : [];
  const eta = stats.qps > 0 && state.qi < cost ? (cost - state.qi) / stats.qps : 0;

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
          {game.fmt(state.qi)} / {game.fmt(cost)}
        </span>
      </div>
      {familiar && next.isMajor && nextRealm.tribulation && (
        <div class="muted small">
          You've survived this tribulation before. This time it parts before you.
        </div>
      )}
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
      {tribulation && state.settings.trialAssist === 'skip' && (
        <div class="muted small">Trial assistance will carry you through the tribulation.</div>
      )}
      {tribulation && state.settings.trialAssist !== 'skip' && (
        <div class="muted small">
          You'll face{' '}
          {tribulation.trials === 1
            ? 'an elemental trial'
            : `${tribulation.trials} elemental trials`}{' '}
          and need an average of{' '}
          {Math.round(
            tribulationPassScore(tribulation, stats.mods, state.settings.trialAssist) * 100,
          )}
          % to pass.
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

export function RealmSummary({ compact = false }: { compact?: boolean }) {
  const { state } = game;
  const stage = STAGES[state.stage];
  const realm = REALMS[stage.realmIndex];
  const stageName = realm.stageNames[stage.stageInRealm];
  if (compact) {
    return (
      <h2 class="realm-compact" style={{ color: realm.color }}>
        {realm.name}
        {stageName && <span class="stage"> · {stageName}</span>}
      </h2>
    );
  }
  return (
    <>
      <h2 style={{ color: realm.color }}>{realm.name}</h2>
      {stageName && <div class="stage">{stageName}</div>}
      <p class="realm-desc">{realm.description}</p>
    </>
  );
}

export function CultivationStats() {
  const { state, stats } = game;
  return (
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
      <dt>Per qi mote</dt>
      <dd>{game.fmt(stats.moteValue)}</dd>
      {stats.autoMoteQps > 0 && (
        <>
          <dt>Gathered motes</dt>
          <dd>{game.fmt(stats.autoMoteQps)}/s</dd>
        </>
      )}
    </dl>
  );
}

export function Conditions() {
  const { state } = game;
  if (state.buffs.length === 0) return null;
  return (
    <>
      <h3>Conditions</h3>
      <ul class="buffs">
        {state.buffs.map((b) => {
          const def = BUFFS_BY_ID.get(b.id)!;
          return (
            <li key={b.id} class={def.harmful ? 'harmful' : 'helpful'}>
              {def.name} <span class="muted">{Math.ceil(b.remaining)}s</span>
              <div class="buff-effects">{describeEffects(def.effects)}</div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** The desktop left column. The phone layout arranges the same parts itself (App.tsx). */
export function CultivationPanel() {
  return (
    <section class="panel cultivation">
      <RealmSummary />
      <BreakthroughBox />
      <h3>Cultivation</h3>
      <CultivationStats />
      <Conditions />
    </section>
  );
}
