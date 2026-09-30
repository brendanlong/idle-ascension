import { useEffect, useRef } from 'preact/hooks';
import { CORE_GRADES, ELEMENTS_BY_ID } from '../../content/cores';
import { ENCOUNTERS_BY_ID } from '../../content/encounters';
import { REALMS, STAGES } from '../../content/realms';
import { disperseBolt } from '../../engine/breakthrough';
import { absorbMotes, click } from '../../engine/economy';
import { claimEncounter } from '../../engine/encounters';
import { game } from '../game';

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

const MAX_MOTES = 40;
const ABSORB_RADIUS = 46;
const FLOAT_LIFETIME = 1.1;

/** Visual-only simulation: motes live here, but the qi they grant goes through the engine. */
class FieldSim {
  motes: Mote[] = [];
  floats: FloatText[] = [];
  pointer: { x: number; y: number } | null = null;
  width = 0;
  height = 0;
  private spawnAccumulator = 0;

  step(dt: number, spawnPerSecond: number): number {
    this.spawnAccumulator += dt * spawnPerSecond;
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

  private spawnMote(): void {
    this.motes.push({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      age: 0,
      life: 8 + Math.random() * 6,
    });
  }

  addFloat(x: number, y: number, text: string, color = '#f6e7b0'): void {
    this.floats.push({ x, y, text, age: 0, color });
  }
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

  // Cores orbit the dantian.
  state.cores.forEach((core, i) => {
    const angle = time * 0.6 + (i * Math.PI * 2) / state.cores.length;
    const x = cx + Math.cos(angle) * 105;
    const y = cy + Math.sin(angle) * 105 * 0.45;
    ctx.beginPath();
    ctx.fillStyle = ELEMENTS_BY_ID.get(core.element)!.color;
    ctx.strokeStyle = CORE_GRADES[core.grade].color;
    ctx.lineWidth = 3;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.shadowBlur = 0;

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

export function QiField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef(new FieldSim());
  const { state } = game;
  const realm = REALMS[STAGES[state.stage].realmIndex];

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext('2d')!;
    const sim = simRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      sim.width = container.clientWidth;
      sim.height = container.clientHeight;
      canvas.width = sim.width * dpr;
      canvas.height = sim.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const absorbed = sim.step(dt, game.stats.moteSpawnPerSecond);
      if (absorbed > 0 && sim.pointer) {
        const gained = game.act((s, stats) => absorbMotes(s, stats, absorbed));
        sim.addFloat(sim.pointer.x, sim.pointer.y - 10, `+${game.fmt(gained)}`, '#9ff5da');
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

  const onOrbClick = (e: MouseEvent) => {
    const gained = game.act((s, stats) => click(s, stats));
    // Keyboard activation reports (0, 0); float from the orb's center instead.
    const p =
      e.detail === 0
        ? { x: simRef.current.width / 2, y: simRef.current.height / 2 - 40 }
        : localPoint(e);
    simRef.current.addFloat(p.x, p.y, `+${game.fmt(gained)}`);
  };

  const encounter = state.encounter.active;
  const encounterDef = encounter && ENCOUNTERS_BY_ID.get(encounter.id);
  const trib = state.tribulation;

  return (
    <div
      class={`qi-field${trib ? ' tribulation' : ''}`}
      ref={containerRef}
      onPointerMove={(e) => (simRef.current.pointer = localPoint(e))}
      onPointerLeave={() => (simRef.current.pointer = null)}
    >
      <canvas ref={canvasRef} />
      <button
        class="orb"
        style={{ '--realm-color': realm.color }}
        onClick={onOrbClick}
        aria-label="Cultivate"
        title="Click to cultivate. Sweep your cursor through drifting qi motes to absorb them."
      >
        <span class="orb-glyph">气</span>
      </button>
      <div class="field-hint">Click the dantian · sweep your cursor through drifting qi</div>

      {encounter && encounterDef && (
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

      {trib && (
        <>
          <div class="trib-status">
            ⚡ Disperse the lightning! Struck {trib.hits} / {trib.allowedHits} endurable · Bolts
            left {trib.boltsToSpawn + trib.bolts.length}
          </div>
          {trib.bolts.map((b) => (
            <button
              key={b.id}
              class="bolt"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                '--progress': `${(b.remaining / b.duration) * 100}%`,
              }}
              onPointerDown={() => game.act((s) => disperseBolt(s, b.id))}
              onClick={() => game.act((s) => disperseBolt(s, b.id))}
              aria-label="Disperse lightning"
            >
              ⚡
            </button>
          ))}
        </>
      )}
    </div>
  );
}
