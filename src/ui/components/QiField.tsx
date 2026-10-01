import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CORE_GRADES, ELEMENTS_BY_ID } from '../../content/cores';
import { ENCOUNTERS_BY_ID } from '../../content/encounters';
import { REALMS, STAGES } from '../../content/realms';
import { TRIALS_BY_ELEMENT, TRIAL_SKIP_SCORE } from '../../content/trials';
import {
  beginTribulationTrial,
  trialSpeed,
  currentTribulationTrial,
  recordTribulationTrial,
} from '../../engine/breakthrough';
import { absorbMotes, drawInMote } from '../../engine/economy';
import { claimEncounter } from '../../engine/encounters';
import { MAX_MOTES, moteSpawnRate } from '../../engine/stats';
import { acceptTrial, completeTrial } from '../../engine/trials';
import { TrialOverlay } from '../trials/TrialOverlay';
import { game } from '../game';
import { useMediaQuery } from '../useMediaQuery';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  age: number;
  color: string;
}

const MOTE_MIN_LIFE = 8;
const MOTE_MAX_LIFE = 14;
const CATCH_UP_STEP = 0.25;
const ABSORB_RADIUS = 46;
const FLOAT_LIFETIME = 1.1;
/** Absorbed motes are credited in batches to avoid re-rendering every animation frame. */
const MOTE_FLUSH_MS = 150;

/**
 * When the field last drew a frame. It outlives the component, so motes
 * missed on another phone tab or a hidden browser tab can be caught up.
 */
let lastFrameAt: number | null = null;
/** A gap between frames longer than this means the field wasn't being shown. */
const MISSED_FRAME_GAP_MS = 1000;

/** Visual-only simulation: motes live here, but the qi they grant goes through the engine. */
class FieldSim {
  motes: Mote[] = [];
  floats: FloatText[] = [];
  pointer: { x: number; y: number } | null = null;
  width = 0;
  height = 0;
  orbRadius = 0;
  private spawnAccumulator = 0;

  step(dt: number, spawnPerSecond: number): number {
    this.spawnAccumulator += dt * moteSpawnRate(spawnPerSecond, this.motes.length);
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator--;
      if (this.motes.length < MAX_MOTES) this.spawnMote();
    }

    let absorbed = 0;
    this.motes = this.motes.filter((m) => {
      m.age += dt;
      m.vx += (Math.random() - 0.5) * 20 * dt;
      m.vy += (Math.random() - 0.5) * 20 * dt - 2 * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (this.pointer && Math.hypot(m.x - this.pointer.x, m.y - this.pointer.y) < ABSORB_RADIUS) {
        absorbed++;
        return false;
      }
      return m.age < m.life && m.x > -20 && m.x < this.width + 20 && m.y > -20;
    });

    for (const f of this.floats) f.age += dt;
    this.floats = this.floats.filter((f) => f.age < FLOAT_LIFETIME);
    return absorbed;
  }

  /**
   * Brings the field to how it would look after `seconds` more of running
   * unseen. Only the last MOTE_MAX_LIFE seconds matter (older motes would have
   * faded), so age everything past that, then replay those seconds in small
   * steps, spawning at the rate for however many motes were waiting.
   */
  catchUp(seconds: number, spawnPerSecond: number): void {
    const window = Math.min(seconds, MOTE_MAX_LIFE);
    const ageBy = (dt: number) => {
      for (const m of this.motes) m.age += dt;
      this.motes = this.motes.filter((m) => m.age < m.life);
    };
    ageBy(seconds - window);
    for (let t = 0; t < window; t += CATCH_UP_STEP) {
      const dt = Math.min(CATCH_UP_STEP, window - t);
      this.spawnAccumulator += dt * moteSpawnRate(spawnPerSecond, this.motes.length);
      while (this.spawnAccumulator >= 1 && this.motes.length < MAX_MOTES) {
        this.spawnAccumulator--;
        this.spawnMote();
      }
      ageBy(dt);
    }
  }

  /** Removes the mote nearest the field's center (the orb), returning where it was. */
  pullMote(): { x: number; y: number } | null {
    if (this.motes.length === 0) return null;
    const cx = this.width / 2;
    const cy = this.height / 2;
    let nearest = 0;
    this.motes.forEach((m, i) => {
      const best = this.motes[nearest];
      if (Math.hypot(m.x - cx, m.y - cy) < Math.hypot(best.x - cx, best.y - cy)) nearest = i;
    });
    const [mote] = this.motes.splice(nearest, 1);
    return { x: mote.x, y: mote.y };
  }

  private spawnMote(): void {
    this.motes.push({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      age: 0,
      life: MOTE_MIN_LIFE + Math.random() * (MOTE_MAX_LIFE - MOTE_MIN_LIFE),
    });
  }

  addFloat(x: number, y: number, text: string, color = '#f6e7b0'): void {
    this.floats.push({ x, y, text, age: 0, color });
  }
}

