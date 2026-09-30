import { useEffect } from 'preact/hooks';
import { CORE_GRADES, ELEMENTS_BY_ID } from '../content/cores';
import { REALMS, STAGES } from '../content/realms';
import type { GameState } from '../engine/state';

export interface FaviconDot {
  color: string;
  rim: string;
}

const ORBIT_RADIUS = 22;
const DOT_RADIUS = 8.5;

/** The dantian in the realm's colour, ringed by one dot per core (element colour, grade rim). */
export function faviconSvg(realmColor: string, dots: readonly FaviconDot[]): string {
  // Big shapes and a thin border so it still reads at 16px.
  const orbRadius = dots.length > 0 ? 16 : 25;
  const circles = dots.map((dot, i) => {
    // Start at the top and go clockwise.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / dots.length;
    const x = (32 + Math.cos(angle) * ORBIT_RADIUS).toFixed(1);
    const y = (32 + Math.sin(angle) * ORBIT_RADIUS).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${DOT_RADIUS}" fill="${dot.color}" stroke="${dot.rim}" stroke-width="2.5"/>`;
  });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#fff8e0"/><stop offset="0.45" stop-color="${realmColor}"/><stop offset="1" stop-color="${realmColor}"/></radialGradient></defs>`,
    '<circle cx="32" cy="32" r="32" fill="#1a1512"/>',
    `<circle cx="32" cy="32" r="${orbRadius}" fill="url(#g)"/>`,
    ...circles,
    '</svg>',
  ].join('');
}

export function faviconForState(state: GameState): string {
  const realm = REALMS[STAGES[state.stage].realmIndex];
  const dots = state.cores.map((core) => ({
    color: ELEMENTS_BY_ID.get(core.element)?.color ?? '#888',
    rim: CORE_GRADES[core.grade]?.color ?? '#888',
  }));
  return faviconSvg(realm.color, dots);
}

/** Keeps the tab icon in sync with the player's realm and cores. */
export function useDynamicFavicon(state: GameState): void {
  const svg = faviconForState(state);
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [svg]);
}
