import type { NumberFormat } from './state';

const SHORT_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'DDc',
];

/** Traditional Chinese large-number units, each 10^4 larger than the last. */
const MYRIAD_UNITS = ['', '万', '亿', '兆', '京', '垓', '秭', '穰', '沟', '涧', '正', '载', '极'];

const SUFFIX_SIG_FIGS = 3;

/** Suffixed numbers keep trailing zeros (1.50M, not 1.5M) so their width stays stable as they tick. */
function withSuffix(n: number, tierDigits: number, suffixes: string[]): string | null {
  if (n < 10 ** tierDigits) return Math.floor(n).toString();
  const rounded = Number(n.toPrecision(SUFFIX_SIG_FIGS));
  const tier = Math.floor(Math.log10(rounded) / tierDigits);
  if (tier >= suffixes.length) return null;
  const mantissa = rounded / 10 ** (tier * tierDigits);
  // Myriad tiers are 4 digits wide, so 1230万 has more whole digits than significant figures.
  const digits =
    mantissa >= 10 ** SUFFIX_SIG_FIGS
      ? Math.round(mantissa).toString()
      : mantissa.toPrecision(SUFFIX_SIG_FIGS);
  return `${digits}${suffixes[tier]}`;
}

export function formatNumber(n: number, style: NumberFormat = 'short'): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n < 0) return `-${formatNumber(-n, style)}`;
  if (n < 10 && !Number.isInteger(n)) {
    const tenths = n.toFixed(1);
    return tenths === '10.0' ? '10' : tenths;
  }
  if (n < 1000) return Math.floor(n).toString();

  const suffixed =
    style === 'myriad'
      ? withSuffix(n, 4, MYRIAD_UNITS)
      : style === 'short'
        ? withSuffix(n, 3, SHORT_SUFFIXES)
        : null;
  return suffixed ?? n.toExponential(2).replace('e+', 'e');
}

export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
