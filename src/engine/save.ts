import { BUFFS_BY_ID } from '../content/buffs';
import { CORE_GRADES, ELEMENTS_BY_ID, type ElementId } from '../content/cores';
import { ENCOUNTERS_BY_ID } from '../content/encounters';
import { GENERATORS_BY_ID } from '../content/generators';
import { PERKS_BY_ID, PERK_LEVEL_LIMIT } from '../content/perks';
import { FINAL_STAGE } from '../content/realms';
import { MAX_TREASURE_LEVEL, TREASURES_BY_ID } from '../content/treasures';
import { UPGRADES_BY_ID } from '../content/upgrades';
import {
  SAVE_VERSION,
  createInitialState,
  type GameState,
  type NumberFormat,
  type TrialAssist,
} from './state';

type RawSave = Record<string, unknown>;

/**
 * migrations[n] upgrades a save from version n to n + 1.
 *
 * Players have real saves now, so don't lose their progress: when changing
 * GameState in a way that defaults can't fill in (renaming or reshaping a
 * field, changing what a value means), bump SAVE_VERSION, add a migration
 * here, and add a fixture for the new version in __tests__/fixtures/ (keep
 * the old ones: the fixture test loads every one of them). Never lower
 * SAVE_VERSION: newer saves are refused, not overwritten.
 */
const migrations: Record<number, (save: RawSave) => RawSave> = {
  // Meditation Cushions are gone: they become Spirit Herb Patches, and their techniques go.
  3: (save) => {
    const generators = isPlainObject(save.generators) ? save.generators : {};
    const cushions = typeof generators.cushion === 'number' ? generators.cushion : 0;
    const herbs = typeof generators.herb === 'number' ? generators.herb : 0;
    const { cushion: _, ...rest } = generators;
    const upgrades = isPlainObject(save.upgrades) ? save.upgrades : {};
    return {
      ...save,
      generators: { ...rest, herb: herbs + cushions },
      upgrades: Object.fromEntries(
        Object.entries(upgrades).filter(([id]) => !REMOVED_UPGRADES.includes(id)),
      ),
    };
  },
};

/** Techniques removed from the game; saves that owned them lose them. */
export const REMOVED_UPGRADES: readonly string[] = ['cushion-1', 'cushion-5'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fills in fields missing from `saved` using `defaults`, recursively, and
 * replaces values of the wrong shape. Array items and nullable objects aren't
 * default-filled; sanitize() validates those.
 */
function withDefaults<T>(defaults: T, saved: unknown): T {
  if (defaults === null) return (saved === null || isPlainObject(saved) ? saved : null) as T;
  if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as T;
  if (isPlainObject(defaults)) {
    if (!isPlainObject(saved)) return defaults;
    const result: Record<string, unknown> = { ...saved };
    for (const [key, value] of Object.entries(defaults)) {
      result[key] = key in saved ? withDefaults(value, saved[key]) : value;
    }
    return result as T;
  }
  if (typeof saved !== typeof defaults) return defaults;
  if (typeof saved === 'number' && !Number.isFinite(saved)) return defaults;
  return saved as T;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(v)));

function knownIds(record: Record<string, unknown>, known: ReadonlyMap<string, unknown>) {
  return Object.fromEntries(
    Object.keys(record)
      .filter((id) => known.has(id) && record[id] === true)
      .map((id) => [id, true as const]),
  );
}

/**
 * Drops or clamps anything that refers to content that no longer exists (or
 * never did), so a stale or hand-edited save can't crash the game.
 */
