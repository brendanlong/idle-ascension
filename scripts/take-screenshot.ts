/**
 * Takes docs/screenshot.jpg for the README: a mid-game save with five cores,
 * just after a breakthrough, with the next tribulation waiting.
 *
 * Usage: npm run screenshot (first time: npx playwright install chromium)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { firstStageOfRealm } from '../src/content/realms';
import { deserialize, serialize } from '../src/engine/save';
import type { GameState } from '../src/engine/state';

const WIDTH = 1280;
const HEIGHT = 800;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function demoSave(): string {
  const fixture = path.join(root, 'src/engine/__tests__/fixtures/save-v3.json');
  const s = deserialize(readFileSync(fixture, 'utf8'));
  s.stage = firstStageOfRealm('nascentSoul') + 2;
  s.stats.bestStage = s.stage;
  s.cores = [
    { element: 'wood', grade: 4 },
    { element: 'fire', grade: 5 },
    { element: 'earth', grade: 4 },
    { element: 'metal', grade: 3 },
    { element: 'water', grade: 5 },
  ] as GameState['cores'];
  Object.assign(s.generators, {
    cushion: 250,
    herb: 240,
    array: 220,
    furnace: 200,
    disciple: 180,
    beast: 150,
    vein: 120,
    secretRealm: 90,
    inheritance: 60,
    dao: 30,
    sect: 8,
  });
  s.qi = 4.2e21;
  s.settings.numberFormat = 'short';
  return serialize(s);
}

const server = await preview({ root, preview: { port: 0 } });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.addInitScript((save) => {
    const s = JSON.parse(save);
    s.lastTick = Date.now();
    localStorage.setItem('idle-ascension-save', JSON.stringify(s));
  }, demoSave());
  await page.goto(server.resolvedUrls!.local[0]);
  await page.getByRole('tab', { name: 'Resources' }).click();
  await page.getByRole('button', { name: 'Break Through' }).click();
  // Let qi motes drift in, with the cursor out of the way.
  await page.mouse.move(WIDTH - 1, HEIGHT - 1);
  await page.waitForTimeout(4000);
  const output = path.join(root, 'docs', 'screenshot.jpg');
  // Soft glows compress badly as PNG (~430 KB); this JPEG is a third of that.
  await page.screenshot({ path: output, type: 'jpeg', quality: 90 });
  console.log(`Wrote ${path.relative(root, output)}`);
} finally {
  await browser.close();
  await server.close();
}
