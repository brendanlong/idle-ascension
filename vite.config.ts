import preact from '@preact/preset-vite';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

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
  plugins: [preact()],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
});
