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
/**
 * Pinned so the script can't change underneath us. To update, check
 * https://www.goatcounter.com/help/sri for a newer count.vN.js, and verify
 * the hash yourself:
 *   curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A
 */
const SCRIPT = 'https://gc.zgo.at/count.v5.js';
const SCRIPT_INTEGRITY = 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';

export function shouldLoadAnalytics(hostname: string): boolean {
  return hostname === ANALYTICS_HOST;
}

export function loadAnalytics(): void {
  if (!shouldLoadAnalytics(location.hostname)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT;
  script.integrity = SCRIPT_INTEGRITY;
  // Required for SRI on a cross-origin script; without it the check can't run.
  script.crossOrigin = 'anonymous';
  script.dataset.goatcounter = ENDPOINT;
  document.head.appendChild(script);
}
