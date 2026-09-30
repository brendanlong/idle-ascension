import type { Effect } from '../engine/effects';

export interface BuffDef {
  id: string;
  name: string;
  duration: number;
  harmful?: boolean;
  effects: readonly Effect[];
}

export const BUFFS: readonly BuffDef[] = [
  {
    id: 'epiphany',
    name: 'Sudden Epiphany',
    duration: 77,
    effects: [{ type: 'mult', stat: 'globalMult', value: 7 }],
  },
  {
    id: 'meridianSurge',
    name: 'Meridian Surge',
    duration: 15,
    effects: [{ type: 'mult', stat: 'clickMult', value: 33 }],
  },
  {
    id: 'heavensFavor',
    name: "Heaven's Favor",
    duration: 300,
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'injured',
    name: 'Grievous Injury',
    duration: 60,
    harmful: true,
    effects: [{ type: 'mult', stat: 'globalMult', value: 0.5 }],
  },
];

export const BUFFS_BY_ID: ReadonlyMap<string, BuffDef> = new Map(BUFFS.map((b) => [b.id, b]));
