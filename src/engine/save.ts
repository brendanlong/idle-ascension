import { SAVE_VERSION, createInitialState, type GameState } from './state';

type RawSave = Record<string, unknown>;

/**
 * migrations[n] upgrades a save from version n to n + 1. When changing the
 * shape of GameState in a way that defaults can't fill in, bump SAVE_VERSION
 * and add a migration here.
 */
const migrations: Record<number, (save: RawSave) => RawSave> = {};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Fills in any fields missing from `saved` using `defaults`, recursively. */
function withDefaults<T>(defaults: T, saved: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(saved)) {
    return saved === undefined || typeof saved !== typeof defaults ? defaults : (saved as T);
  }
  const result: Record<string, unknown> = { ...saved };
  for (const [key, value] of Object.entries(defaults)) {
    result[key] = key in saved ? withDefaults(value, saved[key]) : value;
  }
  return result as T;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string, now = Date.now()): GameState {
  let raw = JSON.parse(json) as RawSave;
  if (!isPlainObject(raw)) throw new Error('Save is not an object');
  let version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 0;
  if (version > SAVE_VERSION) throw new Error('Save is from a newer version of the game');
  while (version < SAVE_VERSION) {
    const migrate = migrations[version];
    if (migrate) raw = migrate(raw);
    version++;
  }
  raw.saveVersion = SAVE_VERSION;
  return withDefaults(createInitialState(now), raw);
}

export function exportSave(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  return btoa(String.fromCharCode(...bytes));
}

export function importSave(encoded: string): GameState {
  const binary = atob(encoded.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}
