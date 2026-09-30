import preact from '@preact/preset-vite';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** The commit being built, shown in the About tab. */
function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths work both at a project path (user.github.io/idle-ascension/)
  // and at the root of a custom domain.
  base: './',
  plugins: [
    preact(),
    VitePWA({
      // A new version installs in the background and takes over the next time
      // the game is opened, rather than reloading mid-session.
      registerType: 'prompt',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
      manifest: {
        id: './',
        name: 'Idle Ascension',
        short_name: 'Ascension',
        description:
          'A free idle cultivation game. Gather qi, survive heavenly tribulations, forge elemental cores, and rise from the trash of your clan to godhood.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#120f0d',
        theme_color: '#120f0d',
        categories: ['games'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
});
