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

function fixed(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.?0+$/, '');
}

export function formatNumber(n: number, style: NumberFormat = 'short'): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n < 0) return `-${formatNumber(-n, style)}`;
  if (n < 1000) return n < 10 && !Number.isInteger(n) ? fixed(n, 1) : Math.floor(n).toString();

  if (style === 'myriad') {
    const tier = Math.floor(Math.log10(n) / 4);
    if (tier < MYRIAD_UNITS.length) return `${fixed(n / 10 ** (tier * 4), 2)}${MYRIAD_UNITS[tier]}`;
  } else if (style === 'short') {
    const tier = Math.floor(Math.log10(n) / 3);
    if (tier < SHORT_SUFFIXES.length)
      return `${fixed(n / 10 ** (tier * 3), 2)}${SHORT_SUFFIXES[tier]}`;
  }
  return n.toExponential(2).replace('e+', 'e');
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
