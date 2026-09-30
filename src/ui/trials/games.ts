/**
 * Elemental trial mini-games. Each is a small real-time simulation that takes
 * pointer input and reports a 0-1 score; the overlay component runs and draws
 * them. They're kept DOM-free (apart from drawing to a canvas context passed
 * in) so they can be tested by scripting a player.
 */
import type { ElementId } from '../../content/cores';

export interface Point {
  x: number;
  y: number;
}

type Rng = () => number;

export interface TrialGame {
  readonly duration: number;
  elapsed: number;
  /** `pointer` is null while the cursor is outside the field. */
  step(dt: number, pointer: Point | null): void;
  click?(p: Point): void;
  draw(ctx: CanvasRenderingContext2D, time: number): void;
  score(): number;
  finished(): boolean;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

// --- Fire: click each seal before it burns out ---

export class FlameSeals implements TrialGame {
  static readonly SEALS = 8;
  static readonly LIFE = 1.8;
  static readonly GAP = 0.35;
  static readonly RADIUS = 30;
  readonly duration = FlameSeals.SEALS * (FlameSeals.LIFE + FlameSeals.GAP);
  elapsed = 0;
  hits = 0;
  resolved = 0;
  seal: (Point & { life: number }) | null = null;
  private wait = 0.5;
  private readonly width: number;
  private readonly height: number;
  private readonly rng: Rng;

  constructor(width: number, height: number, rng: Rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
  }

  step(dt: number): void {
    this.elapsed += dt;
    if (this.seal) {
      this.seal.life -= dt;
      if (this.seal.life <= 0) this.resolve(false);
    } else if (this.resolved < FlameSeals.SEALS && (this.wait -= dt) <= 0) {
      const m = FlameSeals.RADIUS + 20;
      this.seal = {
        x: m + this.rng() * (this.width - 2 * m),
        y: m + this.rng() * (this.height - 2 * m),
        life: FlameSeals.LIFE,
      };
    }
  }

  click(p: Point): void {
    if (this.seal && dist(p, this.seal) <= FlameSeals.RADIUS) this.resolve(true);
  }

  private resolve(hit: boolean): void {
    if (hit) this.hits++;
    this.resolved++;
    this.seal = null;
    this.wait = FlameSeals.GAP;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.seal) return;
    const { x, y, life } = this.seal;
    const r = FlameSeals.RADIUS;
    glow(ctx, '#ff7a3a', 20);
    ctx.fillStyle = '#e0603a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffe2b0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + (life / FlameSeals.LIFE) * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff4e0';
    ctx.font = '600 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.resolved + 1), x, y + 1);
  }

  score(): number {
    return this.hits / FlameSeals.SEALS;
  }

  finished(): boolean {
    return this.resolved >= FlameSeals.SEALS;
  }
}

// --- Water: sweep through the flowing current ---

