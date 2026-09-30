/**
 * GoatCounter page counting, only on the production site so previews and
 * local builds don't report into the live dashboard (count.js skips
 * localhost itself, but not other hosts such as a tailnet preview).
 *
 * If you change what's collected in the GoatCounter dashboard (Settings →
 * Data collection), update the privacy section in AboutTab.tsx to match.
 */
export const ANALYTICS_HOST = 'idle-ascension.brendanlong.com';
const ENDPOINT = 'https://idle-ascension.goatcounter.com/count';
const SCRIPT = 'https://gc.zgo.at/count.js';

export function shouldLoadAnalytics(hostname: string): boolean {
  return hostname === ANALYTICS_HOST;
}

export function loadAnalytics(): void {
  if (!shouldLoadAnalytics(location.hostname)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT;
  script.dataset.goatcounter = ENDPOINT;
  document.head.appendChild(script);
}
