/**
 * Renders the static app icons (tab favicon before the game loads, home
 * screen and install icons) from the same drawing as the dynamic favicon.
 * Installed icons can't change, so they show a mid-game dantian: a golden
 * core-formation orb with three cores.
 *
 * Usage: npm run icons (first time: npx playwright install chromium)
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { CORE_GRADES, ELEMENTS_BY_ID, type ElementId } from '../src/content/cores';
import { REALMS } from '../src/content/realms';
import { faviconSvg } from '../src/ui/favicon';

const BACKGROUND = '#120f0d';
const CORES: ElementId[] = ['fire', 'water', 'wood'];
const RIM = CORE_GRADES.find((g) => g.name === 'Gold')!.color;

const svg = faviconSvg(
  REALMS.find((r) => r.id === 'coreFormation')!.color,
  CORES.map((id) => ({ color: ELEMENTS_BY_ID.get(id)!.color, rim: RIM })),
);

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
writeFileSync(path.join(publicDir, 'favicon.svg'), svg + '\n');

/** `fill` is the fraction of the canvas the icon covers; `background` is omitted for transparent. */
const PNGS: { file: string; size: number; fill: number; background?: string }[] = [
  { file: 'icon-192.png', size: 192, fill: 1 },
  { file: 'icon-512.png', size: 512, fill: 1 },
  // Android crops maskable icons to any shape within the central 80% circle.
  { file: 'icon-maskable-512.png', size: 512, fill: 0.72, background: BACKGROUND },
  // iOS fills transparency with black and rounds the corners itself.
  { file: 'apple-touch-icon.png', size: 180, fill: 0.86, background: BACKGROUND },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, fill, background } of PNGS) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * fill);
    await page.setContent(
      `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${background ?? 'transparent'}">` +
        `<img width="${inner}" height="${inner}" src="data:image/svg+xml,${encodeURIComponent(svg)}"></body>`,
    );
    await page.screenshot({
      path: path.join(publicDir, file),
      omitBackground: !background,
    });
    console.log(`Wrote public/${file}`);
  }
} finally {
  await browser.close();
}
