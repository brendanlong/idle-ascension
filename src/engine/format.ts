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

/**
 * Always shows `sigFigs` digits (trailing zeros kept) so the width stays stable as values tick.
 * `tierDigits` must not exceed `sigFigs`, or the mantissa could need more digits than allowed.
 */
function withSuffix(
  n: number,
  tierDigits: number,
  sigFigs: number,
  suffixes: string[],
): string | null {
  const rounded = Number(n.toPrecision(sigFigs));
  const tier = Math.floor(Math.log10(rounded) / tierDigits);
  if (tier >= suffixes.length) return null;
  return `${(rounded / 10 ** (tier * tierDigits)).toPrecision(sigFigs)}${suffixes[tier]}`;
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
      ? withSuffix(n, 4, 4, MYRIAD_UNITS)
      : style === 'short'
        ? withSuffix(n, 3, 3, SHORT_SUFFIXES)
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