function sanitize(state: GameState): GameState {
  state.stage = clampInt(state.stage, 0, FINAL_STAGE);
  state.stats.bestStage = clampInt(Math.max(state.stats.bestStage, state.stage), 0, FINAL_STAGE);

  const generators = createInitialState().generators;
  for (const id of GENERATORS_BY_ID.keys()) {
    const n = state.generators[id];
    generators[id] = isFiniteNumber(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  state.generators = generators;
  state.upgrades = knownIds(state.upgrades, UPGRADES_BY_ID);
  state.revivals = Object.fromEntries(
    Object.entries(state.revivals).filter(
      ([id, mult]) => GENERATORS_BY_ID.has(id) && isFiniteNumber(mult) && mult >= 1,
    ),
  );
  const treasures: Record<string, number> = {};
  for (const [id, level] of Object.entries(state.treasures)) {
    if (TREASURES_BY_ID.has(id) && isFiniteNumber(level) && level >= 1) {
      treasures[id] = clampInt(level, 1, MAX_TREASURE_LEVEL);
    }
  }
  state.treasures = treasures;

  const perks: Record<string, number> = {};
  for (const [id, level] of Object.entries(state.prestige.perks)) {
    const def = PERKS_BY_ID.get(id);
    if (def && isFiniteNumber(level) && level > 0) {
      perks[id] = clampInt(level, 0, Math.min(def.maxLevel, PERK_LEVEL_LIMIT));
    }
  }
  state.prestige.perks = perks;

  const seenElements = new Set<ElementId>();
  state.cores = state.cores.filter((c) => {
    if (!isPlainObject(c) || !ELEMENTS_BY_ID.has(c.element) || seenElements.has(c.element)) {
      return false;
    }
    seenElements.add(c.element);
    c.grade = isFiniteNumber(c.grade) ? clampInt(c.grade, 0, CORE_GRADES.length - 1) : 0;
    return true;
  });

  state.buffs = state.buffs.filter(
    (b) => isPlainObject(b) && BUFFS_BY_ID.has(b.id) && isFiniteNumber(b.remaining),
  );

  const enc = state.encounter.active;
  if (
    enc &&
    !(ENCOUNTERS_BY_ID.has(enc.id) && [enc.x, enc.y, enc.remaining].every(isFiniteNumber))
  ) {
    state.encounter.active = null;
  }

  if (state.trial.active && !ELEMENTS_BY_ID.has(state.trial.active)) state.trial.active = null;
  const offer = state.trial.offer;
  if (
    offer &&
    !(
      ELEMENTS_BY_ID.has(offer.element) && [offer.x, offer.y, offer.remaining].every(isFiniteNumber)
    )
  ) {
    state.trial.offer = null;
  }

  const t = state.tribulation;
  const validTribulation =
    t &&
    isFiniteNumber(t.targetStage) &&
    t.targetStage > 0 &&
    t.targetStage <= FINAL_STAGE &&
    Array.isArray(t.trials) &&
    t.trials.length > 0 &&
    t.trials.every((e) => ELEMENTS_BY_ID.has(e)) &&
    Array.isArray(t.scores) &&
    t.scores.length < t.trials.length &&
    t.scores.every(isFiniteNumber) &&
    isFiniteNumber(t.passScore) &&
    isFiniteNumber(t.speed) &&
    t.speed > 0 &&
    typeof t.started === 'boolean';
  if (!validTribulation) state.tribulation = null;

  const formats: NumberFormat[] = ['short', 'myriad', 'scientific'];
  if (!formats.includes(state.settings.numberFormat)) state.settings.numberFormat = 'short';
  const assists: TrialAssist[] = ['off', 'easier', 'skip'];
  if (!assists.includes(state.settings.trialAssist)) state.settings.trialAssist = 'off';
  return state;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string, now = Date.now()): GameState {
  let raw = JSON.parse(json) as RawSave;
  if (!isPlainObject(raw)) throw new Error('Save is not an object');
  let version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 0;
  if (version > SAVE_VERSION) throw new NewerSaveError('Save is from a newer version of the game');
  while (version < SAVE_VERSION) {
    const migrate = migrations[version];
    if (migrate) raw = migrate(raw);
    version++;
  }
  raw.saveVersion = SAVE_VERSION;
  return sanitize(withDefaults(createInitialState(now), raw));
}

/** Thrown for saves this version of the game can't safely load or overwrite. */
export class NewerSaveError extends Error {}

export function exportSave(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function importSave(encoded: string): GameState {
  const binary = atob(encoded.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}
