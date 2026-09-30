import type { Effect } from '../engine/effects';

export type ElementId = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export interface ElementDef {
  id: ElementId;
  name: string;
  glyph: string;
  color: string;
  description: string;
  /** Bonus granted by a core of this element, scaled by the core's grade (0-based). */
  effects: (grade: number) => Effect[];
}

/** Listed in the generating (sheng) cycle: each element feeds the next. */
export const ELEMENTS: readonly ElementDef[] = [
  {
    id: 'wood',
    name: 'Wood',
    glyph: '木',
    color: '#5fae5a',
    description: 'Growth. Boosts all cultivation resources.',
    effects: (g) => [{ type: 'mult', stat: 'globalMult', value: 1.2 + 0.15 * g }],
  },
  {
    id: 'fire',
    name: 'Fire',
    glyph: '火',
    color: '#e0603a',
    description: 'Ferocity. Greatly boosts click power.',
    effects: (g) => [{ type: 'mult', stat: 'clickMult', value: 2 + g }],
  },
  {
    id: 'earth',
    name: 'Earth',
    glyph: '土',
    color: '#c9a45a',
    description: 'Stability. Easier tribulations; better closed-door cultivation.',
    effects: (g) => [
      { type: 'add', stat: 'tribulationLeniency', value: 0.05 + 0.02 * g },
      { type: 'add', stat: 'offlineEfficiency', value: 0.1 + 0.05 * g },
    ],
  },
  {
    id: 'metal',
    name: 'Metal',
    glyph: '金',
    color: '#d8dde3',
    description: 'Sharpness. Cultivation resources cost less.',
    effects: (g) => [
      { type: 'mult', stat: 'generatorCostMult', value: Math.max(0.5, 0.92 - 0.04 * g) },
    ],
  },
  {
    id: 'water',
    name: 'Water',
    glyph: '水',
    color: '#4f8fd6',
    description: 'Flow. Qi motes appear more often and are worth more.',
    effects: (g) => [
      { type: 'mult', stat: 'moteSpawnMult', value: 1.25 + 0.05 * g },
      { type: 'mult', stat: 'moteValueMult', value: 1.5 + 0.25 * g },
    ],
  },
];

export const ELEMENTS_BY_ID: ReadonlyMap<ElementId, ElementDef> = new Map(
  ELEMENTS.map((e) => [e.id, e]),
);

/** Multiplier for each pair of adjacent elements in the generating cycle. */
export const GENERATING_CYCLE_BONUS = 1.25;

export interface CoreGradeDef {
  name: string;
  /** Multiplier to all qi gain from a core of this grade. */
  mult: number;
  color: string;
}

export const CORE_GRADES: readonly CoreGradeDef[] = [
  { name: 'Mud', mult: 1.2, color: '#6b5a45' },
  { name: 'Iron', mult: 1.5, color: '#7d8590' },
  { name: 'Bronze', mult: 2, color: '#b0773e' },
  { name: 'Silver', mult: 2.5, color: '#c9d1da' },
  { name: 'Gold', mult: 3, color: '#f0c24b' },
  { name: 'Jade', mult: 4, color: '#63c29a' },
  { name: 'Starsteel', mult: 5, color: '#9fb8ff' },
  { name: 'Primordial', mult: 7, color: '#f4f0ff' },
];

/** Qi cost to form the Nth core (0-based). */
export const CORE_FORM_BASE_COST = 1e8;
export const CORE_FORM_COST_GROWTH = 1000;
/** Refining to the next grade costs this multiple of the previous grade. */
export const CORE_REFINE_COST_GROWTH = 12;
