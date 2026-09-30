import { NAME_TABLES } from '../content/names';
import { pick, type Rng } from './rng';

const PLACEHOLDER = /\{(\w+)\}/g;

export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/**
 * Fills {placeholders} from `vars`, or else from a random NAME_TABLES entry.
 * Random picks are stored back into `vars`, so reusing one vars object across
 * several templates keeps names consistent (the same young master throughout).
 */
export function fillTemplate(template: string, vars: Record<string, string>, rng: Rng): string {
  return template.replace(PLACEHOLDER, (match, key: string) => {
    if (!(key in vars)) {
      const table = NAME_TABLES[key];
      if (!table) return match;
      vars[key] = pick(rng, table);
    }
    return vars[key];
  });
}
