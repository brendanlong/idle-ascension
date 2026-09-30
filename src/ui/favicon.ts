import { useEffect } from 'preact/hooks';
import { CORE_GRADES, ELEMENTS_BY_ID } from '../content/cores';
import { REALMS, STAGES } from '../content/realms';
import type { GameState } from '../engine/state';

export interface FaviconDot {
  color: string;
  rim: string;
}

const DOT_RADIUS = 4.5;
const OUTLINE = '#1a1512';

/**
 * The dantian in the realm's colour with a dark border, studded with one small
 * dot per core (element colour, grade-coloured rim). No background, so it
 * sits on light or dark tab bars; the dark outlines keep it legible on both.
 */
export function faviconSvg(realmColor: string, dots: readonly FaviconDot[]): string {
  const orbRadius = dots.length > 0 ? 24 : 27;
  const circles = dots.map((dot, i) => {
    // Start at the top and go clockwise.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / dots.length;
    // Centred on the orb's border, so each core overlaps it halfway.
    const x = (32 + Math.cos(angle) * orbRadius).toFixed(1);
    const y = (32 + Math.sin(angle) * orbRadius).toFixed(1);
    return (
      `<circle cx="${x}" cy="${y}" r="${DOT_RADIUS + 1.5}" fill="${OUTLINE}"/>` +
      `<circle cx="${x}" cy="${y}" r="${DOT_RADIUS}" fill="${dot.color}" stroke="${dot.rim}" stroke-width="1.5"/>`
    );
  });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#fff8e0"/><stop offset="0.45" stop-color="${realmColor}"/><stop offset="1" stop-color="${realmColor}"/></radialGradient></defs>`,
    `<circle cx="32" cy="32" r="${orbRadius}" fill="url(#g)" stroke="${OUTLINE}" stroke-width="3.5"/>`,
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