const ORBIT_RADIUS_X = 115;
const ORBIT_RADIUS_Y = 40;
const CORE_RADIUS = 11;

/**
 * Cores orbit on a tilted ellipse. The canvas sits above the orb, so the back
 * half of the orbit is clipped to outside the orb's circle to pass behind it.
 */
function drawOrbit(
  ctx: CanvasRenderingContext2D,
  sim: FieldSim,
  time: number,
  half: 'back' | 'front',
): void {
  const cx = sim.width / 2;
  const cy = sim.height / 2;
  const { cores } = game.state;
  ctx.save();
  if (half === 'back') {
    ctx.beginPath();
    ctx.rect(0, 0, sim.width, sim.height);
    ctx.arc(cx, cy, sim.orbRadius, 0, Math.PI * 2);
    ctx.clip('evenodd');
  }

  if (cores.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(224, 182, 74, 0.25)';
    ctx.lineWidth = 1;
    const [start, end] = half === 'back' ? [Math.PI, Math.PI * 2] : [0, Math.PI];
    ctx.ellipse(cx, cy, ORBIT_RADIUS_X, ORBIT_RADIUS_Y, 0, start, end);
    ctx.stroke();
  }

  cores.forEach((core, i) => {
    const angle = time * 0.6 + (i * Math.PI * 2) / cores.length;
    // sin(angle) > 0 is the lower half of the ellipse: nearer the viewer.
    const depth = Math.sin(angle);
    if (depth >= 0 !== (half === 'front')) return;
    const x = cx + Math.cos(angle) * ORBIT_RADIUS_X;
    const y = cy + depth * ORBIT_RADIUS_Y;
    ctx.globalAlpha = 0.75 + 0.25 * depth;
    ctx.beginPath();
    ctx.fillStyle = ELEMENTS_BY_ID.get(core.element)!.color;
    ctx.strokeStyle = CORE_GRADES[core.grade].color;
    ctx.lineWidth = 3;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.arc(x, y, CORE_RADIUS * (1 + 0.2 * depth), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, sim: FieldSim, time: number): void {
  const { width: w, height: h } = sim;
  const { state } = game;
  const realm = REALMS[STAGES[state.stage].realmIndex];
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.6);
  glow.addColorStop(0, `${realm.color}40`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  if (state.tribulation) {
    ctx.fillStyle = 'rgba(20, 10, 40, 0.55)';
    ctx.fillRect(0, 0, w, h);
  }

  for (const m of sim.motes) {
    const fade = Math.min(1, m.age * 2, (m.life - m.age) / 1.5);
    const r = 3 + Math.sin(time * 3 + m.x) * 0.8;
    ctx.beginPath();
    ctx.fillStyle = `rgba(170, 240, 220, ${0.8 * fade})`;
    ctx.shadowColor = '#9ff5da';
    ctx.shadowBlur = 12;
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  drawOrbit(ctx, sim, time, 'back');
  drawOrbit(ctx, sim, time, 'front');

  if (sim.pointer) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(160, 240, 220, 0.18)';
    ctx.lineWidth = 1;
    ctx.arc(sim.pointer.x, sim.pointer.y, ABSORB_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.font = '600 16px Georgia, serif';
  for (const f of sim.floats) {
    const t = f.age / FLOAT_LIFETIME;
    ctx.fillStyle = f.color;
    ctx.globalAlpha = 1 - t;
    ctx.fillText(f.text, f.x, f.y - t * 50);
  }
  ctx.globalAlpha = 1;
}

/** `overlay` is shown in the field's corner, beneath the motes, without catching the pointer. */
export function QiField({ overlay }: { overlay?: ComponentChildren } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const [sim] = useState(() => new FieldSim());
  const touch = useMediaQuery('(pointer: coarse)');
  /** Last cursor position over the field, handed to trials so they know where it starts. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const { state } = game;
  const realm = REALMS[STAGES[state.stage].realmIndex];

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      sim.width = container.clientWidth;
      sim.height = container.clientHeight;
      sim.orbRadius = orbRef.current!.offsetWidth / 2;
      canvas.width = sim.width * dpr;
      canvas.height = sim.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let last = performance.now();
    if (lastFrameAt !== null)
      sim.catchUp((last - lastFrameAt) / 1000, game.stats.moteSpawnPerSecond);
    let lastFlush = last;
    let pendingMotes = 0;
    let frame = 0;
    const loop = (now: number) => {
      // Browsers stop animating hidden tabs; bring back what was missed.
      if (now - last > MISSED_FRAME_GAP_MS) {
        sim.catchUp((now - last) / 1000, game.stats.moteSpawnPerSecond);
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      lastFrameAt = now;
      pendingMotes += sim.step(dt, game.stats.moteSpawnPerSecond);
      if (pendingMotes > 0 && sim.pointer && now - lastFlush >= MOTE_FLUSH_MS) {
        const count = pendingMotes;
        const gained = game.act((s, stats) => absorbMotes(s, stats, count));
        sim.addFloat(sim.pointer.x, sim.pointer.y - 10, `+${game.fmt(gained)}`, '#9ff5da');
        pendingMotes = 0;
        lastFlush = now;
      }
      draw(ctx, sim, now / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const localPoint = (e: PointerEvent | MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Pressing the orb draws in the nearest waiting mote, so it's another way to
  // gather (for keyboards and taps), never faster than motes appear.
  const onOrbClick = () => {
    const from = sim.pullMote();
    if (!from) return;
    const gained = game.act((s, stats) => drawInMote(s, stats));
    sim.addFloat(from.x, from.y - 10, `+${game.fmt(gained)}`, '#9ff5da');
  };

  const encounter = state.encounter.active;
  const encounterDef = encounter && ENCOUNTERS_BY_ID.get(encounter.id);
  const trib = state.tribulation;
  const tribElement = currentTribulationTrial(state);
  const tribDef = trib && REALMS[STAGES[trib.targetStage].realmIndex].tribulation;
  const activeTrial = state.trial.active;
  // The overlay takes over the pointer; don't keep absorbing motes at a stale spot.
  // While a trial runs, the overlay takes over: encounters and offers are hidden
  // (their timers are paused in the engine) and motes aren't absorbed.
  const trialRunning = Boolean(tribElement || activeTrial);
  if (trialRunning) sim.pointer = null;
  const trialOffer = state.trial.offer;
  const trialOfferDef = trialOffer && TRIALS_BY_ELEMENT.get(trialOffer.element);

  return (
    <div
      class="qi-field"
      ref={containerRef}
      onPointerMove={(e) => {
        sim.pointer = localPoint(e);
        lastPointer.current = sim.pointer;
      }}
      onPointerLeave={() => {
        sim.pointer = null;
        lastPointer.current = null;
      }}
    >
      <canvas ref={canvasRef} />
      {overlay && <div class="field-overlay">{overlay}</div>}
      <button
        ref={orbRef}
        class="orb"
        style={{ '--realm-color': realm.color }}
        onClick={onOrbClick}
        // Holding Enter would otherwise auto-repeat clicks.
        onKeyDown={(e) => e.repeat && e.preventDefault()}
        aria-label="Draw in a qi mote"
        title="Sweep your cursor through drifting qi motes to absorb them, or press the dantian to draw in the nearest one."
      >
        <span class="orb-glyph">气</span>
      </button>
      <div class="field-hint">
        {touch
          ? 'Drag through drifting qi, or tap the dantian'
          : 'Sweep through drifting qi, or click the dantian'}
      </div>

      {encounter && encounterDef && !trialRunning && (
        <button
          class="encounter"
          style={{ left: `${encounter.x * 100}%`, top: `${encounter.y * 100}%` }}
          onClick={() => game.act((s, stats) => claimEncounter(s, stats, Math.random))}
          title="A fortuitous encounter! Click before it vanishes."
        >
          <span class="encounter-icon">{encounterDef.icon}</span>
          <span class="encounter-name">{encounterDef.name}</span>
        </button>
      )}

      {trialOffer && trialOfferDef && !trialRunning && !trib && (
        <button
          class="encounter trial-offer"
          style={{ left: `${trialOffer.x * 100}%`, top: `${trialOffer.y * 100}%` }}
          onClick={() =>
            game.act((s, stats) => {
              const element = acceptTrial(s);
              // Trial assistance can resolve optional trials without playing them.
              if (element && s.settings.trialAssist === 'skip') {
                completeTrial(s, stats, element, TRIAL_SKIP_SCORE, Math.random);
              }
            })
          }
          title="An elemental trial. Optional; the better you do, the bigger the reward."
        >
          <span class="encounter-icon">{trialOfferDef.icon}</span>
          <span class="encounter-name">{ELEMENTS_BY_ID.get(trialOffer.element)!.name} Trial</span>
        </button>
      )}

      {tribElement && trib && tribDef ? (
        <TrialOverlay
          key={`${trib.targetStage}-${trib.scores.length}`}
          element={tribElement}
          pointer={lastPointer}
          onStart={() => game.act((s) => beginTribulationTrial(s))}
          title={`${tribDef.name} · Trial ${trib.scores.length + 1} of ${trib.trials.length}`}
          subtitle={`Average ${Math.round(trib.passScore * 100)}% or better to pass`}
          speed={trib.speed}
          onDone={(score) => game.act((s) => recordTribulationTrial(s, score))}
        />
      ) : (
        activeTrial && (
          <TrialOverlay
            element={activeTrial}
            title={`${ELEMENTS_BY_ID.get(activeTrial)!.name} Trial`}
            pointer={lastPointer}
            speed={trialSpeed(state.settings.trialAssist)}
            onDone={(score) =>
              game.act((s, stats) => completeTrial(s, stats, activeTrial, score, Math.random))
            }
          />
        )
      )}
    </div>
  );
}