export class FlowingCurrent implements TrialGame {
  static readonly SPAWN_SECONDS = 9;
  static readonly PER_SECOND = 3;
  static readonly SPEED = 140;
  static readonly RADIUS = 34;
  /** Catching this fraction of the orbs counts as a perfect score. */
  static readonly PERFECT_FRACTION = 0.8;
  readonly duration = 14;
  elapsed = 0;
  orbs: (Point & { phase: number })[] = [];
  spawned = 0;
  collected = 0;
  private spawnTimer = 0;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number, rng: Rng) {
    this.width = width;
    this.height = height;
    this.amplitude = height * (0.2 + rng() * 0.15);
    this.frequency = 0.8 + rng() * 0.6;
  }

  private streamY(t: number): number {
    return this.height / 2 + Math.sin(t * this.frequency) * this.amplitude;
  }

  step(dt: number, pointer: Point | null): void {
    this.elapsed += dt;
    this.spawnTimer -= dt;
    while (this.elapsed < FlowingCurrent.SPAWN_SECONDS && this.spawnTimer <= 0) {
      this.orbs.push({ x: -10, y: this.streamY(this.elapsed), phase: this.elapsed });
      this.spawned++;
      this.spawnTimer += 1 / FlowingCurrent.PER_SECOND;
    }
    this.orbs = this.orbs.filter((orb) => {
      orb.x += FlowingCurrent.SPEED * dt;
      orb.y = this.streamY(orb.phase + orb.x / 200);
      if (pointer && dist(orb, pointer) <= FlowingCurrent.RADIUS) {
        this.collected++;
        return false;
      }
      return orb.x < this.width + 20;
    });
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    glow(ctx, '#7fc8ff', 16);
    for (const o of this.orbs) {
      ctx.fillStyle = '#4f8fd6';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 9 + Math.sin(time * 5 + o.phase * 7) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  score(): number {
    return clamp01(this.collected / (this.spawned * FlowingCurrent.PERFECT_FRACTION || 1));
  }

  finished(): boolean {
    return this.elapsed >= FlowingCurrent.SPAWN_SECONDS && this.orbs.length === 0;
  }
}

// --- Wood: keep close to the wandering spirit ---

export class ChaseSpirit implements TrialGame {
  static readonly RADIUS = 50;
  /** Staying close this fraction of the time counts as a perfect score. */
  static readonly PERFECT_FRACTION = 0.75;
  readonly duration = 10;
  elapsed = 0;
  onTarget = 0;
  spirit: Point;
  private readonly phases: [number, number];
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number, rng: Rng) {
    this.width = width;
    this.height = height;
    this.phases = [rng() * Math.PI * 2, rng() * Math.PI * 2];
    this.spirit = this.position(0);
  }

  private position(t: number): Point {
    const [a, b] = this.phases;
    return {
      x: this.width / 2 + this.width * 0.35 * Math.sin(0.7 * t + a),
      y: this.height / 2 + this.height * 0.3 * Math.sin(1.1 * t + b),
    };
  }

  step(dt: number, pointer: Point | null): void {
    this.elapsed += dt;
    this.spirit = this.position(this.elapsed);
    if (pointer && dist(pointer, this.spirit) <= ChaseSpirit.RADIUS) this.onTarget += dt;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.spirit;
    ctx.strokeStyle = 'rgba(95, 174, 90, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, ChaseSpirit.RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    glow(ctx, '#b8f5a0', 24);
    ctx.fillStyle = '#d9ffc8';
    ctx.beginPath();
    ctx.arc(x, y, 10 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  score(): number {
    return clamp01(this.onTarget / (this.duration * ChaseSpirit.PERFECT_FRACTION));
  }

  finished(): boolean {
    return this.elapsed >= this.duration;
  }
}

// --- Earth: touch the formation's points in order ---

export class CarveFormation implements TrialGame {
  static readonly POINTS = 10;
  static readonly RADIUS = 28;
  readonly duration = 12;
  elapsed = 0;
  points: Point[];
  reached = 0;

  constructor(width: number, height: number, rng: Rng) {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.36;
    const star = rng() < 0.5;
    const start = rng() * Math.PI * 2;
    // A circle, or a five-pointed star drawn by skipping points.
    this.points = Array.from({ length: CarveFormation.POINTS }, (_, i) => {
      const k = star ? (i * 3) % CarveFormation.POINTS : i;
      const angle = start + (k / CarveFormation.POINTS) * Math.PI * 2;
      const radius = star && k % 2 === 1 ? r * 0.45 : r;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  }

  get current(): Point | null {
    return this.points[this.reached] ?? null;
  }

  step(dt: number, pointer: Point | null): void {
    this.elapsed += dt;
    const target = this.current;
    if (target && pointer && dist(pointer, target) <= CarveFormation.RADIUS) this.reached++;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.strokeStyle = '#c9a45a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    this.points
      .slice(0, this.reached)
      .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    this.points.forEach((p, i) => {
      const isCurrent = i === this.reached;
      ctx.fillStyle =
        i < this.reached ? '#c9a45a' : isCurrent ? '#ffe7a8' : 'rgba(201, 164, 90, 0.3)';
      if (isCurrent) glow(ctx, '#ffd36a', 20);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isCurrent ? 12 + Math.sin(time * 6) * 2 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  score(): number {
    return this.reached / CarveFormation.POINTS;
  }

  finished(): boolean {
    return this.reached >= CarveFormation.POINTS || this.elapsed >= this.duration;
  }
}

// --- Metal: dodge the blades ---

interface Blade {
  from: Point;
  dir: Point;
  /** Seconds of warning line before it flies. */
  warn: number;
  pos: Point;
  hit: boolean;
}

export class RainOfBlades implements TrialGame {
  static readonly SPAWN_EVERY = 1.1;
  static readonly WARN = 1.0;
  static readonly SPEED = 200;
  static readonly HIT_RADIUS = 14;
  /** This many hits drops the score to zero. */
  static readonly MAX_HITS = 6;
  readonly duration = 12;
  elapsed = 0;
  hits = 0;
  blades: Blade[] = [];
  private spawnTimer = 0.6;
  private outside = 0;
  private readonly width: number;
  private readonly height: number;
  private readonly rng: Rng;

  constructor(width: number, height: number, rng: Rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
  }

  step(dt: number, pointer: Point | null): void {
    this.elapsed += dt;
    // Leaving the field isn't a way out: every second outside counts as a hit.
    if (!pointer) {
      this.outside += dt;
      if (this.outside >= 1) {
        this.outside -= 1;
        this.hits++;
      }
    }
    this.spawnTimer -= dt;
    if (this.elapsed < this.duration - 1.5 && this.spawnTimer <= 0) {
      this.spawnTimer += RainOfBlades.SPAWN_EVERY;
      this.spawn(pointer ?? { x: this.width / 2, y: this.height / 2 });
    }
    for (const b of this.blades) {
      if (b.warn > 0) {
        b.warn -= dt;
        continue;
      }
      b.pos = {
        x: b.pos.x + b.dir.x * RainOfBlades.SPEED * dt,
        y: b.pos.y + b.dir.y * RainOfBlades.SPEED * dt,
      };
      if (!b.hit && pointer && dist(b.pos, pointer) <= RainOfBlades.HIT_RADIUS) {
        b.hit = true;
        this.hits++;
      }
    }
    const m = 60;
    this.blades = this.blades.filter(
      (b) => b.pos.x > -m && b.pos.x < this.width + m && b.pos.y > -m && b.pos.y < this.height + m,
    );
  }

  /** A blade from a random edge, aimed at where the cursor is now. */
  private spawn(target: Point): void {
    const side = Math.floor(this.rng() * 4);
    const t = this.rng();
    const from = [
      { x: t * this.width, y: -20 },
      { x: this.width + 20, y: t * this.height },
      { x: t * this.width, y: this.height + 20 },
      { x: -20, y: t * this.height },
    ][side];
    const d = dist(from, target) || 1;
    const dir = { x: (target.x - from.x) / d, y: (target.y - from.y) / d };
    this.blades.push({ from, dir, warn: RainOfBlades.WARN, pos: { ...from }, hit: false });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.blades) {
      if (b.warn > 0) {
        ctx.strokeStyle = `rgba(216, 221, 227, ${0.15 + 0.35 * (1 - b.warn / RainOfBlades.WARN)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(b.from.x, b.from.y);
        ctx.lineTo(b.from.x + b.dir.x * 2000, b.from.y + b.dir.y * 2000);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      glow(ctx, '#ffffff', 12);
      ctx.strokeStyle = b.hit ? '#d0513f' : '#eef2f6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.pos.x, b.pos.y);
      ctx.lineTo(b.pos.x - b.dir.x * 34, b.pos.y - b.dir.y * 34);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  score(): number {
    return clamp01(1 - this.hits / RainOfBlades.MAX_HITS);
  }

  finished(): boolean {
    return this.elapsed >= this.duration;
  }
}

export function createTrialGame(
  element: ElementId,
  width: number,
  height: number,
  rng: Rng = Math.random,
): TrialGame {
  switch (element) {
    case 'fire':
      return new FlameSeals(width, height, rng);
    case 'water':
      return new FlowingCurrent(width, height, rng);
    case 'wood':
      return new ChaseSpirit(width, height, rng);
    case 'earth':
      return new CarveFormation(width, height, rng);
    case 'metal':
      return new RainOfBlades(width, height, rng);
  }
}
