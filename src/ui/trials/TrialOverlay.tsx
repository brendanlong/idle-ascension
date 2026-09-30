import { useEffect, useRef, useState } from 'preact/hooks';
import type { ElementId } from '../../content/cores';
import { TRIALS_BY_ELEMENT } from '../../content/trials';
import { createTrialGame, type Point, type TrialGame } from './games';

const INTRO_SECONDS = 1.5;
const RESULT_SECONDS = 1.2;

/**
 * Runs one trial game over the qi field: a short intro with the instructions,
 * the game itself, then the score, after which `onDone` receives it.
 */
export function TrialOverlay({
  element,
  title,
  subtitle,
  speed = 1,
  onDone,
}: {
  element: ElementId;
  title: string;
  subtitle?: string;
  /** Game speed; below 1 is slower (tribulation slowdown). */
  speed?: number;
  onDone: (score: number) => void;
}) {
  const def = TRIALS_BY_ELEMENT.get(element)!;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<Point | null>(null);
  const gameRef = useRef<TrialGame | null>(null);
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const game = createTrialGame(element, width, height);
    gameRef.current = game;

    let phaseTime = 0;
    let current: 'intro' | 'playing' | 'result' = 'intro';
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phaseTime += dt;
      if (current === 'intro' && phaseTime >= INTRO_SECONDS) {
        current = 'playing';
        phaseTime = 0;
        setPhase('playing');
      } else if (current === 'playing') {
        game.step(dt * speed, pointer.current);
        setProgress(Math.min(1, game.elapsed / game.duration));
        if (game.finished()) {
          current = 'result';
          phaseTime = 0;
          setScore(game.score());
          setPhase('result');
        }
      } else if (current === 'result' && phaseTime >= RESULT_SECONDS) {
        onDoneRef.current(game.score());
        return;
      }
      ctx.clearRect(0, 0, width, height);
      if (current !== 'intro') game.draw(ctx, now / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [element, speed]);

  const localPoint = (e: PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div
      class={`trial-overlay element-${element}`}
      ref={containerRef}
      onPointerMove={(e) => {
        e.stopPropagation();
        pointer.current = localPoint(e);
      }}
      onPointerLeave={() => (pointer.current = null)}
      onPointerDown={(e) => {
        e.stopPropagation();
        pointer.current = localPoint(e);
        gameRef.current?.click?.(pointer.current);
      }}
    >
      <canvas ref={canvasRef} />
      <div class="trial-header">
        <div class="trial-title">
          {def.icon} {title}
        </div>
        {subtitle && <div class="trial-subtitle">{subtitle}</div>}
        <div class="trial-bar">
          <div class="trial-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      {phase === 'intro' && (
        <div class="trial-center">
          <div class="trial-name">{def.name}</div>
          <div>{def.instructions}</div>
        </div>
      )}
      {phase === 'result' && (
        <div class="trial-center">
          <div class="trial-name">{Math.round(score * 100)}%</div>
        </div>
      )}
    </div>
  );
}
