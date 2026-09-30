import { useEffect, useState } from 'preact/hooks';
import { onLog, type LogEntry } from '../engine/events';
import { formatNumber } from '../engine/format';
import { NewerSaveError, deserialize, serialize } from '../engine/save';
import { createInitialState, type GameState } from '../engine/state';
import { computeStats, type Stats } from '../engine/stats';
import { advanceClock, type OfflineReport } from '../engine/tick';

const STORAGE_KEY = 'idle-ascension-save';
const TICK_MS = 100;
const AUTOSAVE_MS = 15_000;
const MAX_LOG = 60;

/** Owns the mutable game state, runs the clock, and notifies the UI after every change. */
class GameController {
  state: GameState = createInitialState();
  stats: Stats = computeStats(this.state);
  log: LogEntry[] = [];
  offlineReport: OfflineReport | null = null;
  /** Set when this tab must stop running, e.g. because another tab took over the save. */
  haltReason: string | null = null;
  private listeners = new Set<() => void>();
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    onLog((entry) => {
      this.log = [entry, ...this.log].slice(0, MAX_LOG);
    });
    this.load();
    // Saving right away claims the save slot, so any older tab notices and stops.
    this.save();
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        this.halt('The game was opened in another tab. Reload to continue playing here.');
      }
    });
    setInterval(() => this.update(), TICK_MS);
    setInterval(() => this.save(), AUTOSAVE_MS);
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
  }

  private load(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      this.state = deserialize(saved);
    } catch (e) {
      console.error('Failed to load save', e);
      if (e instanceof NewerSaveError) {
        this.halt('Your save is from a newer version of the game. Reload once the update arrives.');
        return;
      }
      localStorage.setItem(`${STORAGE_KEY}-corrupt-${Date.now()}`, saved);
    }
    this.update();
  }

  private halt(reason: string): void {
    this.haltReason = reason;
    this.refresh();
  }

  save(): void {
    if (this.haltReason) return;
    localStorage.setItem(STORAGE_KEY, serialize(this.state));
  }

  private update(): void {
    if (this.haltReason) return;
    const report = advanceClock(this.state, Date.now(), Math.random, {
      pauseTribulation: document.hidden,
    });
    if (report && report.qi > 0) this.offlineReport = report;
    this.refresh();
  }

  /** Runs a mutation against the live state, then re-renders. */
  act<T>(fn: (state: GameState, stats: Stats) => T): T {
    const result = fn(this.state, this.stats);
    this.refresh();
    return result;
  }

  replaceState(state: GameState): void {
    state.lastTick = Date.now();
    this.state = state;
    this.save();
    this.refresh();
  }

  dismissOfflineReport(): void {
    this.offlineReport = null;
    this.refresh();
  }

  fmt(n: number): string {
    return formatNumber(n, this.state.settings.numberFormat);
  }

  private refresh(): void {
    this.stats = computeStats(this.state);
    for (const l of this.listeners) l();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const game = new GameController();

/** Re-renders the calling component whenever the game changes. */
export function useGame(): GameController {
  const [, setVersion] = useState(0);
  useEffect(() => game.subscribe(() => setVersion((v) => v + 1)), []);
  return game;
}
