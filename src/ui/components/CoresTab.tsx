import { CORE_GRADES, ELEMENTS, ELEMENTS_BY_ID, GENERATING_CYCLE_BONUS } from '../../content/cores';
import {
  canFormCore,
  canRefineCore,
  coreFormCost,
  coreRefineCost,
  formCore,
  maxCoreGrade,
  refineCore,
} from '../../engine/cores';
import { describeEffect } from '../../engine/effects';
import { generatingPairs, unlockedCoreSlots } from '../../engine/stats';
import { game } from '../game';

export function CoresTab() {
  const { state, stats } = game;
  const slots = unlockedCoreSlots(state, stats.mods);

  if (slots === 0) {
    return (
      <div class="tab-body">
        <p class="muted">
          Reach <strong>Core Formation</strong> to condense your qi into a core. Each core is
          attuned to one of the Five Elements and can be refined from humble mud into ever-finer
          materials.
        </p>
      </div>
    );
  }

  const gradeCap = maxCoreGrade(state);
  const usedElements = new Set(state.cores.map((c) => c.element));
  const pairs = generatingPairs(usedElements);
  const formCost = coreFormCost(stats.mods, state.cores.length);

  return (
    <div class="tab-body">
      <p class="muted small">
        Core slots: {state.cores.length} / {slots}. Your realm allows refinement up to{' '}
        <strong>{CORE_GRADES[gradeCap].name}</strong>.
      </p>
      <ul class="card-list">
        {state.cores.map((core, i) => {
          const el = ELEMENTS_BY_ID.get(core.element)!;
          const grade = CORE_GRADES[core.grade];
          const canRefine = canRefineCore(state, i);
          const cost = canRefine ? coreRefineCost(state, stats.mods, i) : 0;
          return (
            <li key={core.element} class="card core-card" style={{ '--el-color': el.color }}>
              <div class="core-glyph" style={{ borderColor: grade.color }}>
                {el.glyph}
              </div>
              <div class="core-info">
                <strong>
                  {grade.name} {el.name} Core
                </strong>
                <p class="effect">
                  ×{grade.mult} all qi gain;{' '}
                  {el
                    .effects(core.grade)
                    .map((e) => describeEffect(e))
                    .join(', ')}
                </p>
                {canRefine ? (
                  <button
                    class="primary"
                    disabled={state.qi < cost}
                    onClick={() => game.act((s, st) => refineCore(s, st.mods, i))}
                  >
                    Refine to {CORE_GRADES[core.grade + 1].name} ({game.fmt(cost)} qi)
                  </button>
                ) : (
                  <span class="muted small">
                    {core.grade >= CORE_GRADES.length - 1
                      ? 'Perfected.'
                      : 'Reach a higher realm to refine further.'}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {state.cores.length < slots && (
        <div class="form-core">
          <h3>Form a new core ({game.fmt(formCost)} qi)</h3>
          <div class="element-grid">
            {ELEMENTS.map((el) => (
              <button
                key={el.id}
                class="element-btn"
                style={{ '--el-color': el.color }}
                disabled={!canFormCore(state, stats.mods, el.id) || state.qi < formCost}
                onClick={() => game.act((s, st) => formCore(s, st.mods, el.id))}
                title={el.description}
              >
                <span class="element-glyph">{el.glyph}</span>
                <span>{el.name}</span>
                <span class="small muted">{el.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <h3>The Generating Cycle</h3>
      <p class="muted small">
        {ELEMENTS.map((e) => e.name).join(' → ')} → {ELEMENTS[0].name}. Each pair of your cores
        adjacent in this cycle grants ×{GENERATING_CYCLE_BONUS} all qi gain. Active pairs: {pairs}.
      </p>
    </div>
  );
}
