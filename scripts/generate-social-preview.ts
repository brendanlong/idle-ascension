/**
 * Renders scripts/social-preview.html to public/social-preview.png at the
 * standard 1200x630 Open Graph / Twitter card size.
 *
 * Usage: npm run social-preview (first time: npx playwright install chromium)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WIDTH = 1200;
const HEIGHT = 630;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(scriptDir, 'social-preview.html');
const outputPath = path.join(scriptDir, '..', 'public', 'social-preview.png');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  console.log(`Wrote ${outputPath} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
