import { generatorName } from '../content/generators';
import { REALMS_BY_ID, firstStageOfRealm } from '../content/realms';
import type { GameState } from './state';

export type Condition = (
  | { type: 'generator'; id: string; count: number }
  | { type: 'realm'; realm: string }
  | { type: 'clicks'; count: number }
  | { type: 'qiEarned'; amount: number }
) & { label?: string };

export function meetsCondition(state: GameState, cond: Condition): boolean {
  switch (cond.type) {
    case 'generator':
      return (state.generators[cond.id] ?? 0) >= cond.count;
    case 'realm':
      return state.stage >= firstStageOfRealm(cond.realm);
    case 'clicks':
      return state.stats.loopClicks >= cond.count;
    case 'qiEarned':
      return state.qiEarnedThisLoop >= cond.amount;
  }
}

export function describeCondition(cond: Condition): string {
  if (cond.label) return cond.label;
  switch (cond.type) {
    case 'generator':
      return `Requires ${cond.count} ${generatorName(cond.id)}`;
    case 'realm':
      return `Requires ${REALMS_BY_ID.get(cond.realm)?.name ?? cond.realm}`;
    case 'clicks':
      return `Requires ${cond.count} cultivation clicks`;
    case 'qiEarned':
      return `Requires ${cond.amount} qi gathered`;
  }
}
