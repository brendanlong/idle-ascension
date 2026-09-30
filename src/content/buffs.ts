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
    id: 'qiTide',
    name: 'Qi Tide',
    duration: 45,
    effects: [
      { type: 'mult', stat: 'moteSpawnMult', value: 4 },
      { type: 'mult', stat: 'moteValueMult', value: 3 },
    ],
  },
  {
    id: 'heavensFavor',
    name: "Heaven's Favor",
    duration: 300,
    effects: [{ type: 'mult', stat: 'globalMult', value: 2 }],
  },
  {
    id: 'swordIntent',
    name: 'Sword Intent',
    duration: 60,
    effects: [{ type: 'mult', stat: 'globalMult', value: 3 }],
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
